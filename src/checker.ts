import type { ComptimeType, Expr, FunctionDecl, Program, Stmt, TypeName } from './ast.js'
import { builtins, isNumeric } from './builtins.js'
import { validateComptimeExpr } from './comptime.js'

export interface CheckedProgram extends Program { functionMap: Map<string, FunctionDecl> }
type VarInfo = { type: TypeName; mutable: boolean; comptime: boolean }

export function check(program: Program): CheckedProgram {
  const functionMap = new Map<string, FunctionDecl>()
  for (const fn of program.functions) { if (functionMap.has(fn.name)) fail(fn.line, `duplicate function ${fn.name}`); functionMap.set(fn.name, fn) }
  for (const fn of program.functions) checkFunction(fn, functionMap)
  return { ...program, functionMap }
}

function checkFunction(fn: FunctionDecl, functions: Map<string, FunctionDecl>): void {
  const vars = new Map<string, VarInfo>()
  for (const p of fn.comptimeParams) { if (vars.has(p.name)) fail(fn.line, `duplicate parameter ${p.name}`); vars.set(p.name, { type: p.type, mutable: false, comptime: true }) }
  for (const p of fn.params) { if (vars.has(p.name)) fail(fn.line, `duplicate parameter ${p.name}`); vars.set(p.name, { type: p.type, mutable: false, comptime: false }) }
  checkBlock(fn.body, vars, functions, fn, fn.target !== 'cpu')
  if (fn.returnType !== 'void' && !blockProducesValue(fn.body)) fail(fn.line, `${fn.name} must return ${fn.returnType} or end with an expression`)
}

function checkBlock(stmts: Stmt[], vars: Map<string, VarInfo>, functions: Map<string, FunctionDecl>, fn: FunctionDecl, portable: boolean): void {
  for (const stmt of stmts) {
    if (stmt.kind === 'bind') {
      const valueType = infer(stmt.value, vars, functions, fn, portable)
      const existing = vars.get(stmt.name)
      if (!existing) vars.set(stmt.name, { type: valueType, mutable: stmt.mutable, comptime: false })
      else { if (!stmt.mutable) fail(stmt.line, `${stmt.name} already exists; use := to assign a mutable variable`); if (!existing.mutable) fail(stmt.line, `${stmt.name} is immutable`); requireAssignable(existing.type, valueType, stmt.line) }
    } else if (stmt.kind === 'return') {
      if (!stmt.value) { if (fn.returnType !== 'void') fail(stmt.line, `expected ${fn.returnType} return value`) }
      else requireAssignable(fn.returnType, infer(stmt.value, vars, functions, fn, portable), stmt.line)
    } else if (stmt.kind === 'expr') infer(stmt.expr, vars, functions, fn, portable)
    else if (stmt.kind === 'if' || stmt.kind === 'comptime-if') {
      const type = infer(stmt.condition, vars, functions, fn, portable)
      if (type !== 'bool') fail(stmt.line, `${stmt.kind === 'comptime-if' ? 'comptime if' : 'if'} condition must be bool, got ${type}`)
      if (stmt.kind === 'comptime-if') validateComptimeExpr(stmt.condition, new Set([...vars].filter(([,v]) => v.comptime).map(([n]) => n)))
      checkBlock(stmt.thenBody, new Map(vars), functions, fn, portable); checkBlock(stmt.elseBody, new Map(vars), functions, fn, portable)
    }
  }
}

export function infer(expr: Expr, vars: Map<string, VarInfo>, functions: Map<string, FunctionDecl>, fn: FunctionDecl, portable: boolean): TypeName {
  switch (expr.kind) {
    case 'number': return /[.eE]/.test(expr.raw) ? 'f32' : 'i32'
    case 'string': if (portable) fail(expr.line, `strings are CPU-only in NIH v3 bootstrap`); return 'string'
    case 'bool': return 'bool'
    case 'name': { const v = vars.get(expr.name); if (!v) fail(expr.line, `unknown name ${expr.name}`); return v.type }
    case 'unary': { const t = infer(expr.value, vars, functions, fn, portable); if (expr.op === '!') { if (t !== 'bool') fail(expr.line, `! expects bool`); return 'bool' } if (!isNumeric(t)) fail(expr.line, `- expects numeric value`); return t }
    case 'binary': {
      const a = infer(expr.left, vars, functions, fn, portable), b = infer(expr.right, vars, functions, fn, portable)
      if (['==','!=','<','<=','>','>='].includes(expr.op)) { requireComparable(a,b,expr.line); return 'bool' }
      if (expr.op === '&&' || expr.op === '||') { if (a !== 'bool' || b !== 'bool') fail(expr.line, `${expr.op} expects bool operands`); return 'bool' }
      if (!isNumeric(a) || !isNumeric(b)) fail(expr.line, `${expr.op} expects numeric operands`)
      return numericResult(a,b)
    }
    case 'swizzle': {
      const base = infer(expr.value, vars, functions, fn, portable), width = vectorWidth(base)
      if (!width) fail(expr.line, `swizzle requires a vector, got ${base}`)
      if (!/^[xyzwrgba]{1,4}$/.test(expr.fields)) fail(expr.line, `invalid swizzle .${expr.fields}`)
      const max = Math.max(...[...expr.fields].map(c => 'xr'.includes(c) ? 0 : 'yg'.includes(c) ? 1 : 'zb'.includes(c) ? 2 : 3)); if (max >= width) fail(expr.line, `.${expr.fields} exceeds ${base}`)
      return expr.fields.length === 1 ? 'f32' : (`vec${expr.fields.length}` as TypeName)
    }
    case 'call': {
      const builtin = builtins[expr.callee]
      if (builtin) {
        if (expr.comptimeArgs.length) fail(expr.line, `${expr.callee} does not take compile-time arguments`)
        const argTypes = expr.args.map(a => infer(a, vars, functions, fn, portable))
        if (portable && !builtin.gpu) fail(expr.line, `${expr.callee} is CPU-only`)
        if (builtin.args === 'print') { if (argTypes.length < 1) fail(expr.line, `print expects at least one argument`); return 'void' }
        if (builtin.args === 'variadic-numeric') { if (argTypes.length < 1 || argTypes.some(t => !isNumeric(t))) fail(expr.line, `${expr.callee} expects numeric arguments`) }
        else { if (argTypes.length !== builtin.args.length) fail(expr.line, `${expr.callee} expects ${builtin.args.length} arguments`); for (let i=0;i<builtin.args.length;i++) requireAssignable(builtin.args[i]!, argTypes[i]!, expr.line) }
        if (builtin.returns === 'same' || builtin.returns === 'vector-of-first') return argTypes[0]!
        return builtin.returns
      }
      const callee = functions.get(expr.callee); if (!callee) fail(expr.line, `unknown function ${expr.callee}`)
      if (portable && callee.target === 'cpu') fail(expr.line, `portable function ${fn.name} cannot call CPU-only ${callee.name}`)
      if (fn.target === 'shared' && callee.target === 'gpu') fail(expr.line, `shared function ${fn.name} cannot depend on GPU-only ${callee.name}`)
      if (expr.comptimeArgs.length !== callee.comptimeParams.length) fail(expr.line, `${callee.name} expects ${callee.comptimeParams.length} compile-time arguments`)
      const ctNames = new Set([...vars].filter(([,v]) => v.comptime).map(([n]) => n))
      for (let i=0;i<callee.comptimeParams.length;i++) { const arg = expr.comptimeArgs[i]!; validateComptimeExpr(arg, ctNames); const actual = infer(arg, vars, functions, fn, portable); requireAssignable(callee.comptimeParams[i]!.type, actual, expr.line) }
      const argTypes = expr.args.map(a => infer(a, vars, functions, fn, portable))
      if (argTypes.length !== callee.params.length) fail(expr.line, `${callee.name} expects ${callee.params.length} runtime arguments`)
      for (let i=0;i<callee.params.length;i++) requireAssignable(callee.params[i]!.type, argTypes[i]!, expr.line)
      return callee.returnType
    }
  }
}

function numericResult(a: TypeName, b: TypeName): TypeName { const wa=vectorWidth(a), wb=vectorWidth(b); if (wa&&wb&&wa!==wb) throw new Error(`vector width mismatch: ${a} and ${b}`); if (wa) return a; if (wb) return b; if (a==='f32'||b==='f32') return 'f32'; if (a==='u32'&&b==='u32') return 'u32'; return 'i32' }
function vectorWidth(t: TypeName): number | null { return t==='vec2'?2:t==='vec3'?3:t==='vec4'?4:null }
function requireComparable(a: TypeName,b:TypeName,line:number):void { if (a===b) return; if (isNumeric(a)&&isNumeric(b)&&!vectorWidth(a)&&!vectorWidth(b)) return; fail(line,`cannot compare ${a} and ${b}`) }
function requireAssignable(expected: TypeName|ComptimeType, actual: TypeName, line:number):void { if (expected===actual) return; if (expected==='f32'&&(actual==='i32'||actual==='u32')) return; fail(line,`expected ${expected}, got ${actual}`) }
function blockProducesValue(stmts: Stmt[]): boolean { const last=stmts[stmts.length-1]; return !!last && (last.kind==='return'||last.kind==='expr'||((last.kind==='if'||last.kind==='comptime-if')&&blockProducesValue(last.thenBody)&&blockProducesValue(last.elseBody))) }
function fail(line:number,message:string):never { throw new Error(`line ${line}: ${message}`) }
