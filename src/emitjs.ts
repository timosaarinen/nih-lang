import { Node, foreach, foreachStartAt, id, isId, number } from './ast';
import { error } from './util';

const prefixJs = `
//<<<library code>>>
function printStr(s) { console.log(s); }
//<<<user code>>>
`;

function emit(n: Node): string {
  switch (n.type) {
    case 'list': {
      // TODO: Use (call <ident> (...)) for all function calls. Also set/get.
      // TODO: print as native string interpolation macro
      if(n.children) {
        if(n.children[0].type == 'ident' && isId(n.children[0], 'print')) {
          return `printStr( ${foreachStartAt(n, 1, emit).join(', ')} )`;
        } else {
          return foreach(n, emit).join('\n');
        }
      }
      error(`List is not a list: ${n.type}`);
      break;
    }
    case 'call':
      return `${id(n)}(${foreachStartAt(n, 1, emit).join(', ')})`;
    case 'strlit':
      return JSON.stringify(n.str);
    case 'numlit':
      return number(n).toString();
    case 'ident':
      return id(n);
    default:
      error(`Unhandled node type: ${n.type}`);
  }
  error('Nothing to emit!');
  return '';
}

export function emitJs(list: Node): string {
  return prefixJs + emit(list);
}
