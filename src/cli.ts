#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { compile, compileWithGraph } from './compiler.js'
import { run } from './interpreter.js'
import { emitWgsl } from './wgsl.js'
import { formatProgram } from './formatter.js'
import { querySemanticGraph } from './semantic-graph.js'
import { applyAgentPatch, type AgentPatch } from './patch.js'

const args=process.argv.slice(2),command=args[0],file=args[1],write=args.includes('--write')
if(!command||command==='help'||command==='--help'||command==='-h')usage(0)
if(!file)usage(1)
try{
  const source=await readFile(file,'utf8')
  if(command==='check'){const {program,graph}=compileWithGraph(source);console.log(`ok: ${program.functions.length} functions graph=${graph.hash}`)}
  else if(command==='run'){const value=run(compile(source),args[2]??'main');if(value!==undefined)console.log(`=> ${format(value)}`)}
  else if(command==='gpu')process.stdout.write(emitWgsl(compile(source),args[2]))
  else if(command==='fmt'){const out=formatProgram(compile(source));if(write)await writeFile(file,out,'utf8');else process.stdout.write(out)}
  else if(command==='graph'){const {graph}=compileWithGraph(source);console.log(JSON.stringify(graph,null,2))}
  else if(command==='query'){const selector=args[2];if(!selector)throw new Error('query requires a semantic selector, e.g. fn:portal_surface or portal_surface');const {graph}=compileWithGraph(source);console.log(JSON.stringify(querySemanticGraph(graph,selector),null,2))}
  else if(command==='patch'){const patchFile=args[2];if(!patchFile)throw new Error('patch requires a patch.json file');const patch=JSON.parse(await readFile(patchFile,'utf8')) as AgentPatch;const result=applyAgentPatch(source,patch);if(write){await writeFile(file,result.source,'utf8');console.log(`ok: ${result.hash}`)}else process.stdout.write(result.source)}
  else{console.error(`unknown command: ${command}`);usage(1)}
}catch(error){console.error(error instanceof Error?error.message:error);process.exitCode=1}
function format(v:unknown):string{return Array.isArray(v)?`(${v.join(', ')})`:String(v)}
function usage(code:number):never{console.log(`NIH v3 bootstrap compiler\n\nusage:\n  nih check <file.nih>\n  nih run <file.nih> [function]\n  nih gpu <file.nih> [gpu-function]\n  nih fmt <file.nih> [--write]\n  nih graph <file.nih>\n  nih query <file.nih> <selector>\n  nih patch <file.nih> <patch.json> [--write]\n`);process.exit(code)}
