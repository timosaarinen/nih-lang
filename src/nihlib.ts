import { emitJs } from './emitjs';
import { Lexer } from './lexer';
import { parseModule } from './parser';

export function compileAndRun(sourcecode: string, filename: string) {
  let lexer   = new Lexer(sourcecode, filename);
  console.log("--- parseModule() ---"); // TODO: temp
  let ast     = parseModule(lexer);
  let jscode  = emitJs(ast);
  // ..and just eval the JS for now:
  eval(jscode);
}
