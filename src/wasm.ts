import type { Expr, FunctionDecl, Stmt, TypeName } from './ast.js'
import { lex } from './lexer.js'
import { parse } from './parser.js'

// This browser-safe compiler deliberately has no dependency on the Node CLI,
// interpreter, graph tooling, or an external renderer. Source arithmetic is f32.
// Vectors use flattened f32 parameters and WebAssembly multi-value results.
export const SHADER_LIMITS = Object.freeze({
  sourceCharacters: 65536, tokens: 8192, nodes: 4096, nesting: 64,
  functions: 32, callDepth: 16, work: 8192, moduleBytes: 262144,
  dimension: 2048, memoryPages: 256,
})

type ShaderType = 'f32' | 'bool' | 'vec2' | 'vec3' | 'vec4'
type WasmType = 0x7d | 0x7c | 0x7f
type Value = { type: ShaderType; slots: number[] }
type Definition = {
  source: FunctionDecl; parameters: ShaderType[]; result: ShaderType; index: number
  calls: string[]; work: number
}
type Body = { parameters: WasmType[]; results: WasmType[]; locals: WasmType[]; code: number[] }
const F32 = 0x7d, F64 = 0x7c, I32 = 0x7f
const numeric = (type: ShaderType) => type !== 'bool'
const width = (type: ShaderType) => type.startsWith('vec') ? Number(type[3]) : 1
const wasmTypes = (type: ShaderType): WasmType[] => Array(width(type)).fill(type === 'bool' ? I32 : F32)
const builtinNames = new Set(['sin', 'cos', 'abs', 'sqrt', 'floor', 'fract', 'min', 'max',
  'clamp', 'saturate', 'lerp', 'dot', 'length', 'normalize', 'vec2', 'vec3', 'vec4'])
function fail(line: number, message: string): never { throw Error(`line ${line}: ${message}`) }
const type = (name: TypeName, line: number): ShaderType => {
  if (name === 'f32' || name === 'bool' || name === 'vec2' || name === 'vec3' || name === 'vec4') return name
  return fail(line, `shader subset does not support type ${name}; use f32, bool or vec2/3/4`)
}
const expectType = (actual: ShaderType, expected: ShaderType, line: number) => {
  if (actual !== expected) fail(line, `expected ${expected}, got ${actual}`)
}

/** Compile a pure NIH pixel(uv:vec2,t:f32)->vec4 function to standalone WASM.
 * UV is normalized at pixel centres, with a top-left origin and +y downward.
 * The module has no imports. Its 16 MiB memory never grows. render writes only
 * [startY,endY); invalid dimensions/ranges trap before any framebuffer writes.
 * Source helpers are exported with flattened arguments and multi-value returns.
 */
export function compileShader(source: string): { bytes: Uint8Array<ArrayBuffer> } {
  preflight(source)
  let program
  try { program = parse(source) }
  catch (error) {
    // The existing shared parser is recursive. Mixed groups/unary prefixes can
    // hit an engine's smaller stack before our post-parse AST depth check.
    if (error instanceof RangeError) fail(1, 'shader exceeds the parser nesting limit')
    throw error
  }
  if (!program.functions.length || program.functions.length > SHADER_LIMITS.functions)
    fail(1, `shader must contain 1..${SHADER_LIMITS.functions} functions`)
  checkTreeSize(program.functions)
  const definitions = new Map<string, Definition>()
  // Four internal functions: f64 range reduction/sine, sin, cos, byte packing.
  for (const [i, fn] of program.functions.entries()) {
    if (definitions.has(fn.name)) fail(fn.line, `duplicate function ${fn.name}`)
    if (builtinNames.has(fn.name) || fn.name === 'render' || fn.name === 'memory')
      fail(fn.line, `reserved shader function name ${fn.name}`)
    if (fn.target !== 'shared') fail(fn.line, 'shader subset uses plain fn; cpu/gpu declarations are not supported yet')
    if (fn.comptimeParams.length) fail(fn.line, 'compile-time parameters are not supported by the shader subset')
    const parameters = fn.params.map(p => type(p.type, fn.line))
    if (parameters.reduce((n, t) => n + width(t), 0) > 64) fail(fn.line, 'too many flattened function parameters')
    definitions.set(fn.name, { source: fn, parameters, result: type(fn.returnType, fn.line),
      index: i + 4, calls: [], work: 0 })
  }
  const pixel = definitions.get('pixel')
  if (!pixel) fail(1, 'expected fn pixel(uv: vec2, t: f32) -> vec4')
  if (pixel.parameters.join(',') !== 'vec2,f32' || pixel.result !== 'vec4')
    fail(pixel.source.line, 'pixel must have signature (vec2, f32) -> vec4')
  const bodies = mathBodies()
  for (const definition of definitions.values()) bodies.push(new Lowerer(definition, definitions).compile())
  checkWork(definitions)
  bodies.push(renderBody(pixel.index))
  const exports = [{ name: 'memory', kind: 2, index: 0 },
    ...[...definitions].map(([name, d]) => ({ name, kind: 0, index: d.index })),
    { name: 'render', kind: 0, index: bodies.length - 1 }]
  const bytes = moduleBytes(bodies, exports)
  if (bytes.length > SHADER_LIMITS.moduleBytes) fail(1, 'generated shader exceeds the module size limit')
  if (!WebAssembly.validate(bytes)) throw Error('NIH compiler error: generated an invalid WebAssembly module')
  return { bytes }
}

function preflight(source: string): void {
  if (source.length > SHADER_LIMITS.sourceCharacters) fail(1, 'shader source exceeds the size limit')
  const tokens = lex(source)
  if (tokens.length > SHADER_LIMITS.tokens) fail(1, 'shader exceeds the token limit')
  let depth = 0, unary = 0
  for (const token of tokens) {
    if (['(', '{', '['].includes(token.kind)) depth++
    if ([')', '}', ']'].includes(token.kind)) depth--
    unary = token.kind === '-' || token.kind === '!' ? unary + 1 : 0
    if (depth > SHADER_LIMITS.nesting || unary > SHADER_LIMITS.nesting)
      fail(token.line, 'shader exceeds the syntax nesting limit')
  }
}

function checkTreeSize(functions: FunctionDecl[]): void {
  const pending: { node: Expr | Stmt; depth: number }[] = []
  for (const fn of functions) for (const stmt of fn.body) pending.push({ node: stmt, depth: 1 })
  let count = 0
  while (pending.length) {
    const { node, depth } = pending.pop()!
    if (++count > SHADER_LIMITS.nodes) fail(node.line, 'shader exceeds the AST node limit')
    if (depth > SHADER_LIMITS.nesting) fail(node.line, 'shader exceeds the expression nesting limit')
    const add = (child: Expr | Stmt) => pending.push({ node: child, depth: depth + 1 })
    switch (node.kind) {
      case 'bind': case 'unary': case 'swizzle': add(node.value); break
      case 'return': if (node.value) add(node.value); break
      case 'expr': add(node.expr); break
      case 'binary': add(node.left); add(node.right); break
      case 'call': node.args.forEach(add); node.comptimeArgs.forEach(add); break
      case 'if': case 'comptime-if': add(node.condition); node.thenBody.forEach(add); node.elseBody.forEach(add); break
    }
  }
}

function checkWork(definitions: Map<string, Definition>): void {
  const active = new Set<string>(), finished = new Map<string, { work: number; depth: number }>()
  const visit = (name: string): { work: number; depth: number } => {
    if (finished.has(name)) return finished.get(name)!
    const fn = definitions.get(name)!
    if (active.has(name)) fail(fn.source.line, `recursive shader call involving ${name} is not supported`)
    active.add(name)
    let work = fn.work, depth = 1
    for (const callee of fn.calls) {
      const child = visit(callee)
      work += child.work
      depth = Math.max(depth, child.depth + 1)
      if (work > SHADER_LIMITS.work) fail(fn.source.line, `${name} exceeds the expanded shader work limit`)
      if (depth > SHADER_LIMITS.callDepth) fail(fn.source.line, `${name} exceeds the shader call-depth limit`)
    }
    if (work > SHADER_LIMITS.work) fail(fn.source.line, `${name} exceeds the shader work limit`)
    active.delete(name)
    const result = { work, depth }; finished.set(name, result); return result
  }
  for (const name of definitions.keys()) visit(name)
}

class Lowerer {
  private code: number[] = []
  private locals: WasmType[] = []
  private variables = new Map<string, Value>()
  private parameterCount = 0
  private extraWork = 0
  constructor(private fn: Definition, private definitions: Map<string, Definition>) {
    fn.source.params.forEach((param, i) => {
      if (this.variables.has(param.name)) fail(fn.source.line, `duplicate parameter ${param.name}`)
      this.checkBindingName(param.name, fn.source.line)
      const t = fn.parameters[i]!
      const slots = wasmTypes(t).map(() => this.parameterCount++)
      this.variables.set(param.name, { type: t, slots })
      // Exports use i32 for bool; normalize nonzero host arguments to true.
      if (t === 'bool') { this.get(slots[0]!); this.emit(0x45, 0x45); this.set(slots[0]!) }
    })
  }
  compile(): Body {
    let returned = false
    for (const [i, stmt] of this.fn.source.body.entries()) {
      if (returned) fail(stmt.line, 'unreachable statement after return')
      if (stmt.kind === 'bind') {
        if (stmt.mutable) fail(stmt.line, 'mutable := bindings are not supported by the shader subset')
        if (this.variables.has(stmt.name)) fail(stmt.line, `local ${stmt.name} shadows an existing binding`)
        this.checkBindingName(stmt.name, stmt.line)
        this.variables.set(stmt.name, this.expression(stmt.value))
      } else if (stmt.kind === 'return' || stmt.kind === 'expr') {
        const expression = stmt.kind === 'expr' ? stmt.expr : stmt.value
        if (!expression) fail(stmt.line, 'shader functions must return a value')
        const value = this.expression(expression)
        if (stmt.kind === 'return' || i === this.fn.source.body.length - 1) {
          expectType(value.type, this.fn.result, stmt.line)
          value.slots.forEach(slot => this.get(slot)); this.emit(0x0f); returned = true
        }
      } else fail(stmt.line, `${stmt.kind} is not supported by the straight-line shader subset`)
    }
    if (!returned) fail(this.fn.source.line, `${this.fn.source.name} must end with a ${this.fn.result} return value`)
    this.emit(0x0b)
    this.fn.work = this.code.length + this.extraWork
    return { parameters: this.fn.parameters.flatMap(wasmTypes), results: wasmTypes(this.fn.result), locals: this.locals, code: this.code }
  }
  private emit(...bytes: number[]): void { this.code.push(...bytes) }
  private checkBindingName(name: string, line: number): void {
    if (this.definitions.has(name) || builtinNames.has(name) || name === 'memory' || name === 'render')
      fail(line, `binding ${name} shadows a function or reserved shader name`)
  }
  private get(slot: number): void { this.emit(0x20, ...u32(slot)) }
  private set(slot: number): void { this.emit(0x21, ...u32(slot)) }
  private constant(value: number): void { this.emit(0x43, ...floatBytes(value, false)) }
  private result(t: ShaderType, component: (i: number) => void): Value {
    const slots = wasmTypes(t).map((wasmType, i) => {
      const slot = this.parameterCount + this.locals.length
      this.locals.push(wasmType); component(i); this.set(slot); return slot
    })
    return { type: t, slots }
  }
  private lane(value: Value, i: number): void { this.get(value.slots[value.slots.length === 1 ? 0 : i]!) }
  private shape(values: Value[], line: number): ShaderType {
    if (values.some(v => !numeric(v.type))) fail(line, 'numeric operation does not accept bool')
    const vectors = values.filter(v => width(v.type) > 1)
    const t = vectors[0]?.type ?? 'f32'
    if (vectors.some(v => v.type !== t)) fail(line, 'vector widths must match')
    return t
  }
  private expression(expr: Expr): Value {
    switch (expr.kind) {
      case 'number': {
        if (!Number.isFinite(Math.fround(expr.value))) fail(expr.line, 'numeric literal is outside the finite f32 range')
        return this.result('f32', () => this.constant(expr.value))
      }
      case 'bool': return this.result('bool', () => this.emit(0x41, expr.value ? 1 : 0))
      case 'name': {
        const v = this.variables.get(expr.name)
        if (!v) return fail(expr.line, `unknown name ${expr.name}`)
        return v
      }
      case 'string': return fail(expr.line, 'strings and I/O are not supported by the shader subset')
      case 'unary': {
        const value = this.expression(expr.value)
        if (expr.op === '!') expectType(value.type, 'bool', expr.line)
        else this.shape([value], expr.line)
        return this.result(value.type, i => { this.lane(value, i); this.emit(expr.op === '!' ? 0x45 : 0x8c) })
      }
      case 'swizzle': {
        const value = this.expression(expr.value)
        if (width(value.type) === 1 || !(/^[xyzw]{1,4}$/.test(expr.fields) || /^[rgba]{1,4}$/.test(expr.fields)))
          fail(expr.line, 'swizzle needs a vector and one coordinate alphabet (xyzw or rgba)')
        const alphabet = 'xyzw'.includes(expr.fields[0]!) ? 'xyzw' : 'rgba'
        const indices = [...expr.fields].map(c => alphabet.indexOf(c))
        if (indices.some(i => i >= width(value.type))) fail(expr.line, `swizzle .${expr.fields} exceeds ${value.type}`)
        return { type: indices.length === 1 ? 'f32' : `vec${indices.length}` as ShaderType,
          slots: indices.map(i => value.slots[i]!) }
      }
      case 'binary': {
        const a = this.expression(expr.left), b = this.expression(expr.right)
        const arithmetic: Record<string, number> = { '+': 0x92, '-': 0x93, '*': 0x94, '/': 0x95 }
        if (arithmetic[expr.op]) {
          const t = this.shape([a, b], expr.line)
          return this.result(t, i => { this.lane(a, i); this.lane(b, i); this.emit(arithmetic[expr.op]!) })
        }
        if (expr.op === '&&' || expr.op === '||') {
          expectType(a.type, 'bool', expr.line); expectType(b.type, 'bool', expr.line)
          return this.result('bool', () => { this.lane(a, 0); this.lane(b, 0); this.emit(expr.op === '&&' ? 0x71 : 0x72) })
        }
        const compare: Record<string, number> = { '==': 0x5b, '!=': 0x5c, '<': 0x5d, '>': 0x5e, '<=': 0x5f, '>=': 0x60 }
        if (compare[expr.op]) {
          if (a.type === 'bool' && b.type === 'bool' && (expr.op === '==' || expr.op === '!='))
            return this.result('bool', () => { this.lane(a, 0); this.lane(b, 0); this.emit(expr.op === '==' ? 0x46 : 0x47) })
          expectType(a.type, 'f32', expr.line); expectType(b.type, 'f32', expr.line)
          return this.result('bool', () => { this.lane(a, 0); this.lane(b, 0); this.emit(compare[expr.op]!) })
        }
        return fail(expr.line, `operator ${expr.op} is not supported by the shader subset`)
      }
      case 'call': return this.call(expr)
    }
  }
  private call(expr: Extract<Expr, { kind: 'call' }>): Value {
    if (expr.comptimeArgs.length) fail(expr.line, 'compile-time arguments are not supported by the shader subset')
    const args = expr.args.map(e => this.expression(e)), name = expr.callee
    const arity = (count: number) => { if (args.length !== count) fail(expr.line, `${name} expects ${count} arguments, got ${args.length}`) }
    if (name === 'vec2' || name === 'vec3' || name === 'vec4') {
      if (!args.length || args.some(a => !numeric(a.type))) fail(expr.line, `${name} needs numeric components`)
      const slots = args.flatMap(a => a.slots), n = Number(name[3])
      if (slots.length === 1) return { type: name, slots: Array(n).fill(slots[0]) }
      if (slots.length !== n) fail(expr.line, `${name} needs one scalar or exactly ${n} components`)
      return { type: name, slots }
    }
    if (['sin', 'cos', 'abs', 'sqrt', 'floor', 'fract', 'saturate'].includes(name)) {
      arity(1); const a = args[0]!, t = this.shape(args, expr.line)
      if (name === 'sin' || name === 'cos') this.extraWork += width(t) * 96
      return this.result(t, i => {
        this.lane(a, i)
        if (name === 'sin' || name === 'cos') this.emit(0x10, name === 'sin' ? 1 : 2)
        else if (name === 'fract') { this.lane(a, i); this.emit(0x8e, 0x93) }
        else if (name === 'saturate') { this.constant(0); this.emit(0x97); this.constant(1); this.emit(0x96) }
        else this.emit(({ abs: 0x8b, sqrt: 0x91, floor: 0x8e } as Record<string, number>)[name]!)
      })
    }
    if (name === 'min' || name === 'max' || name === 'clamp' || name === 'lerp') {
      arity(name === 'min' || name === 'max' ? 2 : 3)
      const t = this.shape(args, expr.line), a = args[0]!, b = args[1]!, c = args[2]
      return this.result(t, i => {
        this.lane(a, i)
        if (name === 'lerp') {
          this.lane(b, i); this.lane(a, i); this.emit(0x93); this.lane(c!, i); this.emit(0x94, 0x92)
        } else {
          this.lane(b, i); this.emit(name === 'min' ? 0x96 : 0x97)
          if (name === 'clamp') { this.lane(c!, i); this.emit(0x96) }
        }
      })
    }
    if (name === 'dot' || name === 'length' || name === 'normalize') {
      arity(name === 'dot' ? 2 : 1)
      const a = args[0]!, b = name === 'dot' ? args[1]! : a
      if (width(a.type) === 1 || a.type !== b.type) fail(expr.line, `${name} needs matching vectors`)
      const magnitude = this.result('f32', () => {
        for (let i = 0; i < width(a.type); i++) { this.lane(a, i); this.lane(b, i); this.emit(0x94); if (i) this.emit(0x92) }
        if (name !== 'dot') this.emit(0x91)
      })
      if (name !== 'normalize') return magnitude
      return this.result(a.type, i => {
        // A zero vector normalizes to zero, without a NaN intermediate escaping.
        this.lane(magnitude, 0); this.constant(0); this.emit(0x5b, 0x04, F32)
        this.constant(0); this.emit(0x05); this.lane(a, i); this.lane(magnitude, 0); this.emit(0x95, 0x0b)
      })
    }
    const callee = this.definitions.get(name)
    if (!callee) return fail(expr.line, `unknown or unsupported shader function ${name}`)
    arity(callee.parameters.length)
    args.forEach((a, i) => expectType(a.type, callee.parameters[i]!, expr.line))
    args.forEach(a => a.slots.forEach(slot => this.get(slot)))
    this.emit(0x10, ...u32(callee.index)); this.fn.calls.push(name)
    const slots = wasmTypes(callee.result).map(t => { const slot = this.parameterCount + this.locals.length; this.locals.push(t); return slot })
    for (const slot of [...slots].reverse()) this.set(slot)
    return { type: callee.result, slots }
  }
}

// Builtin approximation: f64 range reduction followed by a degree-11 f32 sine
// polynomial on [-pi/2,pi/2]. Source operations and the public math ABI stay f32.
// This is approximate graphics math, not correctly-rounded libm for huge inputs.
function mathBodies(): Body[] {
  const c: number[] = [], emit = (...b: number[]) => c.push(...b)
  const get = (i: number) => emit(0x20, i), set = (i: number) => emit(0x21, i)
  const f = (v: number) => emit(0x43, ...floatBytes(v, false))
  const d = (v: number) => emit(0x44, ...floatBytes(v, true))
  get(0); get(0); d(Math.PI * 2); emit(0xa3, 0x9e); d(Math.PI * 2); emit(0xa2, 0xa1, 0xb6)
  // Huge phases lose range-reduction accuracy; keep finite inputs bounded even
  // there. No high-precision phase guarantee is made beyond ordinary graphics use.
  f(-Math.PI); emit(0x97); f(Math.PI); emit(0x96); set(1)
  f(Math.PI / 2); get(1); emit(0x8b); f(Math.PI / 2); emit(0x93, 0x8b, 0x93); set(2)
  get(2); get(2); emit(0x94); set(3)
  f(-1 / 39916800)
  for (const coefficient of [1 / 362880, -1 / 5040, 1 / 120, -1 / 6, 1]) {
    get(3); emit(0x94); f(coefficient); emit(0x92)
  }
  get(2); emit(0x94); get(1); emit(0x98, 0x0b)
  const sine: Body = { parameters: [F64], results: [F32], locals: [F32, F32, F32], code: c }
  const sin: Body = { parameters: [F32], results: [F32], locals: [], code: [0x20, 0, 0xbb, 0x10, 0, 0x0b] }
  const cos: Body = { parameters: [F32], results: [F32], locals: [],
    code: [0x20, 0, 0xbb, 0x44, ...floatBytes(Math.PI / 2, true), 0xa0, 0x10, 0, 0x0b] }
  // NaN -> 0, infinities saturate; channel packing cannot trap on shader output.
  const pack: Body = { parameters: [F32], results: [I32], locals: [], code: [
    0x20, 0, 0x20, 0, 0x5c, 0x04, I32, 0x41, 0, 0x05,
    0x20, 0, 0x43, ...floatBytes(0, false), 0x97, 0x43, ...floatBytes(1, false), 0x96,
    0x43, ...floatBytes(255, false), 0x94, 0x90, 0xa8, 0x0b, 0x0b,
  ] }
  return [sine, sin, cos, pack]
}

function renderBody(pixel: number): Body {
  const code: number[] = [], emit = (...b: number[]) => code.push(...b)
  const get = (i: number) => emit(0x20, i), set = (i: number) => emit(0x21, i)
  const integer = (n: number) => emit(0x41, ...s32(n)), f = (n: number) => emit(0x43, ...floatBytes(n, false))
  // params: width,height,time,startY,endY. locals: x,y,address,r,g,b,a,v.
  const checks: [number, number, number | 'height' | 'end'][] = [
    [0, 0x4c, 0], [0, 0x4a, SHADER_LIMITS.dimension], [1, 0x4c, 0],
    [1, 0x4a, SHADER_LIMITS.dimension], [3, 0x48, 0], [4, 0x4a, 'height'], [3, 0x4a, 'end'],
  ]
  checks.forEach(([slot, opcode, bound], i) => {
    get(slot); if (bound === 'height') get(1); else if (bound === 'end') get(4); else integer(bound)
    emit(opcode); if (i) emit(0x72)
  })
  emit(0x04, 0x40, 0x00, 0x0b)
  get(3); set(6); emit(0x02, 0x40, 0x03, 0x40)
  get(6); get(4); emit(0x4e, 0x0d, 1)
  get(6); emit(0xb2); f(.5); emit(0x92); get(1); emit(0xb2, 0x95); set(12)
  integer(0); set(5); emit(0x02, 0x40, 0x03, 0x40)
  get(5); get(0); emit(0x4e, 0x0d, 1)
  get(5); emit(0xb2); f(.5); emit(0x92); get(0); emit(0xb2, 0x95)
  get(12); get(2); emit(0x10, ...u32(pixel)); set(11); set(10); set(9); set(8)
  get(6); get(0); emit(0x6c); get(5); emit(0x6a); integer(4); emit(0x6c); set(7)
  for (let channel = 0; channel < 4; channel++) {
    get(7); integer(channel); emit(0x6a); get(channel + 8); emit(0x10, 3, 0x3a, 0, 0)
  }
  get(5); integer(1); emit(0x6a); set(5); emit(0x0c, 0, 0x0b, 0x0b)
  get(6); integer(1); emit(0x6a); set(6); emit(0x0c, 0, 0x0b, 0x0b, 0x0b)
  return { parameters: [I32, I32, F32, I32, I32], results: [],
    locals: [I32, I32, I32, F32, F32, F32, F32, F32], code }
}

function u32(value: number): number[] {
  const bytes: number[] = []
  do { const b = value & 127; value >>>= 7; bytes.push(b | (value ? 128 : 0)) } while (value)
  return bytes
}
function s32(value: number): number[] {
  const bytes: number[] = []
  while (true) {
    const b = value & 127; value >>= 7
    const done = (value === 0 && !(b & 64)) || (value === -1 && !!(b & 64))
    bytes.push(b | (done ? 0 : 128)); if (done) return bytes
  }
}
function floatBytes(value: number, double: boolean): number[] {
  const bytes = new Uint8Array(double ? 8 : 4), view = new DataView(bytes.buffer)
  if (double) view.setFloat64(0, value, true); else view.setFloat32(0, value, true)
  return [...bytes]
}
function vector(entries: number[][]): number[] { return [...u32(entries.length), ...entries.flat()] }
function textBytes(text: string): number[] { const bytes = [...new TextEncoder().encode(text)]; return [...u32(bytes.length), ...bytes] }
function section(id: number, contents: number[]): number[] { return [id, ...u32(contents.length), ...contents] }
function moduleBytes(bodies: Body[], exports: { name: string; kind: number; index: number }[]): Uint8Array<ArrayBuffer> {
  const signatures: number[][] = [], indices = new Map<string, number>()
  const functionTypes = bodies.map(body => {
    const key = `${body.parameters}/${body.results}`
    if (!indices.has(key)) {
      indices.set(key, signatures.length)
      signatures.push([0x60, ...u32(body.parameters.length), ...body.parameters, ...u32(body.results.length), ...body.results])
    }
    return u32(indices.get(key)!)
  })
  const encodedBodies = bodies.map(body => {
    const groups: { type: WasmType; count: number }[] = []
    for (const t of body.locals) {
      const last = groups[groups.length - 1]
      if (last?.type === t) last.count++; else groups.push({ type: t, count: 1 })
    }
    const contents = [...vector(groups.map(g => [...u32(g.count), g.type])), ...body.code]
    return [...u32(contents.length), ...contents]
  })
  return new Uint8Array([
    0, 97, 115, 109, 1, 0, 0, 0,
    ...section(1, vector(signatures)), ...section(3, vector(functionTypes)),
    ...section(5, vector([[1, ...u32(SHADER_LIMITS.memoryPages), ...u32(SHADER_LIMITS.memoryPages)]])),
    ...section(7, vector(exports.map(e => [...textBytes(e.name), e.kind, ...u32(e.index)]))),
    ...section(10, vector(encodedBodies)),
  ])
}
