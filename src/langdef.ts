// NOTE: 
//   The order matters!
//   - Parsing checks the more specialized cases first, for example ' + ' vs '+'
//------------------------------------------------------------------------
//  Operators
//------------------------------------------------------------------------
// NOTE: unsigned left shift is same for signed/unsigned, but keep own operator for clarity
// TODO: add/sub/mul/div ' + ', ' - ', ' * ', ' / ' must have ws around, make a good error for that..
// TODO: integer divide? Or just cast, clearer?
const operators = [                                                        // Operator:
  '<', '<=', '>', '>=', '==', '!=',                                        //  relational
  '+=', '-=', '*=', '/=', '%=', '**=', '|>=', '=',                         //  assignment
  '^',                                                                     //  exponentation (NOTE: bitwise xor is '^^')
  ' + ', ' - ', ' * ', ' / ', ' % ',                                       //  arithmetic
  '+', '-',                                                                //  unary / arithmetic in sexpr
  '*', '/',                                                                //  arithmetic in sexpr
  '|>',                                                                    //  piping/chaining
  '!', '&&', '||',                                                         //  logical
  '&', '|',                                                                //  logical/bitwise
  '<<<', '>>>', '<<@', '>>@', '<<', '>>', '~', '^^',                       //  bitwise
  '.',                                                                     //  dot
  '?',                                                                     //  ternary
  '(', ')',                                                                //  ..let's not forget parens..
  ':',                                                                     //  block begin / type annotations in sexpr
];
const operatorSet = new Set(operators);
//------------------------------------------------------------------------
//  Keywords
//------------------------------------------------------------------------
const keywords = [
  'alias',
  'break', 
  'call', 'case', 'const', 'continue',
  'dec', 'default', 'doc', 'do', 
  'else', 'enum',
  'foreach', 'forlt', 'for', 'fn',
  'get',
  'if', 'inc!',
  'let',
  'pure',
  'return',
  'set!', 'struct', 'switch',
  'type',
  'uniform',
  'while',
  'plist',
  'param',
];
const keywordSet = new Set(keywords);
//------------------------------------------------------------------------
//  Native types
//------------------------------------------------------------------------
const ntypes = [
  'bool', 'bvec2', 'bvec3', 'bvec4',
  'char',
  'float', 'f16', 'f32', 'f64',
  'int', 'ivec2', 'ivec3', 'ivec4',
  'mat4x3', 'mat3', 'mat4',
  's8', 's16', 's32', 's64', 's128', 'sampler2D', 'sampler3D', 'samplerCube', 'string',
  'texture',
  'uint', 'u8', 'u16', 'u32', 'u64', 'u128', 'uvec2', 'uvec3', 'uvec4',
  'vec2', 'vec3', 'vec4', 'void',
];
const ntypeSet = new Set(ntypes);
//------------------------------------------------------------------------
//  Native functions/macros
//------------------------------------------------------------------------
const nfuncs = [
  'abs', 'asin', 'acos', 'atan',
  'ceil', 'clamp', 'cos', 'cross', 
  'degrees', 'ddx', 'ddy', 'ddz', 'distance', 'dot',
  'exp2', 'exp',
  'fract', 'floor',
  'inverse', 'invsqrt',
  'length', 'lerp',
  'min', 'mix', 'mod',
  'normalize',
  'log2', 'log',
  'radians', 'rand', 'rcl', 'rcr', 'rol', 'ror',
  'pow', 'printchars', 'printlf', 'print', 
  'saturate', 'sign', 'sin', 'smoothstep', 'step', 'sqrt',
  'tan', 'texturesize', 'transpose', 'trunc', 
];
const nfuncSet = new Set(nfuncs);
//------------------------------------------------------------------------
//  Native variables
//------------------------------------------------------------------------
const nvars = [
  'CURSOR',
  'FRAMERATE', 'FRAME',
  'RESOLUTION',
  'TIMEDELTA', 'TIME',
  'SAMPLERATE',
];
const nvarSet = new Set(nvars);
//------------------------------------------------------------------------
//  Langdef API
//------------------------------------------------------------------------
export function isOperator   (name: string): boolean { return operatorSet.has(name); }
export function isKeyword    (name: string): boolean { return keywordSet.has(name); }
export function isNativeType (name: string): boolean { return ntypeSet.has(name); }
export function isNativeFunc (name: string): boolean { return nfuncSet.has(name); }
export function isNativeVar  (name: string): boolean { return nvarSet.has(name); }
//------------------------------------------------------------------------
interface ParseR {
  str: string,
  start: number,
  end: number
}
const matchOrderedWordsBruteForce = (words: string[], src: string, index: number): ParseR | null => {
  for (let i = 0; i < words.length; ++i) {
    const word = words[i];
    const s = src.substring(index, index + word.length);
    if (s === word) {
      return {str: s, start: index, end: index + word.length};
    }
  }
  return null;
}
export function matchOperator(src: string, index: number): ParseR | null   { return matchOrderedWordsBruteForce(operators, src, index); }
export function matchKeyword(src: string, index: number): ParseR | null    { return matchOrderedWordsBruteForce(keywords, src, index); }
export function matchNativeType(src: string, index: number): ParseR | null { return matchOrderedWordsBruteForce(ntypes, src, index); }
export function matchNativeFunc(src: string, index: number): ParseR | null { return matchOrderedWordsBruteForce(nfuncs, src, index); }
export function matchNativeVar(src: string, index: number): ParseR | null  { return matchOrderedWordsBruteForce(nvars, src, index); }
