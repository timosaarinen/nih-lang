#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { compile } from './compiler.js'
import { run } from './interpreter.js'
import { emitWgsl } from './wgsl.js'

const [command, file, entry] = process.argv.slice(2)

if (!command || command === 'help' || command === '--help' || command === '-h') {
  usage(0)
}
if (!file) usage(1)

try {
  const source = await readFile(file, 'utf8')
  const program = compile(source)
  if (command === 'check') {
    console.log(`ok: ${program.functions.length} functions`)
  } else if (command === 'run') {
    const value = run(program, entry ?? 'main')
    if (value !== undefined) console.log(`=> ${format(value)}`)
  } else if (command === 'gpu') {
    process.stdout.write(emitWgsl(program, entry))
  } else {
    console.error(`unknown command: ${command}`)
    usage(1)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}

function format(v: unknown): string { return Array.isArray(v) ? `(${v.join(', ')})` : String(v) }
function usage(code: number): never {
  console.log(`NIH v2 bootstrap compiler\n\nusage:\n  nih check <file.nih>\n  nih run <file.nih> [function]\n  nih gpu <file.nih> [gpu-function]\n`)
  process.exit(code)
}
