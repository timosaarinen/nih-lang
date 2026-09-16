import type { Expr, FunctionDecl, Program, Stmt } from './ast.js'
export function formatProgram(program: Program): string { return program.functions.map(formatFunction).join('\n\n') + (program.functions.length ? '\n' : '') }
function formatFunction(fn: FunctionDecl): string {
  const target = fn.target === 'shared' ? '' : `${fn.target} `
  const ct = fn.comptimeParams.length ? `[${fn.comptimeParams.map(p=>`${p.name}: ${p.type}`).join(', ')}]` : ''
  const params = fn.params.map(p=>`${p.name}: ${p.type}`).join(', ')
  const ret = fn.returnType === 'void' ? '' : ` -> ${fn.returnType}`
  return `${target}fn ${fn.name}${ct}(${params})${ret} ${formatBlock(fn.body,0)}`
}
function formatBlock(stmts: Stmt[], depth: number): string {
  if (!stmts.length) return '{}'
  const body = stmts.map(s=>formatStmt(s,depth+1)).join('\n')
  return `{\n${body}\n${'  '.repeat(depth)}}`
}
function formatStmt(stmt: Stmt, depth:number): string {
  const pad='  '.repeat(depth)
  if (stmt.kind==='bind') return `${pad}${stmt.name} ${stmt.mutable?':=':'='} ${formatExpr(stmt.value)};`
  if (stmt.kind==='return') return `${pad}return${stmt.value?` ${formatExpr(stmt.value)}`:''};`
  if (stmt.kind==='expr') return `${pad}${formatExpr(stmt.expr)};`
  const head = stmt.kind==='comptime-if' ? 'comptime if' : 'if'
  let out=`${pad}${head} ${formatExpr(stmt.condition)} ${formatBlock(stmt.thenBody,depth)}`
  if (stmt.elseBody.length) out += ` else ${formatBlock(stmt.elseBody,depth)}`
  return out
}
export function formatExpr(expr: Expr, parentPrec=0): string {
  if (expr.kind==='number') return canonicalNumber(expr.value, expr.raw)
  if (expr.kind==='string') return JSON.stringify(expr.value)
  if (expr.kind==='bool') return String(expr.value)
  if (expr.kind==='name') return expr.name
  if (expr.kind==='swizzle') return `${formatExpr(expr.value,9)}.${expr.fields}`
  if (expr.kind==='call') { const ct=expr.comptimeArgs.length?`[${expr.comptimeArgs.map(e=>formatExpr(e)).join(', ')}]`:''; return `${expr.callee}${ct}(${expr.args.map(e=>formatExpr(e)).join(', ')})` }
  if (expr.kind==='unary') { const s=`${expr.op}${formatExpr(expr.value,8)}`; return parentPrec>8?`(${s})`:s }
  const p=prec(expr.op), s=`${formatExpr(expr.left,p)} ${expr.op} ${formatExpr(expr.right,p+1)}`; return parentPrec>p?`(${s})`:s
}
function prec(op:string):number { if(op==='||')return 1;if(op==='&&')return 2;if(op==='=='||op==='!=')return 3;if(['<','<=','>','>='].includes(op))return 4;if(op==='+'||op==='-')return 5;return 6 }
function canonicalNumber(value:number,raw:string):string { const isFloat=/[.eE]/.test(raw); if(!isFloat)return String(Math.trunc(value)); return Number.isInteger(value)?`${value}.0`:String(value) }
