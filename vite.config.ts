import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));
const sourceDirectories = ['src', 'web', 'public', 'examples'];
const sourceFiles = ['index.html', 'package.json', 'bun.lock', 'vite.config.ts', 'tsconfig.web.json', 'web-env.d.ts'];

function sourceHash(): string {
  const hash = createHash('sha256');
  function add(path: string): void {
    if (!existsSync(path)) return;
    hash.update(relative(root, path).replaceAll('\\', '/')).update('\0');
    hash.update(readFileSync(path)).update('\0');
  }
  function walk(path: string): void {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) add(child);
    }
  }
  sourceFiles.forEach(file => add(join(root, file)));
  sourceDirectories.forEach(directory => walk(join(root, directory)));
  return hash.digest('hex').slice(0, 16);
}

function appFile(id: string): boolean {
  const path = relative(root, id.split('?')[0]!).replaceAll('\\', '/');
  return sourceFiles.includes(path) || sourceDirectories.some(directory => path.startsWith(`${directory}/`));
}

export default defineConfig(({ command, isPreview }) => {
  const development = command === 'serve' && !isPreview;
  const session = development ? `${randomUUID().slice(0, 8)}-` : '';
  const generation = { id: `${session}${sourceHash()}` };

  function refresh(server: ViteDevServer): void {
    const id = `${session}${sourceHash()}`;
    if (id !== generation.id) {
      generation.id = id;
      server.moduleGraph.invalidateAll();
    }
  }

  // Workers have a separate Vite pipeline. Both pipelines inject the same generation.
  function identityPlugin(): Plugin {
    return {
      name: 'nih-build-identity',
      enforce: 'pre',
      transform(code, id) {
        if (appFile(id) && code.includes('__NIH_BUILD_ID__')) {
          return { code: code.replace(/\b__NIH_BUILD_ID__\b/g, JSON.stringify(generation.id)), map: null };
        }
      },
    };
  }

  const freshness: Plugin = {
    name: 'nih-fresh-development',
    configureServer(server) {
      // Rechecking on navigation also covers a missed filesystem watcher event.
      server.middlewares.use((request, response, next) => {
        // Covers conditional responses too; Vite applies server.headers after its
        // default Cache-Control when sending transformed sources and dependencies.
        response.setHeader('Cache-Control', 'no-store');
        const pathname = new URL(request.url ?? '/', 'http://nih.local').pathname;
        if (pathname.endsWith('/build.json') || request.headers.accept?.includes('text/html')) refresh(server);
        if (pathname === '/build.json') {
          response.setHeader('Cache-Control', 'no-store');
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ buildId: generation.id }));
          return;
        }
        next();
      });

      let pending: ReturnType<typeof setTimeout> | undefined;
      const changedStructure = (file: string): void => {
        if (!appFile(file)) return;
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => {
          refresh(server);
          server.moduleGraph.invalidateAll();
          server.ws.send({ type: 'full-reload' });
        }, 30);
      };
      server.watcher.on('add', changedStructure).on('unlink', changedStructure);
      server.httpServer?.once('close', () => {
        if (pending) clearTimeout(pending);
        server.watcher.off('add', changedStructure).off('unlink', changedStructure);
      });
    },
    async handleHotUpdate(context) {
      if (!appFile(context.file)) return;
      await context.read(); // Vite waits for an editor's partial write to complete.
      refresh(context.server);
      context.server.moduleGraph.invalidateAll();
      context.server.ws.send({ type: 'full-reload' });
      return [];
    },
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { name: 'nih-build-id', content: generation.id }, injectTo: 'head' }];
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build.json', source: `${JSON.stringify({ buildId: generation.id })}\n` });
    },
  };

  const base = process.env.NIH_BASE ?? '/opengpu/nih/';
  if (!base.startsWith('/') || !base.endsWith('/')) throw new Error('NIH_BASE must start and end with /');

  return {
    base: development ? '/' : base,
    plugins: [identityPlugin(), freshness],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      headers: { 'Cache-Control': 'no-store' },
    },
    optimizeDeps: { force: true },
    worker: { format: 'es', plugins: () => [identityPlugin()] },
    build: {
      outDir: 'dist-web',
      emptyOutDir: true,
      target: 'es2022',
      minify: true,
      sourcemap: false,
    },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  };
});
