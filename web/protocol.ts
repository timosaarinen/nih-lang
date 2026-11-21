export interface Stamp {
  buildId: string
  revision: number
}

export type WorkerRequest = Stamp & (
  | { type: 'compile'; source: string }
  | { type: 'restore'; source: string }
  | { type: 'activate' }
  | { type: 'render'; frameId: number; width: number; height: number; time: number; pixels?: ArrayBuffer }
)

export type WorkerReply = Stamp & (
  | { type: 'ready' }
  | { type: 'compiled' }
  | { type: 'activated' }
  | { type: 'compile-error'; message: string }
  | { type: 'runtime-error'; message: string }
  | { type: 'frame-cancelled'; frameId: number }
  | { type: 'frame'; frameId: number; width: number; height: number; time: number; renderMs: number; pixels: ArrayBuffer }
)
