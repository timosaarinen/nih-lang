export type TokenKind =
  | 'name' | 'number' | 'string' | 'newline' | 'indent' | 'dedent' | 'eof'
  | '(' | ')' | ',' | ':' | 'arrow' | '=' | ':=' | '.'
  | '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '&&' | '||' | '!'

export interface Token {
  kind: TokenKind
  text: string
  line: number
  column: number
}

const twoChar = new Set(['->', ':=', '==', '!=', '<=', '>=', '&&', '||'])
const oneChar = new Set(['(', ')', ',', ':', '=', '.', '+', '-', '*', '/', '%', '<', '>', '!'])

export function lex(source: string): Token[] {
  const tokens: Token[] = []
  const indents = [0]
  const lines = source.replace(/\r\n?/g, '\n').split('\n')

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const raw = lines[lineIndex] ?? ''
    const line = lineIndex + 1
    if (/\t/.test(raw.match(/^\s*/)?.[0] ?? '')) throw new Error(`line ${line}: tabs are not allowed`)
    const withoutComment = stripComment(raw)
    if (withoutComment.trim() === '') continue

    const indent = withoutComment.match(/^ */)?.[0].length ?? 0
    const current = indents[indents.length - 1] ?? 0
    if (indent > current) {
      indents.push(indent)
      tokens.push({ kind: 'indent', text: '', line, column: 1 })
    } else if (indent < current) {
      while (indent < (indents[indents.length - 1] ?? 0)) {
        indents.pop()
        tokens.push({ kind: 'dedent', text: '', line, column: 1 })
      }
      if (indent !== (indents[indents.length - 1] ?? 0)) throw new Error(`line ${line}: inconsistent indentation`)
    }

    let i = indent
    while (i < withoutComment.length) {
      const c = withoutComment[i]!
      if (c === ' ') { i++; continue }
      const column = i + 1
      const pair = withoutComment.slice(i, i + 2)
      if (twoChar.has(pair)) {
        tokens.push({ kind: pair === '->' ? 'arrow' : pair as TokenKind, text: pair, line, column })
        i += 2
        continue
      }
      if (oneChar.has(c)) {
        tokens.push({ kind: c as TokenKind, text: c, line, column })
        i++
        continue
      }
      if (c === '"' || c === "'") {
        const quote = c
        i++
        let value = ''
        while (i < withoutComment.length && withoutComment[i] !== quote) {
          if (withoutComment[i] === '\\') {
            const n = withoutComment[++i]
            if (n === undefined) throw new Error(`line ${line}: unterminated escape`)
            value += n === 'n' ? '\n' : n === 't' ? '\t' : n
            i++
          } else {
            value += withoutComment[i++]
          }
        }
        if (withoutComment[i] !== quote) throw new Error(`line ${line}: unterminated string`)
        i++
        tokens.push({ kind: 'string', text: value, line, column })
        continue
      }
      const number = withoutComment.slice(i).match(/^(?:\d+\.\d*|\d*\.\d+|\d+)(?:[eE][+-]?\d+)?/)
      if (number) {
        tokens.push({ kind: 'number', text: number[0], line, column })
        i += number[0].length
        continue
      }
      const name = withoutComment.slice(i).match(/^[A-Za-z_][A-Za-z0-9_-]*/)
      if (name) {
        tokens.push({ kind: 'name', text: name[0], line, column })
        i += name[0].length
        continue
      }
      throw new Error(`line ${line}:${column}: unexpected character ${JSON.stringify(c)}`)
    }
    tokens.push({ kind: 'newline', text: '', line, column: withoutComment.length + 1 })
  }

  const finalLine = lines.length
  while (indents.length > 1) {
    indents.pop()
    tokens.push({ kind: 'dedent', text: '', line: finalLine, column: 1 })
  }
  tokens.push({ kind: 'eof', text: '', line: finalLine, column: 1 })
  return tokens
}

function stripComment(line: string): string {
  let quote: string | null = null
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i]!
    if ((c === '"' || c === "'") && line[i - 1] !== '\\') quote = quote === c ? null : quote ?? c
    if (!quote && c === '/' && line[i + 1] === '/') return line.slice(0, i)
  }
  return line
}
