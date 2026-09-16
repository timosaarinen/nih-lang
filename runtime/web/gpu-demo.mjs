const triangleWrapper = `
struct Frame {
  time: f32,
  aspect: f32,
  width: f32,
  height: f32,
}
@group(0) @binding(0) var<uniform> frame: Frame;

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) local: vec2<f32>,
  @location(1) bary: vec3<f32>,
}

fn triangle_local(id: u32) -> vec2<f32> {
  if (id == 0u) { return vec2<f32>(0.0, 0.78); }
  if (id == 1u) { return vec2<f32>(-0.72, -0.55); }
  return vec2<f32>(0.72, -0.55);
}

fn triangle_bary(id: u32) -> vec3<f32> {
  if (id == 0u) { return vec3<f32>(1.0, 0.0, 0.0); }
  if (id == 1u) { return vec3<f32>(0.0, 1.0, 0.0); }
  return vec3<f32>(0.0, 0.0, 1.0);
}

@vertex fn vs(@builtin(vertex_index) id: u32) -> VertexOut {
  let local = triangle_local(id);
  var out: VertexOut;
  out.position = triangle_vertex(local, frame.time, frame.aspect);
  out.local = local;
  out.bary = triangle_bary(id);
  return out;
}

@fragment fn fs(input: VertexOut) -> @location(0) vec4<f32> {
  let edge = min(input.bary.x, min(input.bary.y, input.bary.z));
  return triangle_color(input.local, edge, frame.time);
}
`

export async function runGpuTriangle({ shaderUrl, canvas, status }) {
  if (!navigator.gpu) throw new Error('WebGPU is not available in this browser')
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) throw new Error('No WebGPU adapter available')
  const device = await adapter.requestDevice()
  const context = canvas.getContext('webgpu')
  if (!context) throw new Error('Could not acquire WebGPU canvas context')
  const format = navigator.gpu.getPreferredCanvasFormat()
  context.configure({ device, format, alphaMode: 'opaque' })

  const nihWgsl = await fetch(shaderUrl).then(async response => {
    if (!response.ok) throw new Error(`Could not load ${shaderUrl}: ${response.status}`)
    return response.text()
  })
  const source = `${nihWgsl}\n${triangleWrapper}`
  const module = device.createShaderModule({ label: `NIH demo ${shaderUrl}`, code: source })
  const info = await module.getCompilationInfo()
  const errors = info.messages.filter(message => message.type === 'error')
  if (errors.length) throw new Error(errors.map(e => `${e.lineNum}:${e.linePos} ${e.message}`).join('\n'))

  const pipeline = device.createRenderPipeline({
    label: 'NIH rotating triangle',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  })

  const uniformBuffer = device.createBuffer({
    label: 'NIH frame uniforms',
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  })
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
  })

  const started = performance.now()
  let frame = 0
  const render = now => {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr))
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    const time = (now - started) / 1000
    const aspect = width / height
    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([time, aspect, width, height]))

    const encoder = device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.004, g: 0.006, b: 0.018, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    })
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(3)
    pass.end()
    device.queue.submit([encoder.finish()])

    frame++
    if (status && frame === 1) status.textContent = `WebGPU · NIH-generated WGSL · ${adapter.info?.device || adapter.info?.description || 'GPU'}`
    requestAnimationFrame(render)
  }
  requestAnimationFrame(render)
}
