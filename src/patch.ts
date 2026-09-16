import type { Expr, Program, Target } from './ast.js'
import { check } from './checker.js'
import { buildSemanticGraph, walkStmts } from './semantic-graph.js'
import { formatProgram } from './formatter.js'
import { parse } from './parser.js'

export type PatchOp =
  | { op:'set-literal'; node:string; value:number|boolean|string }
  | { op:'rename-function'; from:string; to:string }
  | { op:'set-target'; function:string; target:Target }
export interface AgentPatch { expect:string; ops:PatchOp[] }

export function applyAgentPatch(source:string, patch:AgentPatch): {source:string;hash:string} {
  const checked=check(parse(source)); const before=buildSemanticGraph(checked)
  if(before.hash!==patch.expect) throw new Error(`stale semantic patch: expected ${patch.expect}, current ${before.hash}`)
  const program=structuredClone({functions:checked.functions}) as Program
  for(const op of patch.ops) applyOp(program,op)
  const verified=check(program); const out=formatProgram(verified); const hash=buildSemanticGraph(verified).hash
  return {source:out,hash}
}
function applyOp(program:Program,op:PatchOp):void {
  if(op.op==='rename-function') { if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(op.to))throw new Error(`invalid function name ${op.to}`); const fn=program.functions.find(f=>f.name===op.from);if(!fn)throw new Error(`function ${op.from} not found`);if(program.functions.some(f=>f.name===op.to))throw new Error(`function ${op.to} already exists`);fn.name=op.to;for(const f of program.functions)walkStmts(f.body,e=>{if(e.kind==='call'&&e.callee===op.from)e.callee=op.to});return }
  if(op.op==='set-target'){const fn=program.functions.find(f=>f.name===op.function);if(!fn)throw new Error(`function ${op.function} not found`);fn.target=op.target;return}
  let found=false
  for(const fn of program.functions){let lit=0;walkStmts(fn.body,e=>{if(e.kind==='number'||e.kind==='bool'||e.kind==='string'){const id=`lit:${fn.name}:${lit++}`;if(id===op.node){found=true;setLiteral(e,op.value)}}})}
  if(!found)throw new Error(`semantic node ${op.node} not found`)
}
function setLiteral(expr:Extract<Expr,{kind:'number'|'bool'|'string'}>,value:number|boolean|string):void {
  if(expr.kind==='number'){if(typeof value!=='number')throw new Error('number literal requires numeric value');expr.value=value;expr.raw=Number.isInteger(value)?String(value):String(value);return}
  if(expr.kind==='bool'){if(typeof value!=='boolean')throw new Error('bool literal requires boolean value');expr.value=value;return}
  if(typeof value!=='string')throw new Error('string literal requires string value');expr.value=value
}
