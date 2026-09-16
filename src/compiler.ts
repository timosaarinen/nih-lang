import { check, type CheckedProgram } from './checker.js'
import { parse } from './parser.js'

export function compile(source: string): CheckedProgram {
  return check(parse(source))
}
