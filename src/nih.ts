import { emitjs } from './emitjs.js';
import { Lexer } from './lexer.js';
import { readFileSync } from 'fs'; // node
import { dumpast, parseModule } from './parser.js';
import { glog, glogenable } from './util.js';

glogenable('verbose'); // uncomment to enable verbose mode

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
glog('verbose', `Reading source file: ${filename}`)
const sourcecode = loadSourceFromFile(filename)

glog('verbose', "---- Source code >>------------------------------------------")
glog('verbose', sourcecode)
glog('verbose', "----<< Source code-------------------------------------------\n")

let lexer = new Lexer(sourcecode, filename)

glog('verbose', "---- Tokens >>-----------------------------------------------")
for (let n=0; n < lexer.tokens.length; ++n) {
  glog('verbose', JSON.stringify(lexer.tokens[n]));
}
glog('verbose', "----<< Tokens -----------------------------------------------\n")

let ast = parseModule(lexer);

glog('verbose', "---- Abstract Syntax Tree (AST) >>---------------------------")
dumpast(ast);
glog('verbose', "----<< Abstract Syntax Tree (AST) ---------------------------\n")

let jscode = emitjs(ast)

glog('verbose', "---- JS code >>----------------------------------------------\n")
glog('verbose', jscode);
glog('verbose', "----<< JS code ----------------------------------------------\n")

//glog('verbose', "---- Executing JS code >>------------------------------------\n")
//eval(jscode)

console.log("yaya")
