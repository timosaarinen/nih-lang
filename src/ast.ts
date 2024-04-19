import { assert } from './util.js'; // TODO

export interface Node {
  type: string;
  str?: string;
  num?: number;
  children?: Node[];
  rtype?: string; // AST node NIH typeclass
}
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

export function id(n: Node): string {
  assert(n.str != null, 'AST node has no name');
  return n.str!;
}
export function isId(n: Node, id: string): boolean {
  return (!n.str) ? false : (n.str == id);
}
export function number(n: Node): number {
  assert(n.num != null, 'AST node has no number representation');
  return n.num!;
}
export function foreach(n: Node, fun: (node: Node) => any) {
  assert(n.children != null, 'AST node has no children')
  return n.children!.map(fun);
}
export function foreachStartAt(n: Node, start: number, fun: (node: Node) => any) { 
  assert(n.children != null, 'AST node has no children')
  let res = [];
  for(let i=start; i < n.children!.length; ++i) {
    res.push(fun(n.children![i]));
  }
  return res;
}
export function addChild(n: Node, child?: Node): Node {
  assert(!n.children, 'Not a list');
  if (child) n.children!.push(child);
  return n;
}
export function debugDump(n: Node) {
  console.log(JSON.stringify(n));
}
