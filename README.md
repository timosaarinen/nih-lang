# NIH WIDE

NIH is an embedded language for ordinary numerical code and shader-style computation. **WIDE, its live-coding web playground, is the current product focus.** Edit NIH, compile it directly to WebAssembly in a worker, and see its pixels on a canvas.

The 2026 resurrection starts standalone. A public clone and public npm packages are sufficient: no private fgpu, ValoX, Maa, submodule, native compiler, GPU, account, or backend service is required. Future packaged fgpu integration can follow when its public distribution is ready.

This is an early vertical slice. The live WASM subset is smaller than the historical v3 CLI. Unsupported constructs are rejected; the page does not fall back to JavaScript evaluation.

## Run locally

Use **Bun 1.4.5**, pinned in `package.json`, and a browser with WebAssembly and Workers.

```sh
git clone git@github.com:timosaarinen/nih-lang.git
cd nih-lang
bun install --frozen-lockfile
bun run dev
```

Open **http://127.0.0.1:5173/**. The port is fixed; stop an old server if it is occupied.

| Command | Purpose |
| --- | --- |
| `bun run dev` | Vite development server under Bun |
| `bun run check` | Build and run compiler/WASM tests |
| `bun run check:web` | Check browser and Vite TypeScript |
| `bun run build` | Build the historical CLI and minified static web release |
| `bun run preview` | Serve the release at http://127.0.0.1:4173/opengpu/nih/ |

The web output is `dist-web/`. Its default base is `/opengpu/nih/`, for a later release under `opengpu/docs/nih/`. For another hosting path, set the same `NIH_BASE` for build and preview:

```sh
NIH_BASE=/ bun run build
NIH_BASE=/ bun run preview
```

Building does not publish anything. The browser receives minified JavaScript and generates edited-program WASM locally. This initial release does not require a prebuilt WASM network asset.

## Live shader contract

The entrypoint is an ordinary NIH function:

```nih
fn pulse(x: f32, t: f32) -> f32 {
  0.5 + 0.5 * sin(x * 6.2831853 + t);
}

fn pixel(uv: vec2, t: f32) -> vec4 {
  p = pulse(uv.x, t);
  vec4(p, p * 0.35, 1.0 - p, 1.0);
}
```

`uv` is the pixel-center coordinate in `[0, 1]`, with canvas-downward Y. `t` is host-provided time in seconds. Color is converted to RGBA8. Ordinary helpers and pixel code use the same backend.

The initial backend supports straight-line `f32`, `bool`, and `vec2/3/4` computations, immutable bindings, helper calls, explicit/tail returns, arithmetic, constructors, swizzles, and a small pure math library. It rejects integer-typed parameters/results, mutable bindings, branches, loops, recursion, compile-time parameters, strings, and I/O. See `src/wasm.ts` and its execution tests for exact operations and bounds.

Generated modules export capped memory and `render(width, height, time, startY, endY)` for row jobs. The worker calls this once per tile; individual pixels and math helpers execute in WASM. Source size, nesting, call graphs, and rendering dimensions are bounded.

The numerical contract is `f32`; trigonometric functions use an approximation implemented in WASM. The historical JavaScript interpreter differs in places and is not the acceptance oracle for this backend.

## Editing and execution

- Monaco editor with NIH highlighting, live compilation, Run / Ctrl+Enter, and an auto-run toggle.
- Animated canvas preview, resolution, pause/resume, and time reset.
- Compile errors retain the last working output and identify its source revision.
- One renderer worker and one frame request in flight, with explicit build/source/resize identities.
- Local host-side draft storage; NIH scripts receive no storage or browser access.

The language has no ambient filesystem, network, process, DOM, or arbitrary JavaScript capability. Native embedding remains a later integration task using the same language contract.

## Development freshness

Ordinary reload with browser caching enabled must run the current successful build. Vite sends `Cache-Control: no-store`, forces dependency optimization on startup, and reloads on app/compiler/worker source changes. Main and worker code share a build identity; `/build.json` exposes the generation. Navigation rechecks the source fingerprint.

No service worker is registered. Saved programs must survive reloads and future narrowly scoped cache recovery. The handoff records the outstanding cached-browser and stale-service-worker acceptance checks. Development headers do not configure a production host.

## Repository map

| Path | Role |
| --- | --- |
| `web/`, `index.html` | Editor, standalone worker/protocol, canvas, examples |
| `src/wasm.ts` | Checked subset and direct WASM emission |
| `src/parser.ts`, `src/lexer.ts`, `src/ast.ts` | Existing public NIH frontend shared by the new backend |
| `test/` | Compiler checks and generated-WASM execution |
| `vite.config.ts` | Build identity, freshness, static release |
| `runtime/web/` | Historical WebGPU demos retained as references |
| `src/cli.ts`, `src/wgsl.ts`, `src/semantic-graph.ts` | Historical CLI, WGSL, and semantic editing experiments |

The CLI remains available through `bun run build:cli` and `bun run nih -- <command>`. Historical documentation: [DESIGN](docs/DESIGN.md), [AGENTS](docs/AGENTS.md), [GFX](docs/GFX.md), [PORTAL](docs/PORTAL.md). These describe earlier experiments and do not expand the live WASM subset or grant it I/O.

## Plan and continuation

- [Resurrect NIH 2026 — issue #1](https://github.com/timosaarinen/nih-lang/issues/1)
- [Local Codex handoff](docs/RESURRECT_2026_HANDOFF.md)

Preserve old branch history. Improve this working page before adding another language frontend, general framework, advanced GPU pipeline, or package ecosystem.

## License

MIT. Third-party packages retain their own licenses.
