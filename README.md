# NIH

**A small, pragmatic language for CPU + GPU code — designed for agents, still pleasant for meatbags.**

NIH v2 is a clean restart of the original NIH language experiment and absorbs the useful ideas from **OpenGL2030**. The central bet is simple:

> You should not need one language for the CPU, another for shaders, and a pile of glue pretending they are the same program.

Write ordinary numeric code once. Run it on the CPU. Reuse it from GPU functions. Debug GPU-portable functions on the CPU. Keep the host/device boundary explicit without maintaining two implementations of your math.

This repo is early and intentionally opinionated. API and syntax changes are expected.

## 30-second demo

```nih
fn pulse(x: f32, t: f32) -> f32 {
  0.5 + 0.5 * sin(x * 6.2831853 + t)
}

cpu fn main() -> f32 {
  p = pulse(0.25, 1.0);
  print("CPU says", p);
  p
}

gpu fn pixel(x: f32, t: f32) -> vec4 {
  p = pulse(x, t);
  vec4(p, p * 0.35, 1.0 - p, 1.0)
}
```

`pulse` is not a shader-language copy. It is the same function used by both targets.

And whitespace is not syntax. This means the following is exactly the same program:

```nih
fn pulse(x:f32,t:f32)->f32{0.5+0.5*sin(x*6.2831853+t)}
```

Humans can format NIH beautifully. Agents can emit or patch compact structural source without invisible indentation changing meaning.

```bash
npm install
npm run build
node dist/src/cli.js run examples/unified.nih
node dist/src/cli.js gpu examples/unified.nih pixel
```

The second command emits WGSL and automatically includes shared functions needed by `pixel`.

## Practical GPU tests

NIH now has a real-pixels-first test ladder rather than designing GPU abstractions indefinitely.

```bash
npm run build:demos
# serve runtime/web with any local HTTP server
```

Open:

1. `runtime/web/triangle.html` — a rotating triangle. Rotation and color are NIH code compiled to WGSL and executed by WebGPU.
2. `runtime/web/portal.html` — the **same rotating triangle**, but the fragment logic is replaced with NIH procedural tunnel/cloud/portal code.

The browser wrapper is intentionally tiny: it only supplies WebGPU stage builtins, frame uniforms and draw submission. The reusable shader logic is NIH. Native NIH vertex/fragment/compute entry syntax comes after these practical tests tell us what it actually needs.

See [docs/PORTAL.md](docs/PORTAL.md) for the plan to turn the portal into a serious visual benchmark rather than stopping at a cute shader.

## Target model

| NIH | Meaning |
| --- | --- |
| `fn` | portable/shared: CPU-executable and GPU-translatable |
| `cpu fn` | host code; may use CPU-only capabilities such as strings/I/O |
| `gpu fn` | GPU code; may call portable functions, never CPU-only ones |

This is a capability boundary, not three languages.

## Source model

NIH v2 source is deliberately friendly to both software agents and people:

- whitespace-insensitive; indentation is presentation only
- `{}` are explicit blocks
- `;` is an explicit statement terminator
- final block expressions may omit `;`
- deterministic formatting can be applied without changing semantics
- source may be compacted without changing semantics
- no tab-vs-spaces language rule because neither matters
- comments: `//` and `/* ... */`
- identifiers use `_`, never `-`; subtraction is unambiguous even in minified source

Exact LLM tokenization varies, but repeated indentation is not free context. More importantly, invisible layout is a poor structural protocol for generated patches. NIH optimizes for **clear structure per token** rather than making whitespace part of the AST.

## What already works in the bootstrap

- whitespace-insensitive lexer/parser with braces and semicolons
- `fn`, `cpu fn`, `gpu fn`
- `i32`, `u32`, `f32`, `bool`, `string`, `vec2`, `vec3`, `vec4`
- immutable `=` bindings and mutable `:=` bindings/updates
- arithmetic, comparisons, boolean operators and `if/else`
- vector/scalar arithmetic in the CPU reference interpreter
- `.xyzw` / `.rgba` swizzles
- portable math including `sin`, `cos`, `sqrt`, `floor`, `fract`, `pow`, `lerp`, `saturate`, `dot`, `length`, `normalize`
- CPU execution/reference emulation
- WGSL generation for GPU functions + their shared dependencies
- capability checking: portable/GPU code cannot accidentally call CPU-only `print`
- actual WebGPU rotating-triangle demo using NIH-generated WGSL
- procedural portal-triangle demo using NIH-generated WGSL
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

The language should remain small enough that a working programmer — or coding agent — can understand the important semantics without becoming a compiler researcher. "Power" is not measured by how many features fit in the manual.

Compared with Mojo, NIH shares the ambition of first-class accelerated compute, but does **not** start from Python compatibility and does not want compiler machinery leaking into everyday code. CPU/GPU reuse is the foundation rather than an advanced escape hatch.

Read [docs/DESIGN.md](docs/DESIGN.md) for the compiler/language direction and [docs/GFX.md](docs/GFX.md) for how OpenGL2030 is folded into NIH.

## Roadmap

Near-term:

1. practical GPU demo ladder: triangle -> portal -> full-screen portal benchmark
2. typed SSA-ish IR between checker and backends
3. loops, structs, fixed arrays and address spaces
4. `f16`, matrices, textures/samplers and storage buffers
5. native vertex/fragment/compute entry declarations informed by the working demos
6. source spans + significantly better diagnostics
7. native CPU backend (Cranelift/LLVM candidate) and WASM
8. WIDE/live debugging reborn on top of the interpreter + GPU CPU-emulation path

Later:

- whole-program specialization across CPU/GPU boundaries
- automatic host/device layout derivation
- deterministic GPU unit tests through CPU emulation
- native Vulkan/Metal/D3D12 hosts
- self-hosting compiler

## OpenGL2030

OpenGL2030 is no longer a separate architectural destination. Its useful ideas live here now: a small runtime, backend abstraction, display/command recording, frame state, vector-oriented graphics ergonomics and a null backend. The old repository remains historical provenance.

## License

MIT.
