// NIH gfx host runtime, descended from the useful ideas in opengl2030.
// The language owns math/shader semantics; this file only owns the browser/device boundary.

export async function gfxOpen({ parent = document.body, backend = 'webgpu' } = {}) {
  const canvas = document.createElement('canvas')
  parent.appendChild(canvas)
  const device = backend === 'null' ? createNullBackend() : await createWebGpuBackend(canvas)
  return {
    canvas,
    device,
    frames: [],
    state: { frame: 0, time: 0, dt: 0, width: 0, height: 0 },
    closed: false
  }
}

export function gfxFrame(gfx, fn) {
  gfx.frames.push(fn)
  return () => { gfx.frames = gfx.frames.filter(x => x !== fn) }
}

export function gfxRun(gfx) {
  const started = performance.now()
  let previous = started
  const tick = now => {
    if (gfx.closed) return
    const width = Math.max(1, gfx.canvas.clientWidth || window.innerWidth)
    const height = Math.max(1, gfx.canvas.clientHeight || window.innerHeight)
    if (gfx.canvas.width !== width || gfx.canvas.height !== height) {
      gfx.canvas.width = width
      gfx.canvas.height = height
      gfx.device.resize?.(width, height)
    }
    gfx.state = {
      frame: gfx.state.frame + 1,
      time: (now - started) / 1000,
      dt: Math.min(0.1, (now - previous) / 1000),
      width,
      height
    }
    previous = now
    const commands = []
    for (const fn of gfx.frames) fn(gfx.state, commands)
    gfx.device.submit(commands)
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export function gfxClose(gfx) {
  gfx.closed = true
  gfx.device.close?.()
  gfx.canvas.remove()
}

export const clear = color => ({ op: 'clear', color })

function createNullBackend() {
  return {
    name: 'null',
    submitted: [],
    submit(commands) { this.submitted.push(structuredClone(commands)) }
  }
}

async function createWebGpuBackend(canvas) {
  if (!navigator.gpu) throw new Error('WebGPU is not available; use backend: null for tests')
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) throw new Error('No WebGPU adapter')
  const device = await adapter.requestDevice()
  const context = canvas.getContext('webgpu')
  const format = navigator.gpu.getPreferredCanvasFormat()
  context.configure({ device, format, alphaMode: 'opaque' })
  return {
    name: 'webgpu',
    submit(commands) {
      const encoder = device.createCommandEncoder()
      for (const command of commands) {
        if (command.op !== 'clear') throw new Error(`unknown gfx command ${command.op}`)
        const view = context.getCurrentTexture().createView()
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view,
            clearValue: { r: command.color[0], g: command.color[1], b: command.color[2], a: command.color[3] },
            loadOp: 'clear',
            storeOp: 'store'
          }]
        })
        pass.end()
      }
      device.queue.submit([encoder.finish()])
    }
  }
}
