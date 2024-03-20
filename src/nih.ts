import { AST } from './lib/ast.js';
import { emitJs } from './lib/emitjs.js';
import { Lexer } from './lib/lexer.js';
import { parseSexpr } from './lib/parser.js';

const testNihSource = `
(print 'Hiihoo')
(print 'The answer to life, universe and everything is $(6*7).')
`;

console.log("------------------------");

let lexer = new Lexer(testNihSource);
lexer.debugDump();
console.log("------------------------");

let ast = parseSexpr(lexer);
AST.debugDump(ast);
console.log("------------------------");

let jscode = emitJs(ast);
console.log(jscode);
console.log("------------------------");

eval(jscode);