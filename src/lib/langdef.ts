// NOTE: the order matters! As parsing checks the more specialized cases first, for example ' + ' vs '+'

// TODO: add types: "\\b(int|uint|float|char|string|bool|void|u8|u16|u32|u64|u128|s8|s16|s32|s64|s128|f16|f32|f64|vec2|vec3|vec4|bvec2|bvec3|bvec4|ivec2|ivec3|ivec4|uvec2|uvec3|uvec4|mat3|mat4x3|mat4|sampler2D|sampler3D|samplerCube|texture)\\b"
// TODO: add macros: "\\b(print|printchars|printlf|log)\\b"
// TODO: add native variables? "\\b(RESOLUTION|TIME|TIMEDELTA|FRAME|FRAMERATE|SAMPLERATE|CURSOR)\\b"
// TODO: add native functions? "\\b(sin|cos|tan|asin|acos|atan|exp|exp2|log|log2|pow|sqrt|invsqrt|abs|sign|floor|ceil|trunc|fract|mod|min|max|clamp|saturate|mix|lerp|smoothstep|step|length|distance|dot|cross|normalize|reflect|refract|inverse|transpose|texture|texturesize|ddx|ddy|rand|degrees|radians|time|resolution)\\b"

//------------------------------------------------------------------------
//  Operators
//------------------------------------------------------------------------
// NOTE: unsigned left shift is same for signed/unsigned, but keep own operator for clarity
// TODO: add/sub/mul/div ' + ', ' - ', ' * ', ' / ' must have ws around, make a good error for that..
// TODO: integer divide? Or just cast, clearer?
const operators = [                                                        // Operator:
  '<', '<=', '>', '>=', '==', '!=',                                        //  relational
  '+=', '-=', '*=', '/=', '%=', '**=', '|>=', '=',                         //  assignment
  '**',                                                                    //  exponentation
  ' + ', ' - ', ' * ', ' / ', ' % ',                                       //  arithmetic
  '+', '-',                                                                //  unary
  '|>',                                                                    //  piping/chaining
  'USHL', '<<<', 'USHR', '>>>',                                            //  unsigned bitwise shift left/right
  'ROTL', '<<@', 'ROTR', '>>@',                                            //  bitwise rotate left/right
  'and', '&&', 'or', '||', 'not', '!',                                     //  logical
  'AND', '&', 'OR', '|', 'SHL', '<<', 'SHR', '<<', 'NOT', '~', 'XOR', '^', //  bitwise
  '.',                                                                     //  dot
  '?',                                                                     //  ternary
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
  'for-each', 'for-lt', 'for', 'fun', 
  'get',
  'if', 'inc',
  'let',
  'pure',
  'return',
  'set', 'struct', 'switch',
  'type',
  'uniform',
  'while',
];
const keywordSet = new Set(keywords);
//------------------------------------------------------------------------
//  Keywords
//------------------------------------------------------------------------
"match": "\\b(int|uint|float|char|string|bool|void|u8|u16|u32|u64|u128|s8|s16|s32|s64|s128|f16|f32|f64|vec2|vec3|vec4|bvec2|bvec3|bvec4|ivec2|ivec3|ivec4|uvec2|uvec3|uvec4|mat3|mat4x3|mat4|sampler2D|sampler3D|samplerCube|texture)\\b"

//------------------------------------------------------------------------
export function isOperator(name: string): boolean { return operatorSet.has(name); }
export function isKeyword (name: string): boolean { return keywordSet.has(name); }
//------------------------------------------------------------------------
export function parseOperator(src: string, index: number): [string, number, number] | null {
  // TODO: make more performant than brute-force looping
  for (let i = 0; i < operators.length; ++i) {
    const op = operators[i];
    const s = src.substring(index, index + op.length);
    if (s === op) {
      return [s, index, index + s.length];
    }
  }
  return null;
}
