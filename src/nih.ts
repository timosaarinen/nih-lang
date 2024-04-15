import { AST } from './lib/ast.js';
import { emitJs } from './lib/emitjs.js';
import { Lexer } from './lib/lexer.js';
import { parseSexpr } from './lib/parser.js';
import { readFileSync } from 'fs';

//------------------------------------------------------------------------
function loadSourceFromFile(filename: string): string {
  try {
    const data = readFileSync(filename, 'utf8');
    return data;
  } catch (err) {
    throw new Error(`Failed to read file: ${filename}`)
  }
}

//------------------------------------------------------------------------
const filename = process.argv[2] // e.g. 'example/mandelbrot.nih' or 'example/hiihoo.nih.sexpr'
console.log(`Reading source file: ${filename}`)
const sourcecode = loadSourceFromFile(filename)

console.log("------------------------")
console.log(sourcecode)
console.log("------------------------")

let lexer = new Lexer(sourcecode, filename)
lexer.debugDump()
console.log("------------------------")

let ast = parse(lexer)
AST.debugDump(ast)
console.log("------------------------")

let jscode = emitJs(ast)
console.log(jscode)
console.log("------------------------")

eval(jscode)
