import { stripNewlines } from "./util.js";

type TokenType = 
  'ident' |   // identifier, name in value e.g. "foobar"
  'string' |  // literal string, content in value e.g. "Hello, World!"
  'number' |  // number literal, string representation in value e.g. "42" or "3.141592"
  'op';       // all one or two character operators - in value e.g. '+', '-', '?', '(', '&&'

type Token = {
  type: TokenType;
  value: string;
  posStartEnd: [number, number];
};

export class Lexer {
  private current: number = 0;
  private tokens: Token[] = [];
  private source: string = "";
  private lineStart: number[] = [];
  private filename: string;
  private sexpr: boolean;

  constructor(source: string = "", filename: string) {
    this.sexpr = filename.endsWith('.nih.sexpr');
    this.source = source;
    this.filename = filename;
    this.tokenize();
  }
  public nih() : boolean { return !this.sexpr; }

  private tokenize() {
    const src = this.source;

    this.tokens = [];
    this.lineStart = [0];
    this.current = 0;

    const pushTokenOp = (op: string, pos: number) => 
      this.tokens.push({type: 'op', value: op, posStartEnd: [pos, pos]});
    const pushTokenRange = (type: TokenType, value: string, start: number, end: number) => 
      this.tokens.push({type: type, value, posStartEnd: [start, end]});
  
    const isLetter = (char: string) => /[a-zA-Z_]/.test(char);
    const isDigit = (char: string) => /[0-9]/.test(char);

    let index = 0;
    while (index < src.length) {
      let char = src[index];

      if (char === '\n') { index++; this.lineStart.push(index); continue; }
      if (/\s/.test(char)) { index++; continue; } // whitespace

      if (char === '(') { pushTokenOp('(', index++); continue; }
      if (char === ')') { pushTokenOp(')', index++); continue; }
      if (char === '+') { pushTokenOp('+', index++); continue; }
      if (char === '-') { pushTokenOp('-', index++); continue; }
      if (char === '*') { pushTokenOp('*', index++); continue; }
      if (char === '/') { pushTokenOp('/', index++); continue; }

      if (isLetter(char)) {
        let start = index;
        index++;
        while (isLetter(src[index]) || isDigit(src[index])) {
          index++;
        }
        const value = src.slice(start, index);
        pushTokenRange('ident', value, start, index);
        continue;
      }

      if (isDigit(char)) {
        let start = index;
        index++;
        while (isDigit(src[index])) {
          index++;
        }
        const value = src.slice(start, index);
        pushTokenRange('number', value, start, index);
        continue;
      }

      // NOTE: string interpolation is a native macro handled by parser
      if ("'\"`".includes(char)) {
        let start = ++index;
        while (index < src.length && src[index] !== char) { 
          index++;
        }
        const value = src.slice(start, index);
        pushTokenRange('string', value, start - 1, index + 1);
        index++;
        continue;
      }

      throw new Error(`${this.infoPrefix()} Unknown token: ${char}`);
    }
  }

  public peekTokenCanBeEofNull(lookahead: number = 0): Token | null {
    const position = this.current + lookahead;
    return position < this.tokens.length ? this.tokens[position] : null;
  }
  public peekToken(lookahead: number = 0): Token {
    const position = this.current + lookahead;
    if (position >= this.tokens.length) {
      this.error("Unexpected end-of-file after", this.tokens[this.current + lookahead - 1]);
    }
    return this.tokens[position];
  }

  public eatToken(expectedType?: TokenType, expectedValue? : string): Token {
    if (this.current < this.tokens.length) {
      let t = this.tokens[this.current++];
      if (expectedValue && t.value !== expectedValue) this.error(`Expected ${expectedValue}, got ${t.value}`, t);
      if (expectedType && t.type != expectedType) this.error(`Expected token of type ${expectedType}, got ${t}`, t);
      return t;
    } else {
      this.error("Unexpected end-of-file after", this.tokens[this.current - 1]);
    }
  }
  public eatTokenIfType(expectedType: TokenType, expectedValue? : string): Token | null {
    if (this.current < this.tokens.length) {
      let t = this.tokens[this.current];
      if (t.type !== expectedType) return null;
      if (expectedValue && t.value !== expectedValue) return null;
      this.current++;
      return t;
    } else {
      this.error("Unexpected end-of-file after", this.tokens[this.current - 1]);
    }
  }

  public pos(): Number {
    return this.current;
  }

  public addToSource(line: string, pos?: number) {
    if(pos) {
      this.source.slice(0, pos);
    }
    this.source += line;
    this.tokenize();
  }

  public debugDump() {
    for(let tok = this.eatToken(); tok; tok = this.eatToken()) {
      console.log(tok);
    }
    this.current = 0; 
  }

  public getLineAndColumn(position: number): { line: number, column: number } {
    for (let i = 0; i < this.lineStart.length; i++) {
      // Check if the position is in the current line
      if (this.lineStart[i] > position) {
        // Position is in the previous line
        const line = i;
        const column = position - this.lineStart[i - 1];
        return { line, column };
      }
    }

    // If the position is in the last line
    if (position >= this.lineStart[this.lineStart.length - 1]) {
      const line = this.lineStart.length;
      const column = position - this.lineStart[line - 1];
      return { line, column };
    }

    // If position is not found (which should not happen), return line and column as 0
    return { line: 0, column: 0 };
  }

  public line(pos: number)   : string { return this.getLineAndColumn(pos).line.toString(); }
  public column(pos: number) : string { return this.getLineAndColumn(pos).column.toString(); }

  public infoPrefix() {
    return `[${this.filename}:${this.line(this.current)}:${this.column(this.current)}]`
  }

  public errorLine(err: string, start: number, end: number): never {
    const errorMarkerChar = "^";
    const { line, column } = this.getLineAndColumn(start);
    const lineStartIndex = this.lineStart[line - 1];
    const lineEndIndex = this.lineStart[line] || this.source.length;
    const errorLine = this.source.substring(lineStartIndex, lineEndIndex);

    let highlightLine = "".padStart(column - 1) + errorMarkerChar.repeat(end - start);   
    if(end === start) {
        highlightLine += errorMarkerChar;
    }

    console.log("*************************** NIH! *****************************************");
    console.log(`ERROR:${this.filename}:${this.line(this.current)}:${this.column(this.current)}: ${err}:`);
    console.log(stripNewlines(errorLine));
    console.log(highlightLine);
  
    throw new Error("Compilation failed.");
  }

  public error(err: string, token?: Token): never {
    if(token) {
      this.errorLine(err, token.posStartEnd[0], token.posStartEnd[1]);
    } else {
      this.errorLine(err, this.current, this.current);
    }
  }
}
