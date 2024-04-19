import { Lexer } from './lexer';
import { Node, ident, module, numlit, strlit, op, gen } from './ast';
import { assert } from './util';

//------------------------------------------------------------------------
function sexprParseAtom(lexer: Lexer): Node {
  const t = lexer.eatToken();
  switch (t.type) {
    case 'number':
      return numlit(t.value, parseFloat(t.value));
    case 'string':
      return strlit(t.value);
    case 'ident':
      return ident(t.value);
    default:
      lexer.error(`Expected atom but got: ${t.type}`, t);
  }
}

function sexprRest(lexer: Lexer): Node[] {
  // TODO: if (t.value === ')') { lexer.eatToken(); return gen(op ? op : 'do', c); } ?
  let c: Node[] = [];
  while(lexer.peekToken().value !== ')') {
    assert(lexer.peekToken().type !== 'eof', 'Missing a closing paren? Parsed the file to the end and by my counts.. missing one, nih!');
    c.push(sexprParseExpr(lexer));
  }
  lexer.eatToken('op', ')');
  return c;
}

function sexprParseList(lexer: Lexer, op?: string): Node {
  const c: Node[] = [];
  lexer.eatToken('op', '(');

  const first = lexer.eatToken(); // TODO: allow empty ()?
  switch (first.value) {
    case 'let': return gen('let', sexprRest(lexer));
    default:    lexer.error('TODO: tell the lazy compiler developer to implement this: ${first.value}, nih!');
  }
}

function sexprParseExpr(lexer: Lexer): Node {
  return (lexer.peekToken().value === '(') ? sexprParseList(lexer) : sexprParseAtom(lexer);
}

//------------------------------------------------------------------------
// function resolveExpressionStack(lexer: Lexer, stack: Node[]): Node {
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

// function parseExpression(lexer: Lexer): Node {
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

// function parseExpression(lexer: Lexer): Node {
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

// function parseFunctionDeclaration(lexer: Lexer): Node {
//   lexer.eatToken('ident', 'fun');
//   const funcname = lexer.eatToken('ident').value;
//   let params: Node[] = [];
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

function parseExpr(lexer: Lexer): Node {
  return sexprParseExpr(lexer); // TODO
}

function parseOp(lexer: Lexer): Node {
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

// function parseVariableDeclaration(lexer: Lexer): Node {
//   const varname = lexer.eatToken('ident').value;
//   const type = lexer.eatTokenIfType('ident')?.value; // e.g. "float"
//   lexer.eatToken('op', '=');
//   const value = parseExpression(lexer);
//   return def(varname, value, type);
// }

// function parseControl(lexer: Lexer): Node {
//   let type = lexer.eatToken().value; // e.g. 'if', 'while'
//   let condition = parseExpression(lexer); // parse condition
//   let body = parseList(lexer); // parse body
//   return ctrl(type, condition, body);
// }

export function parseStmt(lexer: Lexer): Node {
  return numlit('42', 42); // TODO:
}

export function parseModule(lexer: Lexer): Node {
  if (lexer.lang == 'nih-sexpr') return sexprParseExpr(lexer); // TODO: allow the switching!
  
  let c: Node[] = [];
  while(lexer.peekToken().type != 'eof') {
    c.push(parseStmt(lexer));
  }
  return module(c);
}
