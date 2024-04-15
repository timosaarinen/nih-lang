import { Lexer } from "./lexer.js"; // TODO: fix for requiring '.js'
import { AST } from "./ast.js";

function parseAtom(lexer: Lexer): AST.Node {
  const t = lexer.eatToken();
  switch (t.type) {
    case 'number':
      return AST.numlit(parseFloat(t.value));
    case 'string':
      return AST.strlit(t.value);
    case 'ident':
      return AST.ident(t.value);
    default:
      lexer.error(`Unexpected token: ${t.type}`, t);
  }
}

function resolveExpressionStack(lexer: Lexer, stack: AST.Node[]): AST.Node {
  // TODO: precedence and associativity rules - for KISS, left-associative binary operations for now
  let result = stack[0];
  for (let i = 1; i < stack.length; i += 2) {
    let operator = stack[i].str;
    if (typeof operator !== 'string') lexer.error("Invalid operator");
    let rightOperand = stack[i + 1];
    result = AST.op(operator, [result, rightOperand]);
  }
  return result;
}

function parseExpression(lexer: Lexer): AST.Node {
  let stack = [];
  while (true) {
    let token = lexer.peekTokenCanBeEofNull();
    if (!token || ['+', '-', '*', '/', ')'].includes(token.type)) {
      break; // Stop at an operator or end of expression
    }
    stack.push(parseAtom(lexer));
  }
  return resolveExpressionStack(lexer, stack);
}
// function parseExpression(lexer: Lexer): AST.Node {
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

function parseList(lexer: Lexer): AST.Node {
  const elements: AST.Node[] = [];

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

  const listNode = AST.list();
  listNode.children = elements;
  return listNode;
}

function parseFunctionDeclaration(lexer: Lexer): AST.Node {
  lexer.eatToken('ident', 'fun');
  const funcname = lexer.eatToken('ident').value;
  let params: AST.Node[] = [];
  while(true) {
    const token = lexer.eatToken();
    if (token.value === ')') break;
    if (token.type !== 'ident') lexer.error("Expected parameter identifier");
    params.push(AST.ident(token.value));
    // TODO: opt type, e.g. 'float' in 'foo(x float)'
  }
  const t = lexer.eatTokenIfType('op', ':');
  const rtype = (t) ? lexer.eatToken().value : null; // consume optional return type
  const body = parseList(lexer);
  return AST.def(funcname, AST.func(params, body, rtype), rtype);
}

function parseOperation(lexer: Lexer): AST.Node {
  let operator = lexer.eatToken('op').value;
  let operands = [parseAtom(lexer), parseAtom(lexer)]; // TODO: unary/ternary
  return AST.op(operator, operands);
}

function parseVariableDeclaration(lexer: Lexer): AST.Node {
  const varname = lexer.eatToken('ident').value;
  const type = lexer.eatTokenIfType('ident')?.value; // e.g. "float"
  lexer.eatToken('op', '=');
  const value = parseExpression(lexer);
  return AST.def(varname, value, type);
}

function parseControl(lexer: Lexer): AST.Node {
  let type = lexer.eatToken().value; // e.g. 'if', 'while'
  let condition = parseExpression(lexer); // parse condition
  let body = parseList(lexer); // parse body
  return AST.ctrl(type, condition, body);
}

function parseSexpr(lexer: Lexer): AST.Node {
  if (lexer.peekToken().value === '(') {
    lexer.eatToken('op', '(');
    return parseSexprList(lexer); // TODO: check cases
  } else {
    return parseAtom(lexer);
  }
}

export function parseSexprList(lexer: Lexer): AST.Node {
  let list = AST.list();
  while(lexer.peekToken()) {
    if (lexer.peekToken().value === ')' ) { lexer.eatToken('op', ')'); break; } // TODO: might accept extra ')' at eof..
    list.children!.push( parseSexpr(lexer) );
  }
  return list;
}

export function parseNihStmt(lexer: Lexer): AST.Node {
  const t = lexer.peekToken();
  if (t.type == 'ident') {
    // TODO: fun, set, call... except this ain't S-expr..
    //    foo = 42, bar(42), 
    switch(t.value) {
      case 'fun': // function declaration
        parseFunctionDeclaration(lexer);
        break;
    case 'ident':
      switch()
  }

}

export function parseNih(lexer: Lexer): AST.Node {
  let list = AST.list();
  while(lexer.peekTokenCanBeEofNull()) {
    AST.addchild()
    const t = lexer.peekToken(); // TODO: peek if nothing?
    if (t.type == 'ident') {
      // TODO: fun, set, call... except this ain't S-expr..
      //    foo = 42, bar(42), 
      switch(t.value) {
        case 'fun': // function declaration
          parseFunctionDeclaration(lexer);
          break;
      case 'ident':
        switch()
    }

    // TODO: branch depending on first token, dat recursive descent!
    switch()
    if ()

    let sexpr = parse(lexer);
    list = AST.addchild(list, sexpr);
  }
  return list;  
}

export function parse(lexer: Lexer): AST.Node {
  if (lexer.nih()) {
    return parseNih(lexer);
  } else {
    return parseSexprList(lexer);
  }
}
