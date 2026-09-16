# NIH v2 design

NIH is a general-purpose language with a deliberately portable computational core. The same ordinary function should be usable by CPU code and GPU code unless the function asks for a capability that only one side has.

## The important rule

**Targets are capabilities, not separate languages.**

- `fn`: shared/portable code. CPU-executable and GPU-translatable.
- `cpu fn`: unrestricted host-side code. I/O, files, sockets, OS APIs, allocation-heavy work, tooling.
- `gpu fn`: GPU-side code. It can call shared functions but not CPU-only functions.

That makes the common path boring: vector math, geometry, noise, SDFs, BRDFs, image operations, simulation kernels and numeric utility code are written once.

The bootstrap compiler intentionally has no automatic magic that guesses where expensive work should run. Placement stays explicit; code reuse does not.

## Compiler pipeline

1. indentation-aware lexer
2. parser -> source AST
3. type/capability checking
4. shared typed program representation
5. CPU interpreter (debug/reference execution)
6. WGSL emitter (GPU bootstrap backend)

Next backends should hang off the same checked representation:

- CPU native: LLVM or Cranelift
- CPU/WASM: WebAssembly
- GPU: SPIR-V and/or WGSL
- debug: interpreter with deterministic stepping

The typed IR should eventually replace the AST as the optimization boundary. Whole-program optimization belongs after target/capability analysis so shared code can specialize differently for CPU and GPU without splitting the source language.

## Types

The bootstrap starts with the intersection that matters for CPU/GPU work:

`i32 u32 f32 bool vec2 vec3 vec4`

`string` exists on CPU only. Vectors are language types, not a graphics-library convention. Swizzling is language syntax.

Future types: `f16`, matrices, structs, arrays/slices, pointers/references with address spaces, textures, samplers, atomics and user-defined numeric types.

## What NIH should not copy from Mojo

NIH should learn from Mojo's ambition without inheriting a large Python-compatibility surface or making the language feel like a collection of compiler implementation details. The design target is small enough to hold in one programmer's head.

Prefer:

- one obvious spelling
- explicit capability boundaries
- few context-sensitive rules
- data-oriented value types
- excellent diagnostics
- fast edit/run/debug loop
- syntax that survives copy/paste and git diffs

Avoid feature accumulation as a proxy for power.

## Self-hosting

TypeScript is the bootstrap implementation, not a language commitment. NIH should become able to compile the compiler once structs, modules, memory and native codegen are mature enough. Until then, a small TypeScript compiler keeps iteration cheap and the semantics inspectable.
