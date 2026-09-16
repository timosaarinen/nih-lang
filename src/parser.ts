import type { ComptimeParam, ComptimeType, Expr, FunctionDecl, Param, Program, Stmt, Target, TypeName } from './ast.js'
import { lex, type Token, type TokenKind } from './lexer.js'

const typeNames = new Set<TypeName>(['i32', 'u32', 'f32', 'bool', 'string', 'void', 'vec2', 'vec3', 'vec4'])
const comptimeTypes = new Set<ComptimeType>(['i32', 'u32', 'f32', 'bool'])
export function parse(source: string): Program { return new Parser(lex(source)).program() }

class Parser {
  private i = 0
  constructor(private readonly tokens: Token[]) {}
  program(): Program { const functions: FunctionDecl[] = []; while (!this.at('eof')) functions.push(this.functionDecl()); return { functions } }

  private functionDecl(): FunctionDecl {
    const line = this.peek().line
    let target: Target = 'shared'
    if (this.atName('cpu') || this.atName('gpu')) target = this.take().text as Target
    if (!(this.atName('fn') || this.atName('fun'))) this.fail('expected fn')
    this.take(); const name = this.expect('name').text
    const comptimeParams: ComptimeParam[] = []
    if (this.maybe('[')) {
      if (!this.at(']')) do {
        const n = this.expect('name').text; this.expect(':'); const t = this.parseComptimeType(); comptimeParams.push({ name: n, type: t })
      } while (this.maybe(','))
      this.expect(']')
    }
    this.expect('(')
    const params: Param[] = []
    if (!this.at(')')) { do { const n = this.expect('name').text; this.expect(':'); params.push({ name: n, type: this.parseType() }) } while (this.maybe(',')) }
    this.expect(')')
    let returnType: TypeName = 'void'; if (this.maybe('arrow')) returnType = this.parseType()
    return { target, name, comptimeParams, params, returnType, body: this.bracedBlock(), line }
  }

  private bracedBlock(): Stmt[] { this.expect('{'); const out: Stmt[] = []; while (!this.at('}') && !this.at('eof')) out.push(this.statement()); this.expect('}'); return out }
  private statement(): Stmt {
    const line = this.peek().line
    if (this.atName('return')) { this.take(); if (this.maybe(';')) return { kind: 'return', line }; const value = this.expression(); this.expect(';'); return { kind: 'return', value, line } }
    if (this.atName('comptime') && this.peek(1).kind === 'name' && this.peek(1).text === 'if') { this.take(); this.take(); return this.ifStatement(line, true) }
    if (this.atName('if')) { this.take(); return this.ifStatement(line, false) }
    if (this.at('name') && (this.peek(1).kind === '=' || this.peek(1).kind === ':=')) { const name = this.take().text; const mutable = this.take().kind === ':='; const value = this.expression(); this.expect(';'); return { kind: 'bind', name, mutable, value, line } }
    const expr = this.expression(); if (!this.at('}')) this.expect(';'); else this.maybe(';'); return { kind: 'expr', expr, line }
  }
  private ifStatement(line: number, comptime: boolean): Stmt {
    const condition = this.expression(); const thenBody = this.bracedBlock(); let elseBody: Stmt[] = []
    if (this.atName('else')) { this.take(); elseBody = this.bracedBlock() }
    return comptime ? { kind: 'comptime-if', condition, thenBody, elseBody, line } : { kind: 'if', condition, thenBody, elseBody, line }
  }

  private expression(minPrec = 0): Expr {
    let left = this.prefix()
    while (true) { const op = this.peek().kind, prec = precedence(op); if (prec < minPrec) break; const token = this.take(); const right = this.expression(prec + 1); left = { kind: 'binary', op: token.text, left, right, line: token.line } }
    return left
  }
  private prefix(): Expr {
    const token = this.take(); let expr: Expr
    if (token.kind === 'number') expr = { kind: 'number', value: Number(token.text), raw: token.text, line: token.line }
    else if (token.kind === 'string') expr = { kind: 'string', value: token.text, line: token.line }
    else if (token.kind === 'name' && (token.text === 'true' || token.text === 'false')) expr = { kind: 'bool', value: token.text === 'true', line: token.line }
    else if (token.kind === 'name') expr = { kind: 'name', name: token.text, line: token.line }
    else if (token.kind === '-' || token.kind === '!') expr = { kind: 'unary', op: token.kind, value: this.expression(8), line: token.line }
    else if (token.kind === '(') { expr = this.expression(); this.expect(')') }
    else this.failAt(token, 'expected expression')

    while (true) {
      let comptimeArgs: Expr[] = []
      if (this.maybe('[')) {
        if (expr.kind !== 'name') this.fail('compile-time arguments require a named function')
        if (!this.at(']')) { do { comptimeArgs.push(this.expression()) } while (this.maybe(',')) }
        this.expect(']'); this.expect('('); expr = this.finishCall(expr, comptimeArgs); continue
      }
      if (this.maybe('(')) { if (expr.kind !== 'name') this.fail('only named functions can be called in bootstrap NIH'); expr = this.finishCall(expr, comptimeArgs); continue }
      if (this.maybe('.')) { const fields = this.expect('name').text; expr = { kind: 'swizzle', value: expr, fields, line: expr.line }; continue }
      break
    }
    return expr
  }
  private finishCall(expr: Extract<Expr, {kind:'name'}>, comptimeArgs: Expr[]): Expr {
    const args: Expr[] = []; if (!this.at(')')) { do { args.push(this.expression()) } while (this.maybe(',')) } this.expect(')')
    return { kind: 'call', callee: expr.name, comptimeArgs, args, line: expr.line }
  }
  private parseType(): TypeName { const t = this.expect('name'); if (!typeNames.has(t.text as TypeName)) this.failAt(t, `unknown type ${t.text}`); return t.text as TypeName }
  private parseComptimeType(): ComptimeType { const t = this.expect('name'); if (!comptimeTypes.has(t.text as ComptimeType)) this.failAt(t, `compile-time parameter type must be i32/u32/f32/bool, got ${t.text}`); return t.text as ComptimeType }
  private at(kind: TokenKind): boolean { return this.peek().kind === kind }
  private atName(text: string): boolean { return this.at('name') && this.peek().text === text }
  private maybe(kind: TokenKind): boolean { if (!this.at(kind)) return false; this.i++; return true }
  private expect(kind: TokenKind): Token { const t = this.take(); if (t.kind !== kind) this.failAt(t, `expected ${kind}, got ${t.kind}`); return t }
  private take(): Token { return this.tokens[this.i++] ?? this.tokens[this.tokens.length - 1]! }
  private peek(ahead = 0): Token { return this.tokens[this.i + ahead] ?? this.tokens[this.tokens.length - 1]! }
  private fail(message: string): never { return this.failAt(this.peek(), message) }
  private failAt(token: Token, message: string): never { throw new Error(`line ${token.line}:${token.column}: ${message}`) }
}
function precedence(kind: TokenKind): number { switch (kind) { case '||': return 1; case '&&': return 2; case '==': case '!=': return 3; case '<': case '<=': case '>': case '>=': return 4; case '+': case '-': return 5; case '*': case '/': case '%': return 6; default: return -1 } }
