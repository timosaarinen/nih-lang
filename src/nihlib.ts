import { emitjs } from './emitjs';
import { Lexer } from './lexer';
import { parseModule } from './parser';

export function compileAndRun(sourcecode: string, filename: string) {
  let lexer   = new Lexer(sourcecode, filename);
  let ast     = parseModule(lexer);
  let jscode  = emitjs(ast);
  // ..and just eval the JS for now:
  eval(jscode);
}
