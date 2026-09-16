# NIH

**A small, pragmatic language for CPU + GPU code.**

NIH v2 is a clean restart of the original NIH language experiment and absorbs the useful ideas from **OpenGL2030**. The central bet is simple:

> You should not need one language for the CPU, another for shaders, and a pile of glue pretending they are the same program.

Write ordinary numeric code once. Run it on the CPU. Reuse it from GPU functions. Debug GPU-portable functions on the CPU. Keep the host/device boundary explicit without maintaining two implementations of your math.

This repo is early and intentionally opinionated. API and syntax changes are expected.

## 30-second demo

```nih
fn pulse(x: f32, t: f32) -> f32
  0.5 + 0.5 * sin(x * 6.2831853 + t)

cpu fn main() -> f32
  p = pulse(0.25, 1.0)
  print("CPU says", p)
  p

gpu fn pixel(x: f32, t: f32) -> vec4
  p = pulse(x, t)
  vec4(p, p * 0.35, 1.0 - p, 1.0)
```

`pulse` is not a shader-language copy. It is the same function used by both targets.

```bash
npm install
npm run build
node dist/src/cli.js run examples/unified.nih
node dist/src/cli.js gpu examples/unified.nih pixel
```

The second command emits WGSL and automatically includes shared functions needed by `pixel`.

## Target model

| NIH | Meaning |
| --- | --- |
| `fn` | portable/shared: CPU-executable and GPU-translatable |
| `cpu fn` | host code; may use CPU-only capabilities such as strings/I/O |
| `gpu fn` | GPU code; may call portable functions, never CPU-only ones |

This is a capability boundary, not three languages.

## What already works in the bootstrap

- indentation-significant source; tabs rejected
- `fn`, `cpu fn`, `gpu fn`
- `i32`, `u32`, `f32`, `bool`, `string`, `vec2`, `vec3`, `vec4`
- immutable `=` bindings and mutable `:=` bindings/updates
- arithmetic, comparisons, boolean operators and `if/else`
- vector/scalar arithmetic in the CPU reference interpreter
- `.xyzw` / `.rgba` swizzles
- portable math builtins including `sin`, `cos`, `sqrt`, `lerp`, `saturate`, `dot`, `length`, `normalize`
- CPU execution/reference emulation
- WGSL generation for GPU functions + their shared dependencies
- capability checking: portable/GPU code cannot accidentally call CPU-only `print`
- tiny WebGPU/null host runtime descended from OpenGL2030's command-list/backend split
- tests with Node's built-in test runner

## CLI

```text
nih check <file.nih>
nih run   <file.nih> [function]
nih gpu   <file.nih> [gpu-function]
```

During bootstrap the executable is `node dist/src/cli.js ...`.

## Design stance

NIH is inspired by C, Lua, Lisp, GLSL/HLSL, Rust/Nim-style modern systems work, and the joy of old-school immediate feedback loops. It is happy to steal good ideas. Hence the name.

The language should remain small enough that a working programmer can understand the important semantics without becoming a compiler researcher. "Power" is not measured by how many features fit in the manual.

Compared with Mojo, NIH shares the ambition of first-class accelerated compute, but does **not** start from Python compatibility and does not want compiler machinery leaking into everyday code. CPU/GPU reuse is the foundation rather than an advanced escape hatch.

Read [docs/DESIGN.md](docs/DESIGN.md) for the compiler/language direction and [docs/GFX.md](docs/GFX.md) for how OpenGL2030 is being folded into NIH.

## Roadmap

Near-term:

1. typed SSA-ish IR between checker and backends
2. structs, fixed arrays and address spaces
3. `f16`, matrices, textures/samplers and storage buffers
4. explicit compute/vertex/fragment entry annotations
5. source spans + significantly better diagnostics
6. native CPU backend (Cranelift/LLVM candidate) and WASM
7. WebGPU runtime that consumes NIH-generated entry points directly
8. WIDE/live debugging reborn on top of the interpreter + GPU CPU-emulation path

Later:

- whole-program specialization across CPU/GPU boundaries
- automatic host/device layout derivation
- deterministic GPU unit tests through CPU emulation
- native Vulkan/Metal/D3D12 hosts
- self-hosting compiler

## OpenGL2030

OpenGL2030 is no longer a separate architectural destination. Its useful ideas live here now: a small runtime, backend abstraction, display/command recording, frame state, vector-oriented graphics ergonomics and a null backend. The old repository can remain as historical provenance.

## License

MIT.
