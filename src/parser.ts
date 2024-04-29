import { Lexer, TokenType } from './lexer';
import { Ast, AstT } from './ast';
import { assert, debug, debugenable, error } from './util';

debugenable('parser'); // DEBUG: uncomment to enable parser debug info logging

//------------------------------------------------------------------------
//
//  S-Expressions
//    - represent AST Asts directly
//    - atoms have no children, only value or name (numlit/strlit/ident)
//    - all S-expression lists have AstT as head, e.g. 'call', '*', ...
//    - lists have N children, form depends on the AstT head
//
//------------------------------------------------------------------------
function sexprAtom(lexer: Lexer, expected?: TokenType): Ast {
  const t = lexer.eatToken();
  if (expected && expected !== t.type) lexer.error(`Expected ${expected}, got ${t.type}`, t);
  switch (t.type) {
    case 'numlit':  return { type: 'numlit', str: t.value, num: parseFloat(t.value), c:[] };
    case 'strlit':  return { type: 'strlit', str: t.value, c: [] };
    case 'ident':   return { type: 'ident', name: t.value, c: [] };
    default:        return lexer.error('Expected number literal, string literal or identifier.', t);
  }
}
function rest(lexer: Lexer): Ast[] {
  let c: Ast[] = [];
  while(lexer.peekToken().value !== ')') {
    assert(lexer.peekToken().type !== 'eof', 'Missing a closing paren? Parsed the file to the end and by my counts.. missing one, nih!');
    c.push(sexpr(lexer));
  }
  return c;
}
function param(lexer: Lexer): Ast {
  return { type: 'param', c: [sexpr(lexer)] }; // TODO: 'param' ident [:type]
}
function plist(lexer: Lexer): Ast {
  return { type: 'plist', c: [sexpr(lexer)] }; // TODO: 'plist' param* [:type]
}
function sexprParseListAst(lexer: Lexer, astt: string /*AstT*/): Ast {
  switch (astt) {
    case 'module':    return { type: 'module',  c: [] };                                                      // 'module'
    case 'doc':       return { type: 'doc',     c: [sexprAtom(lexer, 'strlit')] };                            // 'doc' strlit
    case 'let':       return { type: 'let',     c: [sexprAtom(lexer, 'ident'), sexpr(lexer)] };               // 'let' ident expr
    case 'set!':      return { type: 'set!',    c: [sexprAtom(lexer, 'ident'), sexpr(lexer)] };               // 'set!' ident expr
    case 'inc!':      return { type: 'inc!',    c: [sexprAtom(lexer, 'ident')] };                             // 'inc!' ident
    case 'forlt':     return { type: 'forlt',   c: [sexprAtom(lexer, 'ident'), sexpr(lexer), sexpr(lexer)] }; // 'forlt' ident num-expr num-expr
    case 'do-while':  return { type: 'inc!',    c: [sexprAtom(lexer, 'ident')] };                             // TODO: 'do-while' (expr*) cond-expr
    case 'fn':        return { type: 'fn',      c: [plist(lexer), ...rest(lexer)] };                          // TODO: 'fn' plist body-expr*
    case 'return':    return { type: 'return',  c: [sexpr(lexer)] };                                          // 'return' [expr] - TODO: optional retvalue (check function signature)
    case 'cast':      return { type: 'cast',    c: [sexpr(lexer), sexprAtom(lexer, 'type')] };                // 'cast' expr :type
    case 'call':      return { type: 'call',    c: [sexprAtom(lexer, 'ident'), ...rest(lexer)] };             // 'call' ident expr*
    case 'do':        return { type: 'do',      c: [...rest(lexer)] };                                        // 'do' stmt-expr*
    case '+':         return { type: '+',       c: [sexpr(lexer), sexpr(lexer)] };                            // '+' expr expr (TODO: unary?)
    case '-':         return { type: '-',       c: [sexpr(lexer), sexpr(lexer)] };                            // '-' expr expr (TODO: unary minus? Own astt?)
    case '*':         return { type: '*',       c: [sexpr(lexer), sexpr(lexer)] };                            // '*' expr expr
    case '/':         return { type: '/',       c: [sexpr(lexer), sexpr(lexer)] };                            // '/' expr expr
    case '^':         return { type: '^',       c: [sexpr(lexer), sexpr(lexer)] };                            // '^' expr expr
    case '==':        return { type: '==',      c: [sexpr(lexer), sexpr(lexer)] };                            // '==' expr expr
    case '!=':        return { type: '!=',      c: [sexpr(lexer), sexpr(lexer)] };                            // '!=' expr expr
    case '<':         return { type: '<',       c: [sexpr(lexer), sexpr(lexer)] };                            // '<'  expr expr
    case '<=':        return { type: '<=',      c: [sexpr(lexer), sexpr(lexer)] };                            // '<=' expr expr
    case '>':         return { type: '>',       c: [sexpr(lexer), sexpr(lexer)] };                            // '>'  expr expr
    case '>=':        return { type: '>=',      c: [sexpr(lexer), sexpr(lexer)] };                            // '>=' expr expr
    case 'bit-or':    return { type: '-',       c: [sexpr(lexer), sexpr(lexer)] };                            // '-' expr expr (TODO: unary minus? Own astt?)
    case 'bit-and':   return { type: '*',       c: [sexpr(lexer), sexpr(lexer)] };                            // '*' expr expr
    case 'bit-xor':   return { type: '/',       c: [sexpr(lexer), sexpr(lexer)] };                            // '/' expr expr
    case 'bit-not':   return { type: '^',       c: [sexpr(lexer), sexpr(lexer)] };                            // '^' expr expr
    case 'TODO:':     // TODO: do something with this marker?
    default:          lexer.error(`TODO: tell the lazy compiler developer to implement this: ${astt}, nih!`); return { type: 'TODO:', c: [] };
  }
}
function sexprParseList(lexer: Lexer, op?: string): Ast {
  const c: Ast[] = [];
  lexer.eatToken('op', '(');
  assert(lexer.peekToken().type !== 'eof', "Expected S-expression list to continue, got eof"); // TODO: tell the opening paren in error
  assert(lexer.peekToken().value !== ')', "No empty list () allowed."); // TODO: allow () ?

  const head = lexer.eatToken();
  debug('parser', head);
  const ast = sexprParseListAst(lexer, head.value);
  lexer.eatToken('op', ')');

  return ast;
}
function sexpr(lexer: Lexer): Ast {
  debug('parser', 'sexpr:', lexer.peekToken());
  return (lexer.peekToken().value === '(') ? sexprParseList(lexer) : sexprAtom(lexer);
}

//------------------------------------------------------------------------
// function resolveExpressionStack(lexer: Lexer, stack: Ast[]): Ast {
//   // TODO: precedence and associativity rules - for KISS, left-associative binary operations for now
//   let result = stack[0];
//   for (let i = 1; i < stack.length; i += 2) {
//     let operator = stack[i].str;
//     if (typeof operator !== 'string') lexer.error("Invalid operator");
//     let rightOperand = stack[i + 1];
//     result = op(operator, [result, rightOperand]);
//   }
//   return result;
// }

// function parseExpression(lexer: Lexer): Ast {
//   let stack = [];
//   while (true) {
//     let token = lexer.peekToken();
//     // TODO: use langdef.ts
//     if (!token || ['+', '-', '*', '/', ')'].includes(token.type)) {
//       break; // Stop at an operator or end of expression
//     }
//     stack.push(sexprParseAtom(lexer));
//   }
//   return resolveExpressionStack(lexer, stack);
// }

// function parseExpression(lexer: Lexer): Ast {
//   let token = lexer.peekToken();
//   switch (token.type) {
//     case 'number': case 'string': case 'ident':
//       return parseAtom(lexer);
//     case '+': case '-': case '*': case '/': // Assuming these are binary operators
//       return parseOperation(lexer);
//     default:
//       lexer.error(`Unexpected token in expression: ${token.type}`);
//   }
// }

// function parseFunctionDeclaration(lexer: Lexer): Ast {
//   lexer.eatToken('ident', 'fun');
//   const funcname = lexer.eatToken('ident').value;
//   let params: Ast[] = [];
//   while(true) {
//     const token = lexer.eatToken();
//     if (token.value === ')') break;
//     if (token.type !== 'ident') lexer.error("Expected parameter identifier");
//     params.push(ident(token.value));
//     // TODO: opt type, e.g. 'float' in 'foo(x float)'
//   }
//   const t = lexer.eatTokenIfType('op', ':');
//   const rtype = (t) ? lexer.eatToken().value : null; // consume optional return type
//   const body = sexprParseList(lexer);
//   return def(funcname, func(params, body, rtype), rtype);
// }

function parseExpr(lexer: Lexer): Ast {
  return sexpr(lexer); // TODO
}

function parseOp(lexer: Lexer): Ast {
  let o = lexer.eatToken('op').value;
  if (o == '-') {
    return op('-', [parseExpr(lexer)]);
  } else if (o == '+') {
    return parseExpr(lexer);
  } else if (o == '?') {
    return op('?', [parseExpr(lexer), parseExpr(lexer), parseExpr(lexer)]);
  } else {
    return op(o, [parseExpr(lexer), parseExpr(lexer)]);
  }
}

// function parseVariableDeclaration(lexer: Lexer): Ast {
//   const varname = lexer.eatToken('ident').value;
//   const type = lexer.eatTokenIfType('ident')?.value; // e.g. "float"
//   lexer.eatToken('op', '=');
//   const value = parseExpression(lexer);
//   return def(varname, value, type);
// }

// function parseControl(lexer: Lexer): Ast {
//   let type = lexer.eatToken().value; // e.g. 'if', 'while'
//   let condition = parseExpression(lexer); // parse condition
//   let body = parseList(lexer); // parse body
//   return ctrl(type, condition, body);
// }

function parseStmt(lexer: Lexer): Ast {
  return numlit('42', 42); // TODO:
}

export function parseModule(lexer: Lexer): Ast {
  let c: Ast[] = [];
  let token;
  while((token = lexer.peekToken()).type != 'eof') {
    if (token.value === '(') {
      debug('parser', 'NIH-sexpr statement'); 
      c.push(sexpr(lexer));
    } else {
      debug('parser', 'NIH-C statement');
      error('TODO!');
    }
  }
  return module(c);
}
