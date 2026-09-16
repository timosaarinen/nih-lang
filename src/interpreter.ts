import type { Expr, FunctionDecl, Stmt } from './ast.js'
import type { CheckedProgram } from './checker.js'

export type Value = number | boolean | string | number[] | undefined

type Cell = { value: Value; mutable: boolean }

export function run(program: CheckedProgram, entry = 'main', args: Value[] = []): Value {
  const fn = program.functionMap.get(entry)
  if (!fn) throw new Error(`entry function ${entry} not found`)
  return callFunction(program, fn, args)
}

function callFunction(program: CheckedProgram, fn: FunctionDecl, args: Value[]): Value {
  if (args.length !== fn.params.length) throw new Error(`${fn.name}: expected ${fn.params.length} arguments`)
  const env = new Map<string, Cell>()
  fn.params.forEach((p, i) => env.set(p.name, { value: args[i], mutable: false }))
  const result = execBlock(program, fn.body, env)
  return result.returned ? result.value : result.value
}

function execBlock(program: CheckedProgram, stmts: Stmt[], env: Map<string, Cell>): { returned: boolean; value: Value } {
  let last: Value = undefined
  for (const stmt of stmts) {
    if (stmt.kind === 'bind') {
      const value = evaluate(program, stmt.value, env)
      const existing = env.get(stmt.name)
      if (existing) existing.value = value
      else env.set(stmt.name, { value, mutable: stmt.mutable })
      last = value
    } else if (stmt.kind === 'expr') {
      last = evaluate(program, stmt.expr, env)
    } else if (stmt.kind === 'return') {
      return { returned: true, value: stmt.value ? evaluate(program, stmt.value, env) : undefined }
    } else if (stmt.kind === 'if') {
      const cond = evaluate(program, stmt.condition, env)
      const branch = cond ? stmt.thenBody : stmt.elseBody
      const result = execBlock(program, branch, new Map(env))
      if (result.returned) return result
      last = result.value
    }
  }
  return { returned: false, value: last }
}

function evaluate(program: CheckedProgram, expr: Expr, env: Map<string, Cell>): Value {
  switch (expr.kind) {
    case 'number': return expr.value
    case 'string': return expr.value
    case 'bool': return expr.value
    case 'name': return env.get(expr.name)?.value
    case 'unary': {
      const v = evaluate(program, expr.value, env)
      if (expr.op === '!') return !v
      return mapUnary(v, x => -x)
    }
    case 'binary': return binary(expr.op, evaluate(program, expr.left, env), evaluate(program, expr.right, env))
    case 'swizzle': return swizzle(evaluate(program, expr.value, env), expr.fields)
    case 'call': {
      const args = expr.args.map(a => evaluate(program, a, env))
      const builtin = callBuiltin(expr.callee, args)
      if (builtin.handled) return builtin.value
      const fn = program.functionMap.get(expr.callee)
      if (!fn) throw new Error(`unknown function ${expr.callee}`)
      return callFunction(program, fn, args)
    }
  }
}

function callBuiltin(name: string, args: Value[]): { handled: boolean; value: Value } {
  const n = (i: number) => args[i] as number
  switch (name) {
    case 'print': console.log(...args.map(format)); return { handled: true, value: undefined }
    case 'sin': return done(Math.sin(n(0)))
    case 'cos': return done(Math.cos(n(0)))
    case 'sqrt': return done(Math.sqrt(n(0)))
    case 'floor': return done(mapUnary(args[0], Math.floor))
    case 'fract': return done(mapUnary(args[0], x => x - Math.floor(x)))
    case 'pow': return done(mapBinary(args[0], args[1], Math.pow))
    case 'abs': return done(mapUnary(args[0], Math.abs))
    case 'min': return done(mapBinary(args[0], args[1], Math.min))
    case 'max': return done(mapBinary(args[0], args[1], Math.max))
    case 'clamp': return done(mapBinary(mapBinary(args[0], args[1], Math.max), args[2], Math.min))
    case 'saturate': return done(mapBinary(mapBinary(args[0], 0, Math.max), 1, Math.min))
    case 'lerp': return done(mapBinary(args[0], mapBinary(mapBinary(args[1], args[0], (a, b) => a - b), args[2], (a, b) => a * b), (a, b) => a + b))
    case 'dot': {
      const a = asVector(args[0]); const b = asVector(args[1]);
      return done(a.reduce((sum, x, i) => sum + x * (b[i] ?? 0), 0))
    }
    case 'length': return done(Math.sqrt(asVector(args[0]).reduce((sum, x) => sum + x * x, 0)))
    case 'normalize': {
      const a = asVector(args[0]); const len = Math.sqrt(a.reduce((sum, x) => sum + x * x, 0))
      return done(a.map(x => len === 0 ? 0 : x / len))
    }
    case 'vec2': return done(vectorCtor(2, args))
    case 'vec3': return done(vectorCtor(3, args))
    case 'vec4': return done(vectorCtor(4, args))
    default: return { handled: false, value: undefined }
  }
}

function done(value: Value) { return { handled: true, value } }
function format(v: Value): string { return Array.isArray(v) ? `(${v.join(', ')})` : String(v) }
function asVector(v: Value): number[] { if (!Array.isArray(v)) throw new Error('expected vector'); return v }
function vectorCtor(width: number, args: Value[]): number[] {
  const flat = args.flatMap(a => Array.isArray(a) ? a : [a as number])
  if (flat.length === 1) return Array(width).fill(flat[0])
  if (flat.length !== width) throw new Error(`vec${width} expects 1 or ${width} scalar components`)
  return flat
}
function swizzle(value: Value, fields: string): Value {
  const v = asVector(value)
  const map: Record<string, number> = { x: 0, r: 0, y: 1, g: 1, z: 2, b: 2, w: 3, a: 3 }
  const out = [...fields].map(f => v[map[f]!]!)
  return out.length === 1 ? out[0] : out
}
function mapUnary(v: Value, fn: (x: number) => number): Value { return Array.isArray(v) ? v.map(fn) : fn(v as number) }
function mapBinary(a: Value, b: Value, fn: (a: number, b: number) => number): Value {
  if (Array.isArray(a)) return a.map((x, i) => fn(x, Array.isArray(b) ? b[i]! : b as number))
  if (Array.isArray(b)) return b.map(x => fn(a as number, x))
  return fn(a as number, b as number)
}
function binary(op: string, a: Value, b: Value): Value {
  if (['+', '-', '*', '/', '%'].includes(op)) return mapBinary(a, b, (x, y) => op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : op === '/' ? x / y : x % y)
  if (op === '&&') return Boolean(a) && Boolean(b)
  if (op === '||') return Boolean(a) || Boolean(b)
  const x = a as number, y = b as number
  if (op === '==') return JSON.stringify(a) === JSON.stringify(b)
  if (op === '!=') return JSON.stringify(a) !== JSON.stringify(b)
  if (op === '<') return x < y
  if (op === '<=') return x <= y
  if (op === '>') return x > y
  if (op === '>=') return x >= y
  throw new Error(`unsupported operator ${op}`)
}
