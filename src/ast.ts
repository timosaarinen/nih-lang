import { assert } from './util.js';

export type AstT =
  | 'strlit'  // .str contains the string
  | 'numlit'  // .num and also .str as the original exact string representation
  | 'ident'   // .name contains the identifier name
  | 'module'  // 'module'
  | 'doc'     // 'doc' strlit
  | 'let'     // 'let' ident expr
  | 'set!'    // 'set!' ident expr
  | 'inc!'    // 'inc!' ident
  | 'do-while'// 'do-while' (expr*) cond-expr
  | 'unary-minus' // 'unary-minus' expr
  | '+' | '-' | '*' | '/' | '^'                                 // arithmetic operators
  | 'OR' | 'AND' | 'XOR' | 'NOT' | '>>' | '<<' | '<<<' | '>>>'  // bitwise operators (in C: |&^~) and signed/unsigned shifts
  | '!' | '&&' | '||'                                           // logical NOT/AND/OR 
  | '==' | '!=' | '>' | '>=' | '<' | '<='                       // conditional operators
  | 'fn'      // 'fn' plist body-expr*
  | 'plist'   // 'plist' param* [:type]
  | 'param'   // 'param' ident [:type]
  | 'return'  // 'return' expr
  | 'forlt'   // 'forlt' ident num-expr num-expr
  | 'cast'    // 'cast' ident :type
  | 'call'    // 'call' ident expr*
  | 'do'      // 'do' stmt-expr*  ..this is basically a group node to contain statements (TODO: better name)
  | 'TODO:';

export interface Ast {
  type: AstT;     // 'strlit', 'numlit', 'ident', 'call', ...
  name?: string;  // identifier name
  str?: string;   // string literal value (and the original exact string representation for number literals)
  num?: number;   // number literal value
  c: Ast[];       // AST node children (e.g. '+' binary op has [expr, expr])
  rtype?: string; // type annotation
}

export function getident(n: Ast): string              { assert(n.type === 'ident', 'AST node is not an ident'); return n.name!; }
export function getname(n: Ast): string               { assert(n.name != null, 'AST node has no name'); return n.name!; }
export function getnumlit(n: Ast): number             { assert(n.type === 'numlit', 'AST node has no number representation'); return n.num!; }
export function getstrlit(n: Ast): string             { assert(n.type === 'strlit', 'AST node is not an ident'); return n.str!; }
export function isident(n: Ast, id: string): boolean  { return (n.type == 'ident' && n.str == id); }
export function debugdump(n: Ast)                     { console.log(JSON.stringify(n)); }
