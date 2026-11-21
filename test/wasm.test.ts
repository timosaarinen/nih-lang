import test from 'node:test'
import assert from 'node:assert/strict'
import { compileShader, SHADER_LIMITS } from '../src/wasm.js'

type ShaderExports = {
  memory: WebAssembly.Memory
  render(width: number, height: number, time: number, startY: number, endY: number): void
  [name: string]: WebAssembly.Memory | ((...args: number[]) => number | number[] | void)
}
function instantiate(source: string): { module: WebAssembly.Module; exports: ShaderExports } {
  const { bytes } = compileShader(source)
  const module = new WebAssembly.Module(bytes)
  return { module, exports: new WebAssembly.Instance(module).exports as unknown as ShaderExports }
}
function call(exports: ShaderExports, name: string, ...args: number[]): number | number[] {
  return (exports[name] as (...values: number[]) => number | number[])(...args)
}
const black = 'fn pixel(uv:vec2,t:f32)->vec4{vec4(0.0,0.0,0.0,1.0);}'
function byte(value: number): number {
  if (Number.isNaN(value)) return 0
  const scaled = Math.fround(Math.max(0, Math.min(1, value)) * 255)
  const lower = Math.floor(scaled)
  return scaled - lower === .5 ? lower + (lower & 1) : Math.round(scaled)
}

test('shader WASM has no imports; helper calls and raster output share f32 semantics', () => {
  const { module, exports: e } = instantiate(`
fn channels(p:vec2,t:f32)->vec3 {
  q = p * 2.0 - vec2(1.0);
  vec3(q.x * q.x, q.y * q.y, saturate(t));
}
fn pixel(uv:vec2,t:f32)->vec4 { vec4(channels(uv,t),1.0); }
`)
  assert.deepEqual(WebAssembly.Module.imports(module), [])
  assert.deepEqual(call(e, 'channels', .25, .75, .4), [.25, .25, Math.fround(.4)])
  assert.deepEqual(call(e, 'pixel', .25, .75, .4), [.25, .25, Math.fround(.4), 1])
  e.render(7, 5, .4, 0, 5)
  const actual = new Uint8Array(e.memory.buffer, 0, 7 * 5 * 4)
  for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) {
    const expected = (call(e, 'pixel', (x + .5) / 7, (y + .5) / 5, .4) as number[]).map(byte)
    assert.deepEqual([...actual.subarray((y * 7 + x) * 4, (y * 7 + x + 1) * 4)], expected)
  }
})

test('render respects row boundaries, validates ranges before writes, and cannot grow memory', () => {
  const { exports: e } = instantiate('fn pixel(uv:vec2,t:f32)->vec4{vec4(uv,t,1.0);}')
  const pixels = new Uint8Array(e.memory.buffer, 0, 4 * 3 * 4)
  pixels.fill(17)
  e.render(4, 3, .5, 1, 2)
  assert.deepEqual([...pixels.subarray(0, 16)], Array(16).fill(17))
  assert.deepEqual([...pixels.subarray(32, 48)], Array(16).fill(17))
  assert.deepEqual([...pixels.subarray(16, 20)], [32, 128, 128, 255])
  const before = [...pixels]
  e.render(4, 3, 0, 2, 2)
  assert.deepEqual([...pixels], before)
  for (const values of [[0, 3, 0, 0, 3], [4, 3, 0, -1, 2], [4, 3, 0, 0, 4],
    [4, 3, 0, 2, 1], [SHADER_LIMITS.dimension + 1, 1, 0, 0, 1]]) {
    assert.throws(() => e.render(values[0]!, values[1]!, values[2]!, values[3]!, values[4]!))
    assert.deepEqual([...pixels], before)
  }
  assert.equal(e.memory.buffer.byteLength, SHADER_LIMITS.memoryPages * 65536)
  assert.throws(() => e.memory.grow(1))
})

test('WASM trigonometry is import-free and accurate on ordinary graphics inputs', () => {
  const { exports: e } = instantiate(`
fn wave(x:f32)->vec2{vec2(sin(x),cos(x));}
fn pixel(uv:vec2,t:f32)->vec4{vec4(wave(t),uv);}
`)
  for (const input of [-1000, -64, -Math.PI, -Math.PI / 2, -.5, 0, .5, Math.PI / 2, Math.PI, 64, 1000]) {
    const x = Math.fround(input), values = call(e, 'wave', x) as number[]
    assert.equal(Math.abs(values[0]! - Math.sin(x)) < .000002, true)
    assert.equal(Math.abs(values[1]! - Math.cos(x)) < .000002, true)
  }
  for (const input of [-1e30, 1e30]) {
    for (const value of call(e, 'wave', input) as number[]) assert.equal(Number.isFinite(value) && Math.abs(value) <= 1.000001, true)
  }
})

test('constructors, vector math and swizzles execute in WASM; output packing handles nonfinite values', () => {
  const { exports: e } = instantiate(`
fn operations(v:vec3)->vec4 {
  n = normalize(v);
  a = clamp(abs(n.zyx),0.0,1.0);
  b = lerp(vec3(0.0),a,0.5);
  vec4(b,dot(n,n));
}
fn remainder(x:f32)->vec4{vec4(floor(x),fract(x),min(x,1.0),max(x,0.0));}
fn pixel(uv:vec2,t:f32)->vec4 {vec4(0.0/0.0,1.0/0.0,-1.0/0.0,1.0);}
`)
  assert.deepEqual(call(e, 'operations', 0, 0, 2), [.5, 0, 0, 1])
  assert.deepEqual(call(e, 'operations', 0, 0, 0), [0, 0, 0, 0])
  assert.deepEqual(call(e, 'remainder', -1.25), [-2, .75, -1.25, 0])
  e.render(2, 1, 0, 0, 1)
  assert.deepEqual([...new Uint8Array(e.memory.buffer, 0, 8)], [0, 255, 0, 255, 0, 255, 0, 255])
})

test('shader arithmetic actually rounds to f32; bool helpers have a distinct type', () => {
  const { exports: e } = instantiate(`
fn precision(x:f32)->f32{(x+1.0)-x;}
fn equal(a:f32,b:f32)->bool{a==b;}
fn both(a:bool,b:bool)->bool{a&&!b;}
${black}
`)
  assert.equal(call(e, 'precision', 16777216), 0)
  assert.equal(call(e, 'equal', 2, 2), 1)
  assert.equal(call(e, 'equal', 2, 3), 0)
  assert.equal(call(e, 'both', 1, 0), 1)
  assert.equal(call(e, 'both', 2, 0), 1)
})

test('shader checker rejects invalid results, arities, widths, shadowing and unsupported syntax', () => {
  const cases: [string, RegExp][] = [
    ['fn pixel(uv:vec2,t:f32)->vec4{true;}', /expected vec4, got bool/],
    ['fn bad()->f32{true;}' + black, /expected f32, got bool/],
    ['fn pixel(uv:vec2,t:f32)->vec4{vec4(1.0,2.0);}', /exactly 4 components/],
    ['fn pixel(uv:vec2,t:f32)->vec4{vec4(sin(1.0,2.0));}', /sin expects 1/],
    ['fn pixel(uv:vec2,t:f32)->vec4{vec4(dot(uv,vec3(1.0)));}', /matching vectors/],
    ['fn pixel(uv:vec2,t:f32)->vec4{vec4(uv+vec3(1.0));}', /vector widths/],
    ['fn pixel(uv:vec2,t:f32)->vec4{vec4(uv.z);}', /exceeds vec2/],
    ['fn pixel(uv:vec2,t:f32)->vec4{vec4(uv.xr,0.0,1.0);}', /one coordinate alphabet/],
    ['fn pixel(uv:vec2,t:f32)->vec4{t=0.0;vec4(t);}', /shadows/],
    ['fn pixel(uv:vec2,t:f32)->vec4{sin=0.0;vec4(sin);}', /shadows/],
    ['fn pixel(uv:vec2,uv:f32)->vec4{vec4(0.0);}', /duplicate parameter/],
    ['fn pixel(uv:vec2,t:f32)->vec4{x:=1.0;vec4(x);}', /mutable/],
    ['fn pixel(uv:vec2,t:f32)->vec4{if true{vec4(1.0);}else{vec4(0.0);}}', /if is not supported/],
    ['fn f[N:f32](x:f32)->f32{x*N;}' + black, /compile-time parameters/],
    ['fn f(x:i32)->i32{x;}' + black, /does not support type i32/],
    ['fn render()->f32{1.0;}' + black, /reserved/],
    ['fn sin(x:f32)->f32{x;}' + black, /reserved/],
    ['fn f()->f32{print(1.0);1.0;}' + black, /unsupported shader function print/],
    ['fn pixel(uv:vec2,t:f32)->vec4{vec4(1e100);}', /finite f32/],
    ['fn pixel(uv:vec2,t:f32)->vec4{return vec4(0.0);vec4(1.0);}', /unreachable/],
  ]
  for (const [source, error] of cases) assert.throws(() => compileShader(source), error)
})

test('recursion, nested syntax and exponentially expanded helper work are bounded at compile time', () => {
  assert.throws(() => compileShader('fn f(x:f32)->f32{f(x);}' + black), /recursive/)
  assert.throws(() => compileShader('fn a(x:f32)->f32{b(x);}fn b(x:f32)->f32{a(x);}' + black), /recursive/)
  assert.throws(() => compileShader(' '.repeat(SHADER_LIMITS.sourceCharacters + 1)), /source exceeds/)
  assert.throws(() => compileShader(`fn pixel(uv:vec2,t:f32)->vec4{vec4(${'('.repeat(70)}1.0${')'.repeat(70)});}`), /nesting limit/)
  let source = 'fn f0(x:f32)->f32{x+x;}\n'
  for (let i = 1; i < 16; i++) source += `fn f${i}(x:f32)->f32{f${i-1}(x)+f${i-1}(x);}\n`
  assert.throws(() => compileShader(source + 'fn pixel(uv:vec2,t:f32)->vec4{vec4(f15(t));}'), /work limit/)
  let chain = 'fn c0(x:f32)->f32{x;}\n'
  for (let i = 1; i < 18; i++) chain += `fn c${i}(x:f32)->f32{c${i-1}(x);}\n`
  assert.throws(() => compileShader(chain + black), /call-depth limit/)
})
