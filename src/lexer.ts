import { log, isDigit, isLetter, parseName, nextLineStart, strToEndOfLine, error, errorbox } from './util.js';
import { matchKeyword, matchOperator } from './langdef.js';

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
export function lexertoken(index: number): Token { return { cls: 'eof', str: 'TODO: take lexer state', posStartEnd: [index, index] } } // TODO:
export function iseof(token: Token): boolean { return token.cls === 'eof' }

//------------------------------------------------------------------------
//  TODO: no classes.
//------------------------------------------------------------------------
export class Lexer {
  public tokens: Token[] = [];
  private current: number = 0;
  private source: string = "";
  private lineStart: number[] = [0];
  private filename: string;
  private nestedcomments: number[] = []; // start positions of '/' in '/*'
  
  constructor(source: string = "", filename: string) {
    this.source = source;
    this.filename = filename;
    this.tokenize();
  }

  private startnewline(index: number): number {
    this.lineStart.push(index);
    return index;
  }

  //**** The main tokenizer loop ***************************************
  private tokenize() {
    const src = this.source;  
    let index = 0;
    let lastindex = -1;
    while (index < src.length) {
      debug(`index ${index}: ${src.substring(index, index+42)}`);
      if (index === lastindex) this.error('TODO: buggy lexer, looping in the main tokenizer loop');
      lastindex = index;

      this.current = index; // track current, remember to clear for parser calls!

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
      else if ((char === '/' && nextchar === '*')) {
        debug('-> nestable comment block');
        this.nestedcomments.push(index);
        index += 2; // skip /*
        while (this.nestedcomments.length > 0 && index < src.length) {
            let ch = '';
            while (index < src.length - 1) {
                ch = src[index++] + src[index]; // look ahead one character
                this.current = index;
    
                if (ch === '*/') {
                    this.nestedcomments.pop(); // end of comment
                    index++; // skip the "/"
                    break; // exit the inner while-loop
                } else if (ch === '/*') {
                    this.nestedcomments.push(index); // new nested comment
                    index++; // skip the "*"
                }
            }
            debug('--> got out of forward scan loop, @index:', index, ' @src.length:', src.length);
    
            if (index >= src.length && this.nestedcomments.length > 0) {
                this.error(`Hey, you got nestable comment open, nih! Start positions: ${JSON.stringify(this.nestedcomments)}`);
            }
        }
      }
      else if ((char === '/' && nextchar === '/') || (char == ';') || (char === '#' && /\s/.test(nextchar))) {
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

    this.current = 0; // clear for parser calls
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

  public lexercurrentlines() {
    return '[[From source code position ' + this.current + '/' + this.source.length + ']] ' + this.source.slice(this.current, this.current+42); // TODO: to end of line? two lines?
  }

  public error(err: string, token?: Token): never {
    // TODO: this is called by lexer AND parser, might make own functions? Lexer needs to pass more info.
    if(!token) token = this.tokens[this.current];
    if(!token) { errorbox(this.lexercurrentlines()); error(err); } //token = lexertoken(this.current);
    this.errorLine(err, token.posStartEnd[0], token.posStartEnd[1]);
  }
}
