import type { Expr } from './ast.js'
export type ConstValue = number | boolean

export function validateComptimeExpr(expr: Expr, names: Set<string>): void {
  switch (expr.kind) {
    case 'number': case 'bool': return
    case 'name': if (names.has(expr.name)) return; throw new Error(`line ${expr.line}: ${expr.name} is not a compile-time value`)
    case 'unary': validateComptimeExpr(expr.value, names); return
    case 'binary': validateComptimeExpr(expr.left, names); validateComptimeExpr(expr.right, names); return
    default: throw new Error(`line ${expr.line}: expression is not compile-time evaluable`)
  }
}

export function evalComptime(expr: Expr, env: Map<string, ConstValue>): ConstValue {
  switch (expr.kind) {
    case 'number': return expr.value
    case 'bool': return expr.value
    case 'name': {
      const value = env.get(expr.name)
      if (value === undefined) throw new Error(`line ${expr.line}: compile-time value ${expr.name} is not bound`)
      return value
    }
    case 'unary': {
      const v = evalComptime(expr.value, env)
      if (expr.op === '!') return !Boolean(v)
      if (typeof v !== 'number') throw new Error(`line ${expr.line}: unary - expects number`)
      return -v
    }
    case 'binary': return evalBinary(expr.op, evalComptime(expr.left, env), evalComptime(expr.right, env), expr.line)
    default: throw new Error(`line ${expr.line}: expression is not compile-time evaluable`)
  }
}

function evalBinary(op: string, a: ConstValue, b: ConstValue, line: number): ConstValue {
  if (op === '&&') return Boolean(a) && Boolean(b)
  if (op === '||') return Boolean(a) || Boolean(b)
  if (op === '==') return a === b
  if (op === '!=') return a !== b
  if (typeof a !== 'number' || typeof b !== 'number') throw new Error(`line ${line}: ${op} expects numeric compile-time operands`)
  if (op === '+') return a + b
  if (op === '-') return a - b
  if (op === '*') return a * b
  if (op === '/') return a / b
  if (op === '%') return a % b
  if (op === '<') return a < b
  if (op === '<=') return a <= b
  if (op === '>') return a > b
  if (op === '>=') return a >= b
  throw new Error(`line ${line}: unsupported compile-time operator ${op}`)
}
