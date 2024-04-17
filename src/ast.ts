import { assert } from './util.js'; // TODO

type NodeT = 'list'
            | 'ident'
            | 'strlit'
            | 'numlit'
            | 'call'
            | 'func'
            | 'op'
            | 'ctrl'
            | 'def'
            | 'return';

export interface Node {
  type: NodeT;
  str?: string; // name, value, op - anything that has a string representation
  num?: number; // number value
  children?: Node[];
  rtype?: string; // optional AST type
}

export function list()                                          : Node { return { type: 'list', children: [] } }
export function ident(s: string)                                : Node { return { type: 'ident', str: s } }
export function strlit(str: string)                             : Node { return { type: 'strlit', str: str } }
export function numlit(num: number)                             : Node { return { type: 'numlit', num: num } }
export function call(s: string)                                 : Node { return { type: 'call', str: s } }
export function op(o: string, s: Node[])                        : Node { return { type: 'op', str: o, children: s }; }
export function ctrl(t: string, c: Node, b: Node)               : Node { return { type: 'ctrl', str: t, children: [c, b] } }
export function returnstmt(expr: Node)                          : Node { return { type: 'return', children: [expr] } }
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
