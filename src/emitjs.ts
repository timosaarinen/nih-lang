import { Ast, getident } from './ast';
import { error } from './util';

export function emitjs(list: Ast): string {
  return prefixJs + emit(list);
}

 // TODO: don't call console.log directly
const prefixJs = `
//--- NIH system code -------------------
function nih_printchars(s)  { console.log(s); }
function nih_printlf(s)     { console.log('\n'); }

//--- User compiled code-----------------
`;
const jsidmap: { [key: string]: string } = {
  printchars: 'nih_print_chars',
  printlf:    'nih_printlf',
}
function id2js(id: string) { const jsid = jsidmap[id]; return jsid ?? id; }

function emit(ast: Ast): string { 
  switch (ast.type) {
    case 'strlit':  return JSON.stringify(ast.str);
    case 'numlit':  return ast.num!.toString(); // return ast.str; ..for original number literal string rep 
    case 'ident':   return getident(ast);
    case 'let':     return 'const ' + getident(ast.c[0]) + ' = ' + emit(ast.c[1]);
    case 'set!':    return 'let ' + getident(ast.c[0]) + ' = ' + emit(ast.c[1]); // TODO: omit 'let' if already created
    case 'return':  return 'return ' + emit(ast.c[0]);
    case '==':      return '===';
    case '!=':      return '!==';
    case '^':       return 'Math.pow(' + emit(ast.c[0]) + ', ' + emit(ast.c[1]);
    case '+':
    case '-':
    case '*':
    case '/':
    case '>':
    case '>=':
    case '<':
    case '<=':      return ast.type;
    case 'module': 
    case 'do':      {
      let s = '';
      for (let n=0; n < ast.c.length; ++n) { 
        s += emit(ast.c[n]) + '\n'; 
      } 
      return s;
    }
    case 'call':    { 
      let s = id2js(getident(ast.c[0])) + '(';
      for (let n=1; n < ast.c.length; ++n) {
        s += emit(ast.c[n]);
        if (n != (ast.c.length-1)) s += ', ';
      }
      s += '); ';
      return s;
    }
    case 'fn': {
      let s = '() => {';
      // TODO: skips plist
      for (let n = 1; n < ast.c.length; ++n) {
        s += emit(ast.c[n]) + '\n';
      }
      return s;
    }
    default: error(`Unhandled AST type.. ${ast.type}`);
  }
  return ''; // TODO:
}
