export namespace AST {
  type NodeT =
    'list' | 
    'ident' | 
    'strlit' | 
    'numlit' | 
    'call' | 
    'func' | 
    'op' | 
    'ctrl' | 
    'def' | 
    'return' | 
    'typeann';
  export interface Node {
    type: NodeT;
    str?: string; // name, value, op (if has a string representation)
    num?: number; // number value
    children?: Node[];
    rtype?: string; // node optional type, e.g. function return type or expression tree resulting type
  }
  export function list()                            : Node { return { type: 'list', children: [] } }
  export function ident(name: string)               : Node { return { type: 'ident', str: name } }
  export function strlit(str: string)               : Node { return { type: 'strlit', str: str } }
  export function numlit(num: number)               : Node { return { type: 'numlit', num: num } }
  export function call(name: string)                : Node { return { type: 'call', str: name } }
  export function op(o: string, s: Node[])          : Node { return { type: 'op', str: o, children: s }; }
  export function ctrl(t: string, c: Node, b: Node) : Node { return { type: 'ctrl', str: t, children: [c, b] }; }
  export function returnstmt(expr: Node)            : Node { return { type: 'return', children: [expr] }
  // export function typeann(name: string, t: string)  : Node { return { type: 'typeann', str: name, rtype: t } }
  export function func(params: Node[], body: Node, rtype: string | null) : Node {
    if (rtype) {
      return { type: 'func', children: [...params, body], rtype: rtype };
    } else {
      return { type: 'func', children: [...params, body] };
    }
  }
  export function def(name: string, value: Node, type: string | null = null): Node {
    if (type) {
      return { type: 'def', str: name, children: [value], rtype: type };
    } else {
      return { type: 'def', str: name, children: [value] };
    }
  }

  export function id(n: Node): string { return n.str ? n.str : "<unknown identifier>"; }
  export function isid(n: Node, id: string): boolean { if(!n.str) return false; else return n.str == id; }
  export function number(n: Node): number { if(!n.num) throw new Error("I'm not a number!"); return n.num; }

  export function foreach(n: Node, fun: (node: Node) => any) { return n.children!.map(fun); }
  export function foreachAfterFirst(n: Node, fun: (node: Node) => any) { 
    let res = [];
    for(let i=1; i < n.children!.length; ++i) {
      res.push(fun(n.children![i]));
    }
    return res;
  }

  export function addchild(n: Node, child: Node): Node { 
    if(!n.children) throw new Error("Not a list!"); 
    n.children.push(child);
    return n;
  }

  export function debugDump(n: Node) {
    console.log(JSON.stringify(n));
  }
}
