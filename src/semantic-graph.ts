import { createHash } from 'node:crypto'
import type { Expr, Stmt } from './ast.js'
import type { CheckedProgram } from './checker.js'
import { builtins } from './builtins.js'
import { formatProgram } from './formatter.js'

export interface SemanticNode { id:string; kind:'function'|'comptime-param'|'param'|'local'|'call'|'literal'; function?:string; name?:string; type?:string; target?:string; callee?:string; value?:unknown; line?:number; effects?:string[]; capabilities?:string[] }
export interface SemanticEdge { from:string; to:string; kind:'calls' }
export interface SemanticGraph { version:1; hash:string; nodes:SemanticNode[]; edges:SemanticEdge[] }

export function buildSemanticGraph(program: CheckedProgram): SemanticGraph {
  const nodes:SemanticNode[]=[]; const edges:SemanticEdge[]=[]
  const effects = inferEffects(program)
  for (const fn of program.functions) {
    nodes.push({ id:`fn:${fn.name}`, kind:'function', function:fn.name, name:fn.name, target:fn.target, type:fn.returnType, line:fn.line, effects:[...effects.get(fn.name)!].sort(), capabilities:fn.target==='shared'?['cpu','gpu']:[fn.target] })
    fn.comptimeParams.forEach(p=>nodes.push({id:`ct:${fn.name}:${p.name}`,kind:'comptime-param',function:fn.name,name:p.name,type:p.type,line:fn.line}))
    fn.params.forEach(p=>nodes.push({id:`param:${fn.name}:${p.name}`,kind:'param',function:fn.name,name:p.name,type:p.type,line:fn.line}))
    let callOrdinal=0, litOrdinal=0
    walkStmts(fn.body, expr=>{
      if (expr.kind==='call') { const id=`call:${fn.name}:${callOrdinal++}`; nodes.push({id,kind:'call',function:fn.name,callee:expr.callee,line:expr.line}); if (program.functionMap.has(expr.callee)) edges.push({from:`fn:${fn.name}`,to:`fn:${expr.callee}`,kind:'calls'}) }
      if (expr.kind==='number'||expr.kind==='bool'||expr.kind==='string') nodes.push({id:`lit:${fn.name}:${litOrdinal++}`,kind:'literal',function:fn.name,value:expr.value,type:expr.kind,line:expr.line})
    }, stmt=>{ if(stmt.kind==='bind') nodes.push({id:`local:${fn.name}:${stmt.name}`,kind:'local',function:fn.name,name:stmt.name,line:stmt.line}) })
  }
  const canonical=formatProgram(program)
  const hash=createHash('sha256').update(canonical).digest('hex')
  return {version:1,hash,nodes,edges}
}

export function querySemanticGraph(graph: SemanticGraph, selector: string): unknown {
  const direct=graph.nodes.find(n=>n.id===selector)
  if(direct) return {hash:graph.hash,node:direct,edges:graph.edges.filter(e=>e.from===direct.id||e.to===direct.id)}
  const fn=graph.nodes.find(n=>n.kind==='function'&&n.name===selector)
  if(fn) return {hash:graph.hash,node:fn,nodes:graph.nodes.filter(n=>n.function===selector),edges:graph.edges.filter(e=>e.from===fn.id||e.to===fn.id)}
  return {hash:graph.hash,matches:graph.nodes.filter(n=>n.name===selector||n.callee===selector)}
}

export function walkStmts(stmts: Stmt[], onExpr:(e:Expr)=>void, onStmt:(s:Stmt)=>void=()=>{}):void {
  const walkExpr=(e:Expr):void=>{ onExpr(e); if(e.kind==='unary'||e.kind==='swizzle') walkExpr(e.value); else if(e.kind==='binary'){walkExpr(e.left);walkExpr(e.right)} else if(e.kind==='call'){e.comptimeArgs.forEach(walkExpr);e.args.forEach(walkExpr)} }
  const walkStmt=(s:Stmt):void=>{ onStmt(s); if(s.kind==='bind')walkExpr(s.value);else if(s.kind==='return'&&s.value)walkExpr(s.value);else if(s.kind==='expr')walkExpr(s.expr);else if(s.kind==='if'||s.kind==='comptime-if'){walkExpr(s.condition);s.thenBody.forEach(walkStmt);s.elseBody.forEach(walkStmt)} }
  stmts.forEach(walkStmt)
}

function inferEffects(program: CheckedProgram): Map<string,Set<string>> {
  const direct=new Map<string,Set<string>>(), deps=new Map<string,Set<string>>()
  for(const fn of program.functions){const e=new Set<string>(),d=new Set<string>();walkStmts(fn.body,x=>{if(x.kind==='call'){const b=builtins[x.callee];if(b?.effect)e.add(b.effect);if(program.functionMap.has(x.callee))d.add(x.callee)}});direct.set(fn.name,e);deps.set(fn.name,d)}
  const memo=new Map<string,Set<string>>()
  const visit=(name:string,stack=new Set<string>()):Set<string>=>{if(memo.has(name))return memo.get(name)!;if(stack.has(name))return new Set(direct.get(name));stack.add(name);const out=new Set(direct.get(name));for(const d of deps.get(name)??[])for(const e of visit(d,new Set(stack)))out.add(e);memo.set(name,out);return out}
  for(const fn of program.functions)visit(fn.name);return memo
}
