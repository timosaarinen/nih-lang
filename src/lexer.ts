export type TokenKind =
  | 'name' | 'number' | 'string' | 'eof'
  | '(' | ')' | '{' | '}' | ',' | ';' | ':' | 'arrow' | '=' | ':=' | '.'
  | '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '&&' | '||' | '!'

export interface Token {
  kind: TokenKind
  text: string
  line: number
  column: number
}

const twoChar = new Set(['->', ':=', '==', '!=', '<=', '>=', '&&', '||'])
const oneChar = new Set(['(', ')', '{', '}', ',', ';', ':', '=', '.', '+', '-', '*', '/', '%', '<', '>', '!'])

export function lex(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let line = 1
  let column = 1

  const push = (kind: TokenKind, text: string, startLine = line, startColumn = column) => {
    tokens.push({ kind, text, line: startLine, column: startColumn })
  }
  const advance = () => {
    const c = source[i++]
    if (c === '\n') { line++; column = 1 }
    else column++
    return c
  }

  while (i < source.length) {
    const c = source[i]!

    if (/\s/.test(c)) { advance(); continue }

    if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') advance()
      continue
    }

    if (c === '/' && source[i + 1] === '*') {
      const startLine = line, startColumn = column
      advance(); advance()
      let closed = false
      while (i < source.length) {
        if (source[i] === '*' && source[i + 1] === '/') {
          advance(); advance(); closed = true; break
        }
        advance()
      }
      if (!closed) throw new Error(`line ${startLine}:${startColumn}: unterminated block comment`)
      continue
    }

    const startLine = line, startColumn = column
    const pair = source.slice(i, i + 2)
    if (twoChar.has(pair)) {
      advance(); advance()
      push(pair === '->' ? 'arrow' : pair as TokenKind, pair, startLine, startColumn)
      continue
    }

    if (oneChar.has(c)) {
      advance()
      push(c as TokenKind, c, startLine, startColumn)
      continue
    }

    if (c === '"' || c === "'") {
      const quote = advance()!
      let value = ''
      let closed = false
      while (i < source.length) {
        const ch = advance()!
        if (ch === quote) { closed = true; break }
        if (ch === '\\') {
          if (i >= source.length) break
          const n = advance()!
          value += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n
        } else value += ch
      }
      if (!closed) throw new Error(`line ${startLine}:${startColumn}: unterminated string`)
      push('string', value, startLine, startColumn)
      continue
    }

    const number = source.slice(i).match(/^(?:\d+\.\d*|\d*\.\d+|\d+)(?:[eE][+-]?\d+)?/)
    if (number) {
      for (let n = 0; n < number[0].length; n++) advance()
      push('number', number[0], startLine, startColumn)
      continue
    }

    const name = source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/)
    if (name) {
      for (let n = 0; n < name[0].length; n++) advance()
      push('name', name[0], startLine, startColumn)
      continue
    }

    throw new Error(`line ${line}:${column}: unexpected character ${JSON.stringify(c)}`)
  }

  tokens.push({ kind: 'eof', text: '', line, column })
  return tokens
}
