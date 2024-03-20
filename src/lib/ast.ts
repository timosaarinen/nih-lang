export namespace AST {
  export interface Node {
    type: 'list' | 'ident' | 'strlit' | 'numlit' | 'call';
    str?: string; // name, value (if has a string representation)
    num?: number;
    children?: Node[];
  }

  export function list()              : Node { return { type: 'list', children: new Array<Node> } }
  export function ident(name: string) : Node { return { type: 'ident', str: name } }
  export function strlit(str: string) : Node { return { type: 'strlit', str: str } }
  export function numlit(num: number) : Node { return { type: 'strlit', num: num } }
  export function call(name: string)  : Node { return { type: 'call', str: name } }

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
