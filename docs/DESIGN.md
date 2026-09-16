# NIH v2 design

NIH is a general-purpose language with a deliberately portable computational core. The same ordinary function should be usable by CPU code and GPU code unless the function asks for a capability that only one side has.

## The important rule

**Targets are capabilities, not separate languages.**

- `fn`: shared/portable code. CPU-executable and GPU-translatable.
- `cpu fn`: unrestricted host-side code. I/O, files, sockets, OS APIs, allocation-heavy work, tooling.
- `gpu fn`: GPU-side code. It can call shared functions but not CPU-only functions.

That makes the common path boring: vector math, geometry, noise, SDFs, BRDFs, image operations, simulation kernels and numeric utility code are written once.

The compiler intentionally has no automatic magic that guesses where expensive work should run. Placement stays explicit; code reuse does not.

## Source syntax: agent-native, meatbag-readable

Whitespace is **never semantic** in NIH v2.

```nih
fn pulse(x: f32, t: f32) -> f32 {
  0.5 + 0.5 * sin(x * 6.2831853 + t)
}
```

is the same program as:

```nih
fn pulse(x:f32,t:f32)->f32{0.5+0.5*sin(x*6.2831853+t)}
```

Rules:

- `{}` define blocks.
- `;` terminates statements.
- a final expression may omit `;` immediately before `}` and becomes the block's value.
- spaces, tabs and newlines are formatting only.
- `//` and `/* ... */` comments are supported.
- identifiers use letters/digits/`_`; `-` is always subtraction, so compact source stays unambiguous.
- the formatter owns presentation; the parser owns structure.

Why: source will increasingly be authored, transformed and patched by software agents. Invisible layout should not change semantics, and a patch should remain valid if a formatter, model, transport or copy/paste path changes indentation.

Token count is also a consideration: repeated indentation is not free context. Exact tokenization varies by model, but explicit compact source can be emitted without carrying indentation on every nested line. NIH should optimize for **unambiguous structure per token**, not clever token golf that makes code harder to reason about.

Agent-oriented language rules should prefer:

- explicit local delimiters and boundaries
- deterministic formatting
- few context-sensitive grammar rules
- one canonical spelling for important constructs
- diagnostics with exact source spans
- syntax that is safe to generate in fragments
- easy AST/source round-tripping
- no semantic dependence on column position

Human-oriented source should still be pleasant after formatting. These goals are compatible.

## Compiler pipeline

1. whitespace-insensitive lexer
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

## GPU proof before GPU abstraction

NIH should earn its GPU design by drawing pixels early.

The first practical ladder is:

1. rotating triangle using NIH-generated WGSL helpers
2. the same rotating triangle with a procedural portal surface
3. full-screen portal benchmark
4. compute/storage-buffer tests
5. explicit native NIH vertex/fragment/compute entry declarations

During the bootstrap, tiny WGSL stage wrappers are acceptable for WebGPU builtins and uniforms. Numeric/render logic must live in NIH. Once the required semantics are proven, stage IO becomes native NIH syntax rather than inventing a large annotation system up front.

## What NIH should not copy from Mojo

NIH should learn from Mojo's ambition without inheriting a large Python-compatibility surface or making the language feel like a collection of compiler implementation details. The design target is small enough to hold in one programmer's head.

Prefer:

- one obvious spelling
- explicit capability boundaries
- few context-sensitive rules
- data-oriented value types
- excellent diagnostics
- fast edit/run/debug loop
- syntax that survives copy/paste, generated patches and git diffs

Avoid feature accumulation as a proxy for power.

## Self-hosting

TypeScript is the bootstrap implementation, not a language commitment. NIH should become able to compile increasing portions of itself once the type system, memory model and native/WASM backend are mature enough. Do not block useful language/GPU experiments on premature self-hosting.
