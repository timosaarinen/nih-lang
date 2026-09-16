import type { Expr, FunctionDecl, Param, Program, Stmt, Target, TypeName } from './ast.js'
import { lex, type Token, type TokenKind } from './lexer.js'

const typeNames = new Set<TypeName>(['i32', 'u32', 'f32', 'bool', 'string', 'void', 'vec2', 'vec3', 'vec4'])

export function parse(source: string): Program {
  return new Parser(lex(source)).program()
}

class Parser {
  private i = 0
  constructor(private readonly tokens: Token[]) {}

  program(): Program {
    const functions: FunctionDecl[] = []
    this.skipNewlines()
    while (!this.at('eof')) {
      functions.push(this.functionDecl())
      this.skipNewlines()
    }
    return { functions }
  }

  private functionDecl(): FunctionDecl {
    const line = this.peek().line
    let target: Target = 'shared'
    if (this.atName('cpu') || this.atName('gpu')) target = this.take().text as Target
    if (!(this.atName('fn') || this.atName('fun'))) this.fail(`expected fn`)
    this.take()
    const name = this.expect('name').text
    this.expect('(')
    const params: Param[] = []
    if (!this.at(')')) {
      do {
        const paramName = this.expect('name').text
        this.expect(':')
        const type = this.parseType()
        params.push({ name: paramName, type })
      } while (this.maybe(','))
    }
    this.expect(')')
    let returnType: TypeName = 'void'
    if (this.maybe('arrow')) returnType = this.parseType()
    this.expect('newline')
    this.expect('indent')
    const body = this.block()
    return { target, name, params, returnType, body, line }
  }

  private block(): Stmt[] {
    const out: Stmt[] = []
    this.skipNewlines()
    while (!this.at('dedent') && !this.at('eof')) {
      out.push(this.statement())
      this.skipNewlines()
    }
    this.expect('dedent')
    return out
  }

  private statement(): Stmt {
    const line = this.peek().line
    if (this.atName('return')) {
      this.take()
      if (this.at('newline')) {
        this.take()
        return { kind: 'return', line }
      }
      const value = this.expression()
      this.expect('newline')
      return { kind: 'return', value, line }
    }
    if (this.atName('if')) {
      this.take()
      const condition = this.expression()
      this.expect('newline')
      this.expect('indent')
      const thenBody = this.block()
      let elseBody: Stmt[] = []
      if (this.atName('else')) {
        this.take()
        this.expect('newline')
        this.expect('indent')
        elseBody = this.block()
      }
      return { kind: 'if', condition, thenBody, elseBody, line }
    }
    if (this.at('name') && (this.peek(1).kind === '=' || this.peek(1).kind === ':=')) {
      const name = this.take().text
      const mutable = this.take().kind === ':='
      const value = this.expression()
      this.expect('newline')
      return { kind: 'bind', name, mutable, value, line }
    }
    const expr = this.expression()
    this.expect('newline')
    return { kind: 'expr', expr, line }
  }

  private expression(minPrec = 0): Expr {
    let left = this.prefix()
    while (true) {
      const op = this.peek().kind
      const prec = precedence(op)
      if (prec < minPrec) break
      const token = this.take()
      const right = this.expression(prec + 1)
      left = { kind: 'binary', op: token.text, left, right, line: token.line }
    }
    return left
  }

  private prefix(): Expr {
    const token = this.take()
    let expr: Expr
    if (token.kind === 'number') expr = { kind: 'number', value: Number(token.text), raw: token.text, line: token.line }
    else if (token.kind === 'string') expr = { kind: 'string', value: token.text, line: token.line }
    else if (token.kind === 'name' && (token.text === 'true' || token.text === 'false')) expr = { kind: 'bool', value: token.text === 'true', line: token.line }
    else if (token.kind === 'name') expr = { kind: 'name', name: token.text, line: token.line }
    else if (token.kind === '-' || token.kind === '!') expr = { kind: 'unary', op: token.kind, value: this.expression(8), line: token.line }
    else if (token.kind === '(') {
      expr = this.expression()
      this.expect(')')
    } else this.failAt(token, 'expected expression')

    while (true) {
      if (this.maybe('(')) {
        if (expr.kind !== 'name') this.fail('only named functions can be called in bootstrap NIH')
        const args: Expr[] = []
        if (!this.at(')')) {
          do args.push(this.expression())
          while (this.maybe(','))
        }
        this.expect(')')
        expr = { kind: 'call', callee: expr.name, args, line: expr.line }
      } else if (this.maybe('.')) {
        const fields = this.expect('name').text
        expr = { kind: 'swizzle', value: expr, fields, line: expr.line }
      } else break
    }
    return expr
  }

  private parseType(): TypeName {
    const token = this.expect('name')
    if (!typeNames.has(token.text as TypeName)) this.failAt(token, `unknown type ${token.text}`)
    return token.text as TypeName
  }

  private skipNewlines(): void { while (this.maybe('newline')) {} }
  private at(kind: TokenKind): boolean { return this.peek().kind === kind }
  private atName(text: string): boolean { return this.at('name') && this.peek().text === text }
  private maybe(kind: TokenKind): boolean { if (!this.at(kind)) return false; this.i++; return true }
  private expect(kind: TokenKind): Token { const token = this.take(); if (token.kind !== kind) this.failAt(token, `expected ${kind}, got ${token.kind}`); return token }
  private take(): Token { return this.tokens[this.i++] ?? this.tokens[this.tokens.length - 1]! }
  private peek(ahead = 0): Token { return this.tokens[this.i + ahead] ?? this.tokens[this.tokens.length - 1]! }
  private fail(message: string): never { return this.failAt(this.peek(), message) }
  private failAt(token: Token, message: string): never { throw new Error(`line ${token.line}:${token.column}: ${message}`) }
}

function precedence(kind: TokenKind): number {
  switch (kind) {
    case '||': return 1
    case '&&': return 2
    case '==': case '!=': return 3
    case '<': case '<=': case '>': case '>=': return 4
    case '+': case '-': return 5
    case '*': case '/': case '%': return 6
    default: return -1
  }
}
