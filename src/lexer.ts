import { strmatch, log, isDigit, isLetter, parseName, nextLineStart, thisLine, error, errorbox, json, spaces } from './util.js';
import { matchKeyword, matchOperator } from './langdef.js';

function debug(...args: any[]) { 
  //log('LEXER:', ...args); // DEBUG: uncomment to enable debug logging
}
function debugeating(indent: number, ...args: any[]) {
  log(spaces(indent), '', ...args); // DEBUG: uncomment to enable logging token eating
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
  public indent = 0; // for parser debugging
  public showsourcelines: boolean = false; // enable to log each source line for diagnostics
  public tokens: Token[] = [];
  private current: number = 0;
  private source: string = "";
  private linestart: number[] = [0];
  private filename: string;
  private nestedcomments: number[] = []; // start positions of '/' in '/*'
  
  constructor(source: string = "", filename: string) {
    if (source.includes('\r')) error(
`Invalid Carriage Return ('\\r') character found in the ${filename} - .nih files must be in Unix LF format.
- use Visual Studio Code, see the bottom/status bar.. should read LF, not CRLF.
- if not, convert to LF by clicking the CRLF and selecting LF.`);
    
    this.source = source;
    this.filename = filename;
    this.tokenize();
  }

  private sourceforward(index: number): string {
    return this.source.slice(index, index + 42); // TODO: couple or three lines?
  }

  private startnewline(index: number): number {
    this.linestart.push(index);
    if (this.showsourcelines) log(this.filename + ':' + this.linestart.length + ': ' + this.sourceforward(index))
    return index;
  }

  private skip(matchstr: string, index: number): number {
    let end = strmatch(matchstr, this.source, index);
    if (!end) this.error("Expected: '" + matchstr + "', got: '" + this.sourceforward(index) + "'");
    return end;
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
        index = this.startnewline(nextLineStart(src, index));
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
        const strlitchar = char; // single-, double-quote or backtick
        let value, start;
        if (src[index+1] === '"' && src[index+2] === '"') {
          debug('-> multi-line string literal');
          index = this.skip('"""', index);
          start = index;
          while (index < src.length && src[index] !== '"') {
            if (src[index] == '\n') {
              index = this.startnewline(nextLineStart(src, index));
            } else {
              index++;
            }
          }
          value = src.slice(start, index);
          index = this.skip('"""', index);
        } else {
          debug("-> string literal with '" + strlitchar + "'");
          index = this.skip(strlitchar, index);
          start = index;
          while (index < src.length && src[index] !== strlitchar) { 
            index++;
          }
          value = src.slice(start, index);
          index = this.skip(strlitchar, index);
        }
        pushtoken(this.tokens, 'strlit', value, start, index); 
      }
      //---- Comments ----------------------------------------------------
      else if ((char === '/' && nextchar === '*')) {
        debug('-> nestable comment block');
        this.nestedcomments.push(index);
        index = this.skip('/*', index);
        while (this.nestedcomments.length > 0 && index < src.length) {
            let ch = '';
            while (index < src.length - 1) {
                ch = src[index++] + src[index]; // look ahead one character
                this.current = index;
    
                if (ch === '\n') {
                  index = this.startnewline(nextLineStart(src, index));
                } else if (ch === '*/') {
                    this.nestedcomments.pop(); // end of comment
                    index = this.skip('*/', index-1);
                    break; // exit the inner while-loop
                } else if (ch === '/*') {
                    this.nestedcomments.push(index); // new nested comment
                    index = this.skip('/*', index-1);
                }
            }
            //console.log('--> got out of nested forward scan loop for /* */, @index:', index, ' @src.length:', src.length);
            //console.log(json(this.getLineAndColumn(index)));

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
        debug('#pragma: ', thisLine(src, index));
        index = this.startnewline(nextLineStart(src, index));
      }
      //---- Identifiers -------------------------------------------------
      else if (isLetter(char)) {
        const kwdesc = matchKeyword(src, index);
        if (kwdesc) {
          debug('-> keyword');
          pushtoken(this.tokens, 'kw', kwdesc.str,kwdesc.start, kwdesc.end);
          index = kwdesc.end;
        } else {
          debug('-> identifier');
          let [name, start, end, hasDotAfter] = parseName(src, index);
          if (hasDotAfter) {
            // ident '.' ident -> (dot ident ident)
            // ident '.' ident '.' ident -> (dot ident ident ident) ...
            pushtoken(this.tokens, 'kw', '(', start, end); // TODO: fix these start/ends
            pushtoken(this.tokens, 'kw', 'dot', start, end);
            pushtoken(this.tokens, 'ident', name, start, end);
            index = this.skip('.', end);
            while(isLetter(src[index])) {
              [name, start, end, hasDotAfter] = parseName(src, end+1);
              pushtoken(this.tokens, 'ident', name, start, end);
              index = (hasDotAfter) ? this.skip('.', end) : end;
            }
            pushtoken(this.tokens, 'kw', ')', start, end);
          } else {
            pushtoken(this.tokens, 'ident', name, start, end);
            index = end + 1;  
          }
        }
      }
      //---- Whitespace --------------------------------------------------
      // NOTE: meaningful whitespace, so don't keep this as first (don't need to be last either, but.. good enough)
      else if (char == ' ' || char == '\t') {
        //console.log('-> whitespace', index);
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
  public eofcheck() {
    if (this.peekToken().cls == 'eof') {
      this.error("Unexpected end-of-file after", this.tokens[this.current - 1]);
    }
  }
  public eatToken(expectedType?: TokenClass, expectedValue? : string): Token {
    this.eofcheck();
    let t = this.tokens[this.current++];
    if (expectedValue && t.str !== expectedValue) this.error(`Expected ${expectedValue}, got ${t.str}`, t);
    if (expectedType && t.cls != expectedType) this.error(`Expected token of type ${expectedType}, got ${t.str}`, t);
    debugeating(this.indent, t.str, t.cls, ':', t.posStartEnd[0]);
    return t;
  }
  public eatTokenIfType(expectedType: TokenClass, expectedValue? : string): Token | null {
    this.eofcheck();
    const t = this.peekToken();
    if (t.cls !== expectedType) { debugeating(this.indent, 'eatTokenIfType() fail with', t.str, '!=', expectedType); return null; }
    if (expectedValue && t.str !== expectedValue) { debugeating(this.indent, 'eatTokenIfType() matched class, but ', t.str, '!=', expectedValue); return null; }
    return this.eatToken(expectedType, expectedValue);
  }

  public pos(): number {
    return this.current;
  }

  public addToSource(appendcode: string, pos?: number) {
    if(pos) {
      this.source.slice(0, pos);
    }
    this.source += appendcode;
    this.tokenize();
  }

  public debugDump() {
    this.tokens.forEach((t) => {
      console.log(t);
    });
  }

  public getLineAndColumn(position: number): { line: number, column: number } {
    for (let i = 0; i < this.linestart.length; i++) {
      // Check if the position is in the current line
      if (this.linestart[i] > position) {
        // Position is in the previous line
        const line = i;
        const column = position - this.linestart[i - 1];
        //console.log('getLineAndColumn: line:', line, 'column:', column); // DEBUG:
        return { line, column };
      }
    }

    // If the position is in the last line
    if (position >= this.linestart[this.linestart.length - 1]) {
      const line = this.linestart.length;
      const column = position - this.linestart[line - 1];
      return { line, column };
    }

    // If position is not found (which should not happen), return line and column as 0
    return { line: 0, column: 0 };
  }

  public errorLine(err: string, start: number, end: number): never {
    const errorMarkerChar = "^";
    const { line, column } = this.getLineAndColumn(start);
    const linestartIndex = this.linestart[line - 1];
    const lineEndIndex = this.linestart[line] || this.source.length;
    const errorLine = this.source.substring(linestartIndex, lineEndIndex);

    let highlightLine = "".padStart(column - 1) + errorMarkerChar.repeat(end - start);   
    if(end === start) {
        highlightLine += errorMarkerChar;
    }

    console.error("*************************** NIH! *****************************************");
    console.error(`ERROR: ${this.filename}:${line}:${column}: ${err}:`);
    console.error(errorLine);
    console.error(highlightLine);

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
