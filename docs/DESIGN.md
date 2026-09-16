# NIH v3 design

NIH is a small general-purpose systems/numeric language whose first hard problem is unified CPU/GPU programming. V3 adds a second hard requirement: the compiler must be a good API for coding agents without turning human source into an AST serialization format.

## 1. Source is for people and Git

`.nih` is ordinary UTF-8 text. Whitespace is non-semantic. Blocks use braces and statements use semicolons. The formatter produces one deterministic presentation.

Identifiers use `_`; `-` always means subtraction. Syntax should remain unambiguous after minification.

## 2. Semantics are for tools and agents

After parsing/type checking, NIH exposes a semantic graph. V3 graph nodes cover functions, compile-time parameters, runtime parameters, locals, calls and literals. Edges currently model calls. Function nodes include target, inferred effects and executable capabilities.

The graph hash is SHA-256 over canonical formatted semantics, so indentation/comments do not create false concurrency conflicts.

The semantic graph is **not** a persistent database and is not the source of truth. It can always be rebuilt from `.nih`.

## 3. Checked patch protocol

Agent edits use optimistic concurrency:

1. query graph and receive hash `H`
2. construct operations against semantic IDs
3. submit with `expect: H`
4. compiler rejects if current hash != `H`
5. operations mutate the parsed program
6. full checker runs again
7. deterministic source is produced

This gives agents small edit surfaces without abandoning normal Git workflows.

## 4. CPU/GPU target model

- `fn`: shared portable code
- `cpu fn`: host-only code/effects
- `gpu fn`: device-side code

Portable/GPU functions may not call CPU-only functions or builtins. V3 begins transitive effect inference (`print` → `io`) in the semantic graph. Longer-term the checker should move from hardcoded target exceptions toward a compact capability/effect lattice.

## 5. Compile time is the same language

Inspired by Mojo, NIH visually separates compile-time and runtime arguments:

```nih
fn tile[SIZE: i32](x: f32) -> f32 { ... }
tile[16](x);
```

`comptime if` is evaluated during specialization. V3 accepts scalar value parameters only (`i32/u32/f32/bool`). The CPU interpreter binds them directly; WGSL emission creates concrete specialized functions.

Type parameters, constraints and target introspection are intentionally deferred until real kernels demand them.

## 6. Backend pipeline

Current bootstrap:

```text
source → AST → checker ─┬→ semantic graph / patches / formatter
                        ├→ CPU interpreter
                        └→ specialization → WGSL
```

Next:

```text
source → typed semantic layer → SSA-ish backend IR → CPU/WASM/WGSL/SPIR-V/etc.
```

The semantic graph and backend IR have different jobs. Agent tooling should not need to manipulate SSA for ordinary source edits.

## 7. Graphics as language pressure test

The rotating triangle and portal are regression tests for the language. Graphics APIs should stay thin: resource creation, command recording, frame state, backend submission. Numeric/shader logic belongs in NIH.

The portal benchmark is specifically useful because it pressures vectors, compile-time quality specialization, loops, textures, storage, compute, temporal state and debugging without requiring a giant application first.

## 8. Non-goals

NIH is not trying to be:

- Python-compatible
- C++ with nicer punctuation
- an AST database pretending to be a language
- a shader DSL embedded in another host language
- a language whose complexity is justified by compiler-theory elegance

The test is practical: can one programmer or one agent understand enough of NIH to make a correct change with a small context window?
