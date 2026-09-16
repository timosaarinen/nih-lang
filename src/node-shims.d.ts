declare module 'node:fs/promises' {
  export function readFile(path: string, encoding: string): Promise<string>
}
declare module 'node:test' {
  const test: (name: string, fn: () => void | Promise<void>) => void
  export default test
}
declare module 'node:assert/strict' {
  const assert: {
    equal(a: unknown, b: unknown): void
    deepEqual(a: unknown, b: unknown): void
    match(value: string, re: RegExp): void
    doesNotMatch(value: string, re: RegExp): void
    throws(fn: () => unknown, re?: RegExp): void
  }
  export default assert
}
declare const process: {
  argv: string[]
  exitCode?: number
  stdout: { write(text: string): void }
  exit(code?: number): never
}
