import { AST } from "./ast.js";

const prefixJs = `
//<<<library code>>>
function printStr(s) { console.log(s); }
//<<<user code>>>
`;

function emit(n: AST.Node): string {
  switch (n.type) {
    case 'list': {
      // TODO: Use (call <ident> (...)) for all function calls. Also set/get.
      // TODO: print as native string interpolation macro
      if(n.children) {
        if(n.children[0].type == 'ident' && AST.isid(n.children[0], 'print')) {
          return `printStr( ${AST.foreachAfterFirst(n, emit).join(', ')} )`;
        } else {
          return AST.foreach(n, emit).join('\n');
        }
      }
      throw new Error(`List is not a list: ${n.type}`);
    }
    case 'call':    return `${AST.id(n)}(${AST.foreachAfterFirst(n, emit).join(', ')})`;
    case 'strlit':  return JSON.stringify(n.str);
    case 'numlit':  return AST.number(n).toString();
    case 'ident':   return AST.id(n);
    default:        throw new Error(`Unhandled node type: ${n.type}`);
  }
}

export function emitJs(list: AST.Node): string {
  return prefixJs + emit(list);
}
