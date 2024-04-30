import { log, isDigit, isLetter, parseName, nextLineStart, strToEndOfLine, stripNewlines, strmatch } from './util';
import { isKeyword, matchKeyword, matchOperator } from './langdef';

function debug(...args: any[]) { 
  log('LEXER:', ...args); // DEBUG: uncomment to enable debug logging
}

export type TokenClass =
  | 'eof'     // Code stream end
  | 'kw'      // .str, NIH language keywords and operators, e.g. 'let', 'fn', '+', '-', '?', '(', '&&'
  | 'ident'   // .str, identifier, e.g. 'foobar'
  | 'strlit'  // .str, string literal, e.g. "Hello, World!"
  | 'numlit'  // .str, number literal, e.g. '42' or '3.141592'
  | 'type'    // .str/.rtype, type annotation, e.g. ':int' -> 'int'

export type Token = {
  cls: TokenClass;                // token class
  str: string;                    // the string representation of token, 'let', 'foobar', 'Hello, world!', '3.14', '(', 'int'
  posStartEnd: [number, number];  // src[start..end]
};

export function pushtoken(tokens: Token[], cls: TokenClass, str: string, start: number, end: number) { tokens.push({ cls: cls, str, posStartEnd: [start, end] }) }
export function eoftoken(index: number): Token { return { cls: 'eof', str: 'EOF', posStartEnd: [index, index] } }
export function iseof(token: Token): boolean { return token.cls === 'eof' }

//------------------------------------------------------------------------
//  TODO: no classes.
//------------------------------------------------------------------------
export class Lexer {
  public tokens: Token[] = [];
  private current: number = 0;
  private source: string = "";
  private lineStart: number[] = new Array<number>(0); //[];
  private filename: string;
  
  constructor(source: string = "", filename: string) {
    this.source = source;
    this.filename = filename;
    this.tokenize();
  }

  private startnewline(index: number): number {
    this.lineStart.push(index);
    return index;
  }

  // Main tokenizer method, tokenize()
  private tokenize() {
    const src = this.source;
    this.tokens = [];
    this.lineStart = [0];
    this.current = 0;
  
    //**** The main tokenizer loop ***************************************
    let index = 0;
    let lastindex = -1;
    while (index < src.length) {
      debug(`index ${index}: ${src.substring(index, index+42)}`);
      if (index === lastindex) this.error('TODO: buggy lexer, looping in the main tokenizer loop');
      lastindex = index;

      const char = src[index];
      const nextchar = (index + 1) < src.length ? src[index+1] : '';
      let opdesc; //let opdesc = matchOperator(src, index);

      //---- Newline -----------------------------------------------------
      if (char === '\n') { 
        debug('-> newline'); 
        index = this.startnewline(index+1); 
      }
      //---- Number literals ---------------------------------------------
      else if (isDigit(char)) {
        debug('-> number');
        let start = index;
        index++;
        while (isDigit(src[index])) {
          index++;
        }
        const value = src.slice(start, index);
        pushtoken(this.tokens, 'numlit', value, start, index);
      }
      //---- String literals ---------------------------------------------
      // TODO: handle string interpolation in parser?
      else if ("'\"`".includes(char)) {
        debug('-> string literal');
        let start = ++index;
        while (index < src.length && src[index] !== char) { 
          index++;
        }
        const value = src.slice(start, index);
        pushtoken(this.tokens, 'strlit', value, start - 1, index + 1); 
        index++;
      }
      //---- Comments ----------------------------------------------------
      // TODO: nestable block comments /* */
      else if ((char === '/' && nextchar === '/') || (char === '#' && /\s/.test(nextchar))) {
        debug('-> line comment');
        index = this.startnewline(nextLineStart(src, index));
      }
      //---- Type annotations --------------------------------------------
      else if (char === ':') {
        const [typename, _, end] = parseName(src, index+1);
        debug(`-> type ${typename}`);
        pushtoken(this.tokens, 'type', typename, index, end);
        index = end;
      }
      //---- Operators ---------------------------------------------------
      else if (opdesc = matchOperator(src, index)) {
        debug(`-> operator ${opdesc.str}`);
        pushtoken(this.tokens, 'kw', opdesc.str, opdesc.start, opdesc.end);
        index = opdesc.end;
      }
      //---- #pragma -----------------------------------------------------
      else if (char == '#') {
        debug('#pragma: ', strToEndOfLine(src, index));
        index = this.startnewline(nextLineStart(src, index));
      }
      //---- Identifiers -------------------------------------------------
      else if (isLetter(char)) {
        const kwdesc = matchKeyword(src, index);
        if (kwdesc) {
          debug('-> keyword');
          pushtoken(this.tokens, 'kw', kwdesc.str,kwdesc.start, kwdesc.end);
          index = kwdesc.end + 1;
        } else {
          debug('-> identifier');
          const [name, start, end] = parseName(src, index);
          pushtoken(this.tokens, 'ident', name, start, end);
          index = end + 1;
        }
      }
      //---- Whitespace --------------------------------------------------
      // NOTE: meaningful whitespace, so don't keep this as first (don't need to be last either, but.. good enough)
      else if (/\s/.test(char)) {
        debug('-> whitespace');
        index++; 
      } 
      //---- If the execution went this far in the loop scope, it's time for....
      else {
        this.errorLine('SYNTAX ERROR! char: ' + src[index], index, index+1);
      }
    }
  }

  public peekToken(lookahead: number = 0): Token {
    const position = this.current + lookahead;
    return position < this.tokens.length ? this.tokens[position] : eoftoken(this.current);
  }
  public eatToken(expectedType?: TokenClass, expectedValue? : string): Token {
    if (this.current < this.tokens.length) {
      let t = this.tokens[this.current++];
      if (expectedValue && t.str !== expectedValue) this.error(`Expected ${expectedValue}, got ${t.str}`, t);
      if (expectedType && t.cls != expectedType) this.error(`Expected token of type ${expectedType}, got ${t.str}`, t);
      return t;
    } else {
      this.error("Unexpected end-of-file after", this.tokens[this.current - 1]);
    }
  }
  public eatTokenIfType(expectedType: TokenClass, expectedValue? : string): Token | null {
    if (this.current < this.tokens.length) {
      let t = this.tokens[this.current];
      if (t.cls !== expectedType) return null;
      if (expectedValue && t.str !== expectedValue) return null;
      this.current++;
      return t;
    } else {
      this.error("Unexpected end-of-file after", this.tokens[this.current - 1]);
    }
  }

  public pos(): number {
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
    this.tokens.forEach((t) => {
      console.log(t);
    });
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
    console.log(errorLine); //console.log(stripNewlines(errorLine));
    console.log(highlightLine);

    throw new Error("Compilation failed.");
  }

  public error(err: string, token?: Token): never {
    if(!token) token = this.tokens[this.current];
    this.errorLine(err, token.posStartEnd[0], token.posStartEnd[1]);
  }
}
