import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { compile } from '../dist/src/compiler.js'
import { emitWgsl } from '../dist/src/wgsl.js'

const demos = [
  ['triangle', 'examples/gpu_triangle.nih'],
  ['portal', 'examples/gpu_portal.nih']
]

await mkdir('runtime/web/generated', { recursive: true })
for (const [name, file] of demos) {
  const source = await readFile(file, 'utf8')
  const wgsl = emitWgsl(compile(source))
  await writeFile(`runtime/web/generated/${name}.wgsl`, wgsl)
  console.log(`generated runtime/web/generated/${name}.wgsl`)
}
