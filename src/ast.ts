import { assert } from './util.js';

export type AstT =
  'strlit'  | // .str contains the string
  'numlit'  | // .num and also .str as the original exact string representation
  'ident'   | // .name contains the identifier name
  'module'  | // 'module'
  'doc'     | // 'doc' strlit
  'let'     | // 'let' ident expr
  'set!'    | // 'set!' ident expr
  'inc!'    | // 'inc!' ident
  'do-while'| // 'do-while' (expr*) cond-expr
  'unary +' | 'unary -' | '+' | '-' | '*' | '/' | '^' | // arithmetic operators
  'bit-or' | 'bit-and' | 'bit-xor' | 'bit-not' | // bitwise-operators |&^~
  '==' | '!=' | '>' | '>=' | '<' | '<=' | // conditional operators
  'fn'      | // 'fn' plist body-expr*
  'plist'   | // 'plist' param* [:type]
  'param'   | // 'param' ident [:type]
  'return'  | // 'return' expr
  'forlt'   | // 'forlt' ident num-expr num-expr
  'cast'    | // 'cast' ident :type
  'call'    | // 'call' ident expr*
  'do'      | // 'do' stmt-expr*  ..this is basically a group node to contain statements (TODO: better name)
  'TODO:';

export interface Ast {
  type: AstT;     // 'strlit', 'numlit', 'ident', 'call', ...
  name?: string;  // identifier name
  str?: string;   // string literal value (and the original exact string representation for number literals)
  num?: number;   // number literal value
  c: Ast[];       // AST node children (e.g. '+' binary op has [expr, expr])
  rtype?: string; // type annotation
}

export function name(n: Ast): string                  { assert(n.name != null, 'AST node has no name'); return n.name!; } // TODO: check type 'ident'?
export function isident(n: Ast, id: string): boolean  { return (n.type == 'ident' && n.str == id); }
export function number(n: Ast): number                { assert(n.num != null, 'AST node has no number representation'); return n.num!; }
export function addchild(n: Ast, child?: Ast): Ast    { if (child) n.c.push(child); return n; }

// Iterating children:  for(let i = start; i < ast.c.length; ++i) { ... }

export function debugdump(n: Ast) {
  console.log(JSON.stringify(n));
}


/* TODO: ref, remove
export function module(c: Node[])                               : Node { return { type: 'module', children: c } }
export function statements(c: Node[])                           : Node { return { type: 'do', children: c } }
export function ident(s: string)                                : Node { return { type: 'ident', str: s } }
export function strlit(str: string)                             : Node { return { type: 'lit', str: str, rtype: 'string' } }
export function numlit(exact: string, num: number)              : Node { return { type: 'lit', str: exact, num: num, rtype: 'number' } }
export function gen(id: string, args: Node[])                   : Node { return { type: 'op', str: id, children: args } }
export function op(op: string, operands: Node[])                : Node { return { type: 'op', str: op, children: operands } }
export function returns(expr: Node)                             : Node { return { type: 'return', children: [expr] } }
export function func(p: Node[], b: Node, r: string | null)      : Node { return { type: 'func', children: [...p, b], rtype: r ?? undefined } }
export function def(s: string, v: Node, r: string | null = null): Node { return { type: 'def', str: s, children: [v], rtype: r ?? undefined } }
*/