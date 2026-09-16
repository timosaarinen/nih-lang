import { check, type CheckedProgram } from './checker.js'
import { parse } from './parser.js'
import { buildSemanticGraph, type SemanticGraph } from './semantic-graph.js'
export function compile(source:string):CheckedProgram{return check(parse(source))}
export function compileWithGraph(source:string):{program:CheckedProgram;graph:SemanticGraph}{const program=compile(source);return{program,graph:buildSemanticGraph(program)}}
