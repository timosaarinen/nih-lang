export type Target = 'shared' | 'cpu' | 'gpu'
export type TypeName = 'i32' | 'u32' | 'f32' | 'bool' | 'string' | 'void' | 'vec2' | 'vec3' | 'vec4'

export interface Program {
  functions: FunctionDecl[]
}

export interface FunctionDecl {
  target: Target
  name: string
  params: Param[]
  returnType: TypeName
  body: Stmt[]
  line: number
}

export interface Param {
  name: string
  type: TypeName
}

export type Stmt =
  | { kind: 'bind'; name: string; mutable: boolean; value: Expr; line: number }
  | { kind: 'return'; value?: Expr; line: number }
  | { kind: 'expr'; expr: Expr; line: number }
  | { kind: 'if'; condition: Expr; thenBody: Stmt[]; elseBody: Stmt[]; line: number }

export type Expr =
  | { kind: 'number'; value: number; raw: string; line: number }
  | { kind: 'string'; value: string; line: number }
  | { kind: 'bool'; value: boolean; line: number }
  | { kind: 'name'; name: string; line: number }
  | { kind: 'unary'; op: '-' | '!'; value: Expr; line: number }
  | { kind: 'binary'; op: string; left: Expr; right: Expr; line: number }
  | { kind: 'call'; callee: string; args: Expr[]; line: number }
  | { kind: 'swizzle'; value: Expr; fields: string; line: number }
