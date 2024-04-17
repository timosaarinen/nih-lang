import { debugDump } from './ast';
import { emitJs } from './emitjs';
import { Lexer } from './lexer';
import { parseModule } from './parser';
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

let ast = parseModule(lexer)
debugDump(ast)
console.log("------------------------")

let jscode = emitJs(ast)
console.log(jscode)
console.log("------------------------")

eval(jscode)
