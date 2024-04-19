import { Node, foreach, foreachStartAt, id, isId, number } from './ast';
import { error } from './util';

const prefixJs = `
//<<<library code>>>
function printStr(s) { console.log(s); }
//<<<user code>>>
`;

function emit(n: Node): string {
  switch (n.type) {
    case 'module':
    case 'do':
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
    case 'lit': {
      switch (n.rtype) {
        case 'string':  return JSON.stringify(n.str);
        case 'number':  return number(n).toString();
        default:        error(`Unknown literal type: ${n.rtype}`); return '';
      }
    }
    case 'ident':
      return id(n);
    case 'op':
      switch (n.str) {
        case 'call':  return `${id(n)}(${foreachStartAt(n, 1, emit).join(', ')})`;
        default:      error(`Unhandled op.. ${n.str}`); return '';
      }
    case 'return': // TODO: should be 'op'?
      return 'return ';
    case 'func':
      return `() => { ${foreachStartAt(n, 2, emit).join('; ')}} }`; // TODO: fix parsing, :int combine etc
    case 'def':
      return `${n.str} = ${emit(n.children![0])};`;
    default:
      error(`Unhandled node type.. ${n.type}`);
  }
  error('Nothing to emit!');
  return '';
}

// export function module(c: Node[])                               : Node { return { type: 'module', children: c } }
// export function statements(c: Node[])                           : Node { return { type: 'do', children: c } }
// export function ident(s: string)                                : Node { return { type: 'ident', str: s } }
// export function strlit(str: string)                             : Node { return { type: 'lit', str: str, rtype: 'string' } }
// export function numlit(exact: string, num: number)              : Node { return { type: 'lit', str: exact, num: num, rtype: 'number' } }
// export function gen(id: string, args: Node[])                   : Node { return { type: 'op', str: id, children: args } }
// export function op(op: string, operands: Node[])                : Node { return { type: 'op', str: op, children: operands } }
// export function returns(expr: Node)                             : Node { return { type: 'return', children: [expr] } }
// export function func(p: Node[], b: Node, r: string | null)      : Node { return { type: 'func', children: [...p, b], rtype: r ?? undefined } }
// export function def(s: string, v: Node, r: string | null = null): Node { return { type: 'def', str: s, children: [v], rtype: r ?? undefined } }

export function emitJs(list: Node): string {
  return prefixJs + emit(list);
}
