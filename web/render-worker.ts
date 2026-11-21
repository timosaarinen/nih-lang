/// <reference lib="webworker" />
import { compileShader } from '../src/wasm'
import type { WorkerReply, WorkerRequest } from './protocol'

interface Shader {
  revision: number
  memory: WebAssembly.Memory
  render: (width: number, height: number, time: number, startY: number, endY: number) => void
}

const scope = self as unknown as DedicatedWorkerGlobalScope
const buildId = __NIH_BUILD_ID__
let active: Shader | undefined
let candidate: Shader | undefined
let latestCompile = 0
let cancellation = 0
let queue: Promise<void> = Promise.resolve()

const reply = (message: WorkerReply, transfer: Transferable[] = []) => scope.postMessage(message, transfer)
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error)
const yieldChannel = new MessageChannel()
let resumeTask: (() => void) | undefined
yieldChannel.port1.onmessage = () => { const resume = resumeTask; resumeTask = undefined; resume?.() }
const yieldTask = () => new Promise<void>((resolve) => { resumeTask = resolve; yieldChannel.port2.postMessage(null) })

async function createShader(source: string, revision: number): Promise<Shader> {
  const { bytes } = compileShader(source)
  const result = await WebAssembly.instantiate(bytes as BufferSource)
  const memory = result.instance.exports.memory
  const render = result.instance.exports.render
  if (!(memory instanceof WebAssembly.Memory) || typeof render !== 'function') {
    throw new Error('The compiled module does not expose the NIH canvas interface.')
  }
  return { revision, memory, render: render as Shader['render'] }
}

async function handle(message: WorkerRequest): Promise<void> {
  const stamp = { buildId, revision: message.revision }
  if (message.type === 'compile' || message.type === 'restore') {
    if (message.type === 'compile' && message.revision !== latestCompile) return
    try {
      const next = await createShader(message.source, message.revision)
      if (message.type === 'restore') {
        active = next
        reply({ ...stamp, type: 'activated' })
      } else if (message.revision === latestCompile) {
        // The page accepts only a result matching its newest edit before activation.
        candidate = next
        reply({ ...stamp, type: 'compiled' })
      }
    } catch (error) {
      reply({ ...stamp, type: 'compile-error', message: messageOf(error) })
    }
    return
  }

  if (message.type === 'activate') {
    if (candidate?.revision === message.revision) {
      active = candidate
      candidate = undefined
      reply({ ...stamp, type: 'activated' })
    }
    return
  }

  if (message.type !== 'render') return
  const shader = active
  const { width, height, frameId, time } = message
  const cancelled = () => reply({ ...stamp, type: 'frame-cancelled', frameId })
  if (!shader || shader.revision !== message.revision) {
    cancelled()
    return
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 640 || height > 360 || !Number.isFinite(time)) {
    reply({ ...stamp, type: 'runtime-error', message: 'Invalid canvas dimensions or time.' })
    return
  }
  const token = cancellation
  let renderMs = 0
  try {
    for (let row = 0; row < height; row += 8) {
      if (token !== cancellation) { cancelled(); return }
      const start = performance.now()
      shader.render(width, height, time, row, Math.min(row + 8, height))
      renderMs += performance.now() - start
      await yieldTask()
    }
    if (token !== cancellation) { cancelled(); return }
    const byteLength = width * height * 4
    const pixels = message.pixels?.byteLength === byteLength ? message.pixels : new ArrayBuffer(byteLength)
    new Uint8Array(pixels).set(new Uint8Array(shader.memory.buffer, 0, byteLength))
    reply({ ...stamp, type: 'frame', frameId, width, height, time, renderMs, pixels }, [pixels])
  } catch (error) {
    reply({ ...stamp, type: 'runtime-error', message: messageOf(error) })
  }
}

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  if (!message || message.buildId !== buildId) {
    reply({ buildId, revision: message?.revision ?? 0, type: 'runtime-error', message: 'Page and worker versions differ. Reload this page.' })
    return
  }
  if (message.type === 'compile') {
    latestCompile = message.revision
    cancellation++
  }
  queue = queue.then(() => handle(message)).catch((error) => {
    reply({ buildId, revision: message.revision, type: 'runtime-error', message: messageOf(error) })
  })
}

reply({ buildId, revision: 0, type: 'ready' })
