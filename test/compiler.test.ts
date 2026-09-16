import test from 'node:test'
import assert from 'node:assert/strict'
import { compile, compileWithGraph } from '../src/compiler.js'
import { run } from '../src/interpreter.js'
import { emitWgsl } from '../src/wgsl.js'
import { formatProgram } from '../src/formatter.js'
import { applyAgentPatch } from '../src/patch.js'

const source=`
fn pulse(x: f32) -> f32 { saturate(x * 2.0) }
cpu fn main() -> f32 { pulse(0.25) }
gpu fn shade(x: f32) -> vec4 { p = pulse(x); vec4(p, 0.0, 0.0, 1.0) }
`
test('shared code runs on CPU',()=>assert.equal(run(compile(source)),0.5))
test('GPU emission pulls shared dependencies',()=>{const w=emitWgsl(compile(source),'shade');assert.match(w,/fn pulse/);assert.match(w,/fn shade/);assert.match(w,/vec4<f32>/);assert.match(w,/clamp\(/);assert.doesNotMatch(w,/fn main/)})
test('portable code rejects CPU-only print',()=>assert.throws(()=>compile(`fn nope(x:f32)->f32{print(x);x}`),/print is CPU-only/))
test('swizzles run on CPU',()=>assert.deepEqual(run(compile(`fn flip(v:vec4)->vec4{v.bgra} cpu fn main()->vec4{flip(vec4(1.0,2.0,3.0,4.0))}`)),[3,2,1,4]))
test('layout is semantically irrelevant',()=>{const a=compile('fn twice(x:f32)->f32{return x*2.0;} cpu fn main()->f32{return twice(4.0);}');const b=compile(`fn twice ( x : f32 ) -> f32 { return x * 2.0; } cpu fn main()->f32 { return twice(4.0); }`);assert.equal(run(a),8);assert.equal(run(b),8)})

test('Mojo-style value compile-time parameters execute and specialize on GPU',()=>{
  const s=`fn gain[G:f32](x:f32)->f32{x*G} cpu fn main()->f32{gain[4.0](2.0)} gpu fn shade(x:f32)->f32{gain[3.0](x)}`
  assert.equal(run(compile(s)),8)
  const w=emitWgsl(compile(s),'shade')
  assert.match(w,/fn gain__ct_3/)
  assert.match(w,/x \* 3\.0/)
  assert.match(w,/gain__ct_3\(x\)/)
})

test('comptime if folds before WGSL emission',()=>{
  const s=`fn choose[FAST:bool](x:f32)->f32{comptime if FAST { x*2.0; } else { x*3.0; }} gpu fn shade(x:f32)->f32{choose[true](x)}`
  const w=emitWgsl(compile(s),'shade')
  assert.match(w,/x \* 2\.0/)
  assert.doesNotMatch(w,/x \* 3\.0/)
})

test('semantic graph hash ignores formatting and exposes calls/effects',()=>{
  const a=compileWithGraph('fn f(x:f32)->f32{x*2.0} cpu fn main()->f32{f(2.0)}')
  const b=compileWithGraph(`fn f ( x : f32 ) -> f32 { x * 2.0; }\n cpu fn main ( ) -> f32 { f ( 2.0 ); }`)
  assert.equal(a.graph.hash,b.graph.hash)
  assert.equal(a.graph.edges.some(e=>e.from==='fn:main'&&e.to==='fn:f'),true)
})

test('formatter is deterministic and reparses',()=>{
  const p=compile('fn f[X:f32](x:f32)->f32{x*X} cpu fn main()->f32{f[2.0](3.0)}')
  const once=formatProgram(p),twice=formatProgram(compile(once));assert.equal(once,twice);assert.equal(run(compile(once)),6)
})

test('checked semantic patch changes a literal and rejects stale hash',()=>{
  const s='cpu fn main()->f32{1.0+2.0}'
  const {graph}=compileWithGraph(s)
  const node=graph.nodes.find(n=>n.kind==='literal'&&n.value===2)?.id
  if(!node)throw new Error('literal node missing')
  const out=applyAgentPatch(s,{expect:graph.hash,ops:[{op:'set-literal',node,value:5}]})
  assert.equal(run(compile(out.source)),6)
  assert.throws(()=>applyAgentPatch(s,{expect:'deadbeef',ops:[]}),/stale semantic patch/)
})

test('rename-function semantic patch rewrites call sites',()=>{
  const s='fn f(x:f32)->f32{x} cpu fn main()->f32{f(3.0)}', {graph}=compileWithGraph(s)
  const out=applyAgentPatch(s,{expect:graph.hash,ops:[{op:'rename-function',from:'f',to:'identity'}]})
  assert.match(out.source,/fn identity/);assert.match(out.source,/identity\(3\.0\)/);assert.equal(run(compile(out.source)),3)
})
