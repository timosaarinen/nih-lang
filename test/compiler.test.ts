import test from 'node:test'
import assert from 'node:assert/strict'
import { compile } from '../src/compiler.js'
import { run } from '../src/interpreter.js'
import { emitWgsl } from '../src/wgsl.js'

const source = `
fn pulse(x: f32) -> f32 { saturate(x * 2.0) }
cpu fn main() -> f32 { pulse(0.25) }
gpu fn shade(x: f32) -> vec4 {
  p = pulse(x);
  vec4(p, 0.0, 0.0, 1.0)
}
`

test('shared code runs on CPU', () => {
  const program = compile(source)
  assert.equal(run(program), 0.5)
})

test('GPU emission pulls shared dependencies', () => {
  const wgsl = emitWgsl(compile(source), 'shade')
  assert.match(wgsl, /fn pulse/)
  assert.match(wgsl, /fn shade/)
  assert.match(wgsl, /vec4<f32>/)
  assert.match(wgsl, /clamp\(/)
  assert.doesNotMatch(wgsl, /fn main/)
})

test('portable code rejects CPU-only print', () => {
  assert.throws(() => compile(`fn nope(x: f32) -> f32 { print(x); x }`), /print is CPU-only/)
})

test('swizzles run on CPU', () => {
  const program = compile(`
fn flip(v: vec4) -> vec4 { v.bgra }
cpu fn main() -> vec4 { flip(vec4(1.0, 2.0, 3.0, 4.0)) }
`)
  assert.deepEqual(run(program), [3, 2, 1, 4])
})

test('layout is semantically irrelevant', () => {
  const compact = compile('fn twice(x:f32)->f32{return x*2.0;} cpu fn main()->f32{return twice(4.0);}')
  const roomy = compile(`
    fn twice ( x : f32 ) -> f32 {
      return x * 2.0;
    }

    cpu fn main() -> f32 {
      return twice(4.0);
    }
  `)
  assert.equal(run(compact), 8)
  assert.equal(run(roomy), 8)
  assert.equal(run(compile('cpu fn main()->f32{return 5.0-2.0;}')), 3)
})

test('procedural portal source compiles to WGSL helpers', async () => {
  const { readFile } = await import('node:fs/promises')
  const portal = await readFile('examples/gpu_portal.nih', 'utf8')
  const wgsl = emitWgsl(compile(portal), 'triangle_color')
  assert.match(wgsl, /fn portal_surface/)
  assert.match(wgsl, /fn fbm4/)
  assert.match(wgsl, /fract\(/)
  assert.match(wgsl, /floor\(/)
})
