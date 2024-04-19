import { debug, isDigit, isLetter, parseName, skipToNextLine, stripNewlines, strmatch } from './util';
import { isKeyword, matchKeyword, matchOperator } from './langdef';

type TokenType =
  'eof' |     // Code stream ended
  'keyword' | // NIH language keyword, e.g. 'fun', 'for'..
  'ident' |   // identifier, name in value, e.g. 'foobar'
  'string' |  // literal string, content in value, e.g. "Hello, World!"
  'number' |  // number literal, string representation in value e.g. '42' or '3.141592'
  'op';       // all one or two character operators - in value e.g. '+', '-', '?', '(', '&&'

type Lang = 
  'nih' | 'nih-sexpr'

const NO_RTYPE = ''; // TODO: null?

type Token = {
  type: TokenType;
  value: string;
  rtype: string; // NO_RTYPE = none
  posStartEnd: [number, number];
};

export class Lexer {
  private current: number = 0;
  private tokens: Token[] = [];
  private source: string = "";
  private lineStart: number[] = new Array<number>(0); //[];
  private filename: string;
  public lang: Lang = 'nih';

  constructor(source: string = "", filename: string) {
    this.source = source;
    this.filename = filename;
    this.tokenize();
  }

  // Main tokenizer method, tokenize()
  private startNewline(index: number): number {
    //debug(this);
    //debug(this.lineStart);
    this.lineStart.push(index);
    return index;
  }
  private pushTokenOp(op: string, rtype: string, pos: number) { 
    this.tokens.push({type: 'op', value: op, rtype: rtype, posStartEnd: [pos, pos]});
  }
  private pushTokenRange(type: TokenType, value: string, rtype: string, start: number, end: number) {
    this.tokens.push({type: type, value, rtype: rtype, posStartEnd: [start, end]});
  }
  private eofToken(index: number): Token {
    return {type: 'eof', value: 'EOF', rtype: NO_RTYPE, posStartEnd: [index, index]};
  }
  private tokenize() {
    const src = this.source;
    this.tokens = [];
    this.lineStart = [0];
    this.current = 0;
  
    //**** The main tokenizer loop ***************************************
    let index = 0;
    let lastindex = -1;
    let prevtypeann = NO_RTYPE; // type annotation for the next token 
    while (index < src.length) {
      debug(`LEXER: index ${index}: ${src.substring(index, index+42)}`);
      if (index === lastindex) this.error('TODO: buggy lexer, looping in the main tokenizer loop');
      lastindex = index;

      // clear type annotation, if any, for the next loop cycle
      const typeann = prevtypeann;
      prevtypeann = NO_RTYPE;

      const char = src[index];
      const nextchar = (index + 1) < src.length ? src[index+1] : '';

      //---- Newline -----------------------------------------------------
      if (char === '\n') { debug('-> newline'); index = this.startNewline(index+1); continue; }

      //---- Number literals ---------------------------------------------
      if (isDigit(char)) {
        debug('-> number');
        let start = index;
        index++;
        while (isDigit(src[index])) {
          index++;
        }
        const value = src.slice(start, index);
        this.pushTokenRange('number', value, typeann, start, index);
        continue;
      }

      //---- String literals ---------------------------------------------
      // TODO: handle string interpolation in parser?
      if ("'\"`".includes(char)) {
        debug('-> string literal');
        let start = ++index;
        while (index < src.length && src[index] !== char) { 
          index++;
        }
        const value = src.slice(start, index);
        this.pushTokenRange('string', value, typeann, start - 1, index + 1); // TODO: string type ann..?
        index++;
        continue;
      }
      
      //---- Comments ----------------------------------------------------
      if ((char === '/' && nextchar === '/') || (char === '#' && /\s/.test(nextchar))) {
        debug('-> line comment');
        index = this.startNewline(skipToNextLine(src, index));
        continue;
      }
      // TODO: block comments /* */ - nestable!

      //---- Type annotations --------------------------------------------
      if (char === ':') {
        // attach the type to the next token
        const [typename, _, end] = parseName(src, index+1);
        prevtypeann = typename;
        index = end;
        continue;
      }

      //---- Operators ---------------------------------------------------
      let opdesc = matchOperator(src, index);
      if (opdesc) {
        debug(`-> operator ${opdesc.str}`);
        this.pushTokenOp(opdesc.str, typeann, index);
        index = opdesc.end;
        continue;
      }
      
      //---- Keywords ----------------------------------------------------
      let kwdesc = matchKeyword(src, index);
      if (kwdesc) {
        debug(`-> keyword ${kwdesc.str}`);
        // TODO: implement keywords
      }

      //---- #pragma -----------------------------------------------------
      if (char == '#') {
        debug('-> pragma');
        let end: number | null;
        if (end = strmatch('#lang = nih-sexpr', src, index)) { this.lang = 'nih-sexpr'; index = end; debug('** S-EXPRESSION MODE ENGAGED **'); continue; }
      }

      //---- Identifiers -------------------------------------------------
      if (isLetter(char)) {
        debug('-> identifier');
        const [name, start, end] = parseName(src, index);
        this.pushTokenRange(isKeyword(name) ? 'keyword' : 'ident', name, typeann, start, end);
        index = end+1;
        continue;
      }
    
      //---- Whitespace --------------------------------------------------
      // NOTE: meaningful whitespace, so don't keep this as first (don't need to be last either, but.. good enough)
      if (/\s/.test(char)) {
        debug('-> whitespace');
        index++; 
        continue; 
      }

      //---- If the execution went this far in the loop scope, it's time for....
      debug('-> he went too far!');
      this.errorLine('SYNTAX ERROR!', index, index+1);
    }
  }

  public peekToken(lookahead: number = 0): Token {
    const position = this.current + lookahead;
    return position < this.tokens.length ? this.tokens[position] : this.eofToken(this.current);
  }

  public eatToken(expectedType?: TokenType, expectedValue? : string): Token {
    if (this.current < this.tokens.length) {
      let t = this.tokens[this.current++];
      if (expectedValue && t.value !== expectedValue) this.error(`Expected ${expectedValue}, got ${t.value}`, t);
      if (expectedType && t.type != expectedType) this.error(`Expected token of type ${expectedType}, got ${t.type}`, t);
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
    console.log(stripNewlines(errorLine));
    console.log(highlightLine);

    throw new Error("Compilation failed.");
  }

  public error(err: string, token?: Token): never {
    if(!token) token = this.tokens[this.current];
    this.errorLine(err, token.posStartEnd[0], token.posStartEnd[1]);
  }
}
