import type { TypeName } from './ast.js'

export interface Builtin {
  args: TypeName[] | 'variadic-numeric' | 'print'
  returns: TypeName | 'same' | 'vector-of-first'
  gpu: boolean
}

export const builtins: Record<string, Builtin> = {
  print: { args: 'print', returns: 'void', gpu: false },
  sin: { args: ['f32'], returns: 'f32', gpu: true },
  cos: { args: ['f32'], returns: 'f32', gpu: true },
  sqrt: { args: ['f32'], returns: 'f32', gpu: true },
  abs: { args: 'variadic-numeric', returns: 'same', gpu: true },
  min: { args: 'variadic-numeric', returns: 'same', gpu: true },
  max: { args: 'variadic-numeric', returns: 'same', gpu: true },
  clamp: { args: 'variadic-numeric', returns: 'same', gpu: true },
  saturate: { args: 'variadic-numeric', returns: 'same', gpu: true },
  lerp: { args: 'variadic-numeric', returns: 'same', gpu: true },
  dot: { args: 'variadic-numeric', returns: 'f32', gpu: true },
  length: { args: 'variadic-numeric', returns: 'f32', gpu: true },
  normalize: { args: 'variadic-numeric', returns: 'same', gpu: true },
  vec2: { args: 'variadic-numeric', returns: 'vec2', gpu: true },
  vec3: { args: 'variadic-numeric', returns: 'vec3', gpu: true },
  vec4: { args: 'variadic-numeric', returns: 'vec4', gpu: true }
}

export function isNumeric(type: TypeName): boolean {
  return type === 'i32' || type === 'u32' || type === 'f32' || type === 'vec2' || type === 'vec3' || type === 'vec4'
}
