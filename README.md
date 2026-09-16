# NIH

**One small language for CPU + GPU code, designed for agents and still pleasant for meatbags.**

NIH v3 is the third clean iteration of the experiment. It absorbs the useful parts of OpenGL2030, steals heterogeneous-compute ideas from Mojo, and steals the strongest agent/compiler interaction idea from Zero: **agents should patch meaning, not character ranges**.

The central bets are:

1. CPU and GPU numeric code should be the same language.
2. Plain `.nih` text stays the Git-friendly source of truth.
3. The compiler exposes a typed semantic graph so agents do not need to shovel whole files through text search/replace.
4. Compile-time specialization is normal language syntax, not a second template/preprocessor language.
5. Every semantic agent patch is concurrency-checked and compiler-verified.

This repo is intentionally early and opinionated. Syntax and APIs can still change aggressively.

## Same code, CPU and GPU

```nih
fn pulse(x: f32, t: f32) -> f32 {
  0.5 + 0.5 * sin(x * 6.2831853 + t);
}

cpu fn main() -> f32 {
  pulse(0.25, 1.0);
}

gpu fn pixel(x: f32, t: f32) -> vec4 {
  p = pulse(x, t);
  vec4(p, p * 0.35, 1.0 - p, 1.0);
}
```

`pulse` is one function. The CPU interpreter can execute it and the WGSL backend can pull the same function into GPU output.

Whitespace is presentation, never syntax. This is the same program:

```nih
fn pulse(x:f32,t:f32)->f32{0.5+0.5*sin(x*6.2831853+t);}
```

Canonical formatting exists for humans and deterministic diffs:

```bash
nih fmt foo.nih
nih fmt foo.nih --write
```

## Mojo idea worth stealing: explicit compile-time values

Square brackets are compile-time arguments; parentheses are runtime arguments.

```nih
fn gain[G: f32](x: f32) -> f32 {
  x * G;
}

fn quality[HIGH: bool](x: f32) -> f32 {
  comptime if HIGH {
    gain[1.25](x);
  } else {
    gain[0.75](x);
  }
}

gpu fn shade(x: f32) -> f32 {
  quality[false](x);
}
```

The GPU backend specializes `quality[false]` and `gain[0.75]` before emitting WGSL. There is no runtime generic machinery in the shader.

V3 currently implements **value** compile-time parameters (`i32`, `u32`, `f32`, `bool`). Compile-time type parameters and constraints are a later step; they should earn their complexity first.

## Zero idea worth stealing: semantic agent operations

Text remains canonical in Git, but the compiler also exposes a semantic graph:

```bash
nih graph examples/gpu_portal.nih
nih query examples/gpu_portal.nih portal_surface
```

Functions have stable symbol IDs such as `fn:portal_surface`. Parameters, compile-time parameters, locals, calls and literals receive semantic IDs too. The graph contains call edges, inferred effects/capabilities and a SHA-256 hash of the canonical program semantics.

An agent can submit a checked patch:

```json
{
  "expect": "<semantic-graph-hash>",
  "ops": [
    { "op": "set-literal", "node": "lit:portal_surface:0", "value": 1.8 },
    { "op": "rename-function", "from": "fbm4", "to": "portal_fbm" }
  ]
}
```

```bash
nih patch examples/gpu_portal.nih patch.json
nih patch examples/gpu_portal.nih patch.json --write
```

If `expect` no longer matches, the patch is rejected as stale. If the resulting program fails type/capability checking, the patch is rejected. No best-effort text surgery.

The first patch operations are deliberately small: literal replacement, function rename and target change. The protocol can grow around real agent workloads instead of inventing a giant compiler-edit API upfront.

See [docs/AGENTS.md](docs/AGENTS.md).

## Target + capability model

| NIH | Meaning |
| --- | --- |
| `fn` | shared/portable; CPU-executable and GPU-translatable |
| `cpu fn` | host code; may use CPU-only effects such as I/O |
| `gpu fn` | GPU-side code; may call shared functions, never CPU-only ones |

The semantic graph additionally infers effects transitively. Today `print` introduces `io`; this is the seed of a more general effect/capability system.

## Practical GPU tests

The graphics work remains pixels-first:

1. `runtime/web/triangle.html` — real WebGPU rotating triangle using NIH-generated WGSL.
2. `runtime/web/portal.html` — same geometry, procedural tunnel/cloud portal written in NIH.
3. next: full-screen portal benchmark, then volumetric/domain-warped/temporally stable simulation work.

```bash
npm install
npm run build:demos
npm run serve:demos
```

V3 compiles the existing v2 triangle and portal NIH sources unchanged. Language work does not get to break the visual regression ladder.

## CLI

```text
nih check <file.nih>
nih run   <file.nih> [function]
nih gpu   <file.nih> [gpu-function]
nih fmt   <file.nih> [--write]
nih graph <file.nih>
nih query <file.nih> <selector>
nih patch <file.nih> <patch.json> [--write]
```

During bootstrap: `node dist/src/cli.js ...`.

## V3 compiler pipeline

```text
.nih text
   ↓
lexer / parser
   ↓
checked typed AST
   ├────────────→ deterministic formatter
   ├────────────→ semantic graph + hash → query / checked agent patch
   ├────────────→ CPU reference interpreter
   └────────────→ compile-time specialization → WGSL
```

A typed SSA-ish IR is still planned, but V3 deliberately installs the **semantic graph boundary first**. The next IR should serve optimizers/backends without becoming the format agents have to understand for ordinary edits.

## What works now

- whitespace-insensitive `{}` / `;` syntax
- deterministic formatter
- `fn`, `cpu fn`, `gpu fn`
- value compile-time parameters with `[]`
- `comptime if`
- CPU execution of specialized functions
- WGSL specialization of generic shared functions
- `i32`, `u32`, `f32`, `bool`, `string`, `vec2/3/4`
- immutable `=` and mutable `:=`
- vector/scalar arithmetic and `.xyzw` / `.rgba` swizzles
- portable math (`sin`, `cos`, `sqrt`, `floor`, `fract`, `pow`, `lerp`, `saturate`, `dot`, `length`, `normalize`, ...)
- CPU/GPU capability checking
- transitive semantic effect discovery
- deterministic semantic graph + graph hash
- graph query API
- stale-safe checked semantic patch protocol
- WebGPU triangle + portal regression demos

## Design rules

- **KISS is a constraint, not branding.** A feature must remove more complexity than it introduces.
- **Agents get structure, humans get prose.** Machine interfaces should be semantic and compact; source and diagnostics should remain readable.
- **Text stays sovereign.** No opaque binary project format and no mandatory graph database.
- **Specialization is explicit.** `[]` means compile time, `()` means runtime.
- **GPU restrictions are capabilities, not a second language.**
- **Real demos drive design.** The portal is allowed to force new language features; speculative abstractions are not.

Read [docs/DESIGN.md](docs/DESIGN.md), [docs/AGENTS.md](docs/AGENTS.md), [docs/GFX.md](docs/GFX.md) and [docs/PORTAL.md](docs/PORTAL.md).

## Near-term

1. full-screen Portal 3 benchmark
2. semantic patch operations for symbol/local edits and structured insertion
3. typed SSA-ish backend IR
4. loops, structs, fixed arrays and address spaces
5. `f16`, matrices, textures/samplers and storage buffers
6. native vertex/fragment/compute declarations
7. compile-time type parameters only where real GPU code proves useful
8. WASM/native CPU backend
9. WIDE/live debugging reborn on semantic graph + CPU shader emulation

## License

MIT.
