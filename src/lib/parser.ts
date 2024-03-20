import { Lexer } from "./lexer.js"; // TODO: fix for requiring '.js'
import { AST } from "./ast.js";

function parseAtom(lexer: Lexer): AST.Node {
  const token = lexer.eatToken();
  if (!token) throw new Error("Unexpected end of input");

  switch (token.type) {
    case 'number':
      return AST.numlit(parseFloat(token.value!));
    case 'string':
      return AST.strlit(token.value!);
    case 'ident':
      return AST.ident(token.value!);
    default:
      throw new Error(`Unexpected token: ${token.type}`);
  }
}

function parseList(lexer: Lexer): AST.Node {
  const elements: AST.Node[] = [];

  while (true) {
    const token = lexer.peekToken();
    if (!token || token.type === ')') {
      lexer.eatToken(); // Consume the closing ')'
      break;
    }
    if (token.type === '(') {
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

function parse(lexer: Lexer): AST.Node {
  const token = lexer.peekToken();
  if (!token) lexer.error("Unexpected end of code");

  let result;
  if (token.type === '(') {
    lexer.eatToken(); // Consume the opening '('
    result = parseList(lexer);
  } else {
    result = parseAtom(lexer);
  }
  return result;
}

export function parseSexpr(lexer: Lexer): AST.Node {
  let list = AST.list();
  while(lexer.peekToken()) {
    let sexpr = parse(lexer);
    list = AST.addchild(list, sexpr);
  }
  return list;
}
