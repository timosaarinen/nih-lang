import { Lexer } from './lexer';
import { Node, addChild, def, func, ident, list, numlit, op, strlit, ctrl } from './ast';

function parseAtom(lexer: Lexer): Node {
  const t = lexer.eatToken();
  switch (t.type) {
    case 'number':
      return numlit(parseFloat(t.value));
    case 'string':
      return strlit(t.value);
    case 'ident':
      return ident(t.value);
    default:
      lexer.error(`Unexpected token: ${t.type}`, t);
  }
}

function resolveExpressionStack(lexer: Lexer, stack: Node[]): Node {
  // TODO: precedence and associativity rules - for KISS, left-associative binary operations for now
  let result = stack[0];
  for (let i = 1; i < stack.length; i += 2) {
    let operator = stack[i].str;
    if (typeof operator !== 'string') lexer.error("Invalid operator");
    let rightOperand = stack[i + 1];
    result = op(operator, [result, rightOperand]);
  }
  return result;
}

function parseExpression(lexer: Lexer): Node {
  let stack = [];
  while (true) {
    let token = lexer.peekTokenCanBeEof();
    // TODO: use langdef.ts
    if (!token || ['+', '-', '*', '/', ')'].includes(token.type)) {
      break; // Stop at an operator or end of expression
    }
    stack.push(parseAtom(lexer));
  }
  return resolveExpressionStack(lexer, stack);
}
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

function parseList(lexer: Lexer): Node {
  const elements: Node[] = [];

  while (true) {
    const token = lexer.peekToken();
    if (!token || token.value === ')') {
      lexer.eatToken(); // Consume the closing ')'
      break;
    }
    if (token.value === '(') {
      lexer.eatToken(); // Consume the opening '('
      elements.push(parseList(lexer)); // Recursively parse the nested list
    } else {
      elements.push(parseAtom(lexer)); // Parse an atom
    }
  }

  const listNode = list();
  listNode.children = elements;
  return listNode;
}

function parseFunctionDeclaration(lexer: Lexer): Node {
  lexer.eatToken('ident', 'fun');
  const funcname = lexer.eatToken('ident').value;
  let params: Node[] = [];
  while(true) {
    const token = lexer.eatToken();
    if (token.value === ')') break;
    if (token.type !== 'ident') lexer.error("Expected parameter identifier");
    params.push(ident(token.value));
    // TODO: opt type, e.g. 'float' in 'foo(x float)'
  }
  const t = lexer.eatTokenIfType('op', ':');
  const rtype = (t) ? lexer.eatToken().value : null; // consume optional return type
  const body = parseList(lexer);
  return def(funcname, func(params, body, rtype), rtype);
}

function parseOperation(lexer: Lexer): Node {
  let operator = lexer.eatToken('op').value;
  let operands = [parseAtom(lexer), parseAtom(lexer)]; // TODO: unary/ternary
  return op(operator, operands);
}

function parseVariableDeclaration(lexer: Lexer): Node {
  const varname = lexer.eatToken('ident').value;
  const type = lexer.eatTokenIfType('ident')?.value; // e.g. "float"
  lexer.eatToken('op', '=');
  const value = parseExpression(lexer);
  return def(varname, value, type);
}

function parseControl(lexer: Lexer): Node {
  let type = lexer.eatToken().value; // e.g. 'if', 'while'
  let condition = parseExpression(lexer); // parse condition
  let body = parseList(lexer); // parse body
  return ctrl(type, condition, body);
}

function parseSexpr(lexer: Lexer): Node {
  if (lexer.peekToken().value === '(') {
    lexer.eatToken('op', '(');
    return parseSexprList(lexer); // TODO: check cases
  } else {
    return parseAtom(lexer);
  }
}

export function parseSexprList(lexer: Lexer): Node {
  let x = list();
  while(lexer.peekToken()) {
    if (lexer.peekToken().value === ')' ) { lexer.eatToken('op', ')'); break; } // TODO: might accept extra ')' at eof..
    x.children!.push( parseSexpr(lexer) );
  }
  return x;
}

export function parseStmt(lexer: Lexer): Node | undefined {
  const t = lexer.peekToken();
  if (t.type == 'ident') {
    // TODO: the usual recursive descent
    // let sexpr = parse(lexer);
    // list = addchild(list, sexpr);
  }
  return undefined;
}

export function parseModule(lexer: Lexer): Node {
  let x = list();
  let t;
  while(t = lexer.peekTokenCanBeEof()) {
    if (lexer.lang == 'nih-sexpr') {
      return parseSexprList(lexer); // TODO: should be able to switch back as well!
    } else {
      x = addChild(x, parseStmt(lexer));
    }
  }
  return x;
}
