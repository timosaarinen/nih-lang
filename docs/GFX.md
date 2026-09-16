# NIH graphics runtime

OpenGL2030 is folded into NIH as a deliberately small host/runtime layer. The language owns numeric types, vector math, swizzles and GPU-portable functions; the runtime owns windows/canvases, devices, frame timing, resources, command submission and backend-specific plumbing.

## Bootstrap architecture

```text
NIH source
   |
   +--> parser/checker --> CPU interpreter
   |
   +--> parser/checker --> WGSL emitter --> tiny WebGPU stage wrapper --> GPU

host runtime
   |
   +--> frame state / uniforms
   +--> WebGPU device/canvas
   +--> command submission
   +--> null backend for headless tests
```

The practical GPU demos intentionally use tiny handwritten WGSL wrappers for WebGPU entry-point builtins while all reusable math/render logic is generated from NIH. This avoids designing stage annotations before real rendering pressure tells us what NIH actually needs.

## Current demos

Build generated shaders:

```bash
npm run build:demos
```

Then serve `runtime/web` from any local HTTP server and open:

- `triangle.html` — rotating triangle
- `portal.html` — same triangle with procedural tunnel/portal fragment logic

The wrappers pass `time`, `aspect`, dimensions, vertex-local coordinates and barycentrics into NIH-generated functions.

## What survives from OpenGL2030

- very small graphics surface
- command/display-list mindset before backend submission
- backend isolation
- frame state (`time`, `dt`, dimensions, frame number)
- null/headless backend
- shader-friendly math ergonomics
- browser/native hosts sharing concepts

What does **not** survive is parallel JS/C/shader math implementations. That code belongs in NIH once.

## Direction

Near term:

1. native NIH stage entry syntax after the demo requirements stabilize
2. typed uniform/storage layouts generated from NIH structs
3. vertex/index/storage buffers
4. textures/samplers
5. compute dispatch
6. shader compilation diagnostics mapped back to NIH source
7. GPU timestamp queries and capture harness

Later the host API should be expressible conceptually as:

```nih
fn tonemap(c: vec3) -> vec3 { c / (c + 1.0) }

gpu fn pixel(uv: vec2, time: f32) -> vec4 {
  c = render_scene(uv, time);
  vec4(tonemap(c), 1.0)
}

cpu fn frame(gfx: gfx.Context) {
  gfx.draw(fullscreen, pixel);
}
```

The critical property is that `tonemap` is one function, not a CPU copy and shader copy kept approximately in sync.
