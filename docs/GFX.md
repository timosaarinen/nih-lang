# Graphics/runtime: OpenGL2030 absorbed into NIH

`opengl2030` explored a small backend-neutral rendering layer for browser and native code. NIH v2 folds the useful architectural ideas into the language/runtime instead of maintaining a second parallel abstraction project.

## Keep

- tiny API surface
- WebGPU / native backend boundary hidden from application code
- command recording before backend submission
- frame state (`time`, `dt`, dimensions, frame number)
- null backend for tests and headless tooling
- shader-friendly vector/math vocabulary
- browser and native hosts sharing concepts

## Change

The old project had to duplicate vector types, swizzles, uniforms and shader concepts in JavaScript/C because the host language and shader language were separate. NIH removes that duplication: vectors, swizzles and GPU-portable functions are language features.

The runtime should therefore be intentionally boring. It owns windows/canvases, devices, resources, queues, synchronization and presentation. It should not reinvent math or create another shader DSL.

## Direction

WebGPU is the first bootstrap GPU API because WGSL gives the compiler a concrete target and WebGPU maps cleanly to modern explicit GPU concepts. Native Vulkan/Metal/D3D12 can follow behind the same runtime model. WebGL2 can exist as a compatibility backend if it earns its complexity.

`runtime/web/gfx.mjs` is the first tiny host: WebGPU + null backend, a frame loop and command recording. It is intentionally not yet a production renderer.

Longer-term NIH source should be able to express something conceptually like:

```nih
fn tonemap(c: vec3) -> vec3
  c / (c + 1.0)

gpu fn pixel(uv: vec2, time: f32) -> vec4
  c = render-scene(uv, time)
  vec4(tonemap(c), 1.0)

cpu fn frame(gfx: gfx.Context)
  gfx.draw(fullscreen, pixel)
```

The critical property is that `tonemap` is one function, not a CPU copy and shader copy kept approximately in sync.
