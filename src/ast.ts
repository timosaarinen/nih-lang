import { assert } from './util.js';

export type AstT =
  | 'strlit'          // ATOM: .str contains the string
  | 'numlit'          // ATOM: .num and also .str as the original exact string representation
  | 'ident'           // ATOM: .name contains the identifier name
  | 'module'          // 'module' stmt*
  | 'doc'             // 'doc' strlit
  | 'let'             // 'let' ident expr
  | 'set!'            // 'set!' ident expr
  | 'inc!'            // 'inc!' ident
  | 'do-while'        // 'do-while' (expr*) cond-expr
  | 'negate'          // 'negate' expr (unary arithmetic operator: minus)
  | '+'               // num-expr '+' num-expr (binary arithmetic operator: addition)
  | '-'               // num-expr '-' num-expr (binary arithmetic operator: subtraction)
  | '*'               // num-expr '*' num-expr (binary arithmetic operator: multiplication)
  | '/'               // num-expr '/' num-expr (binary arithmetic operator: division)
  | '^'               // num-expr '^' num-expr (CONTEXT-DEPENDANT: integers -> bitwise XOR, otherwise -> pow)
  | '|'               // int-expr '|' int-expr (bitwise OR)
  | '&'               // int-expr '&' int-expr (bitwise AND)
  | '~'               // int-expr '~' int-expr (bitwise NOT)
  | '>>'              // int-expr '>>' int-expr (arithmetic shift right operator, e.g. 0x100 >> 8 == 1 and s8(0xFF) >> 1 = 0xFF, "divides by half unless -1")
  | '<<'              // int-expr '<<' int-expr (arithmetic shift left operator, e.g. 1 << 8 == 0x100, *can overflow* - TODO: carry?)
  | '<<<'             // int-expr '<<<' int-expr ("unsigned" bitwise shift left)
  | '>>>'             // int-expr '>>>' int-expr ("unsigned" bitwise shift right)
  | '!'               // logical NOT
  | '&&'              // logical AND
  | '||'              // logical OR
  | '=='              // equality operator
  | '!='              // inequality operator
  | '>'               // greater-than operator (gt)
  | '>='              // greater-or-equal operator (gte)
  | '<'               // less-than operator (lt)
  | '<='              // less-or-equal operator (lte)
  | 'fn'              // 'fn' plist body-expr*
  | 'plist'           // 'plist' (param | returns)*
  | 'param'           // 'param' ident [:type]
  | 'returns'         // 'returns' :type
  | 'return'          // 'return' expr
  | 'for'             // 'for' (for-param*) body-expr*
  | 'param-for'       // TODO: 'param-for' ident range-expr
  | 'range-start-end' // TODO: '...' start-int-expr end-int-expr  ..non-inclusive end always, (range 0 10) = 0..9
  | 'range-start-cond-step' // TODO: '...' start-fn cond-fn step-fn  -> start; while(cond) {body step} ..use closures!  
  | 'cast'            // 'cast' ident :type
  | 'call'            // 'call' ident expr*
  | 'do'              // 'do' stmt-expr*  ..this is basically a group node to contain statements (TODO: better name)
  | 'TODO:';

export interface Ast {
  type: AstT;     // 'strlit', 'numlit', 'ident', 'call', ...
  name?: string;  // identifier name
  str?: string;   // string literal value (and the original exact string representation for number literals)
  num?: number;   // number literal value
  c: Ast[];       // AST node children (e.g. '+' binary op has [expr, expr])
  rtype?: string; // type annotation
}

export function nop(): Ast                            { return { type: 'do', c: [] }; }
export function getident(n: Ast): string              { assert(n.type === 'ident', 'AST node is not an ident'); return n.name!; }
export function getname(n: Ast): string               { assert(n.name != null, 'AST node has no name'); return n.name!; }
export function getnumlit(n: Ast): number             { assert(n.type === 'numlit', 'AST node has no number representation'); return n.num!; }
export function getstrlit(n: Ast): string             { assert(n.type === 'strlit', 'AST node is not an ident'); return n.str!; }
export function isident(n: Ast, id: string): boolean  { return (n.type == 'ident' && n.str == id); }
export function debugdump(n: Ast)                     { console.log(JSON.stringify(n)); }
