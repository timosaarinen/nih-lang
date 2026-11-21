import * as monaco from 'monaco-editor/editor/editor.api.js'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import { examples } from './examples'
import type { WorkerReply, WorkerRequest } from './protocol'
import './style.css'

const buildId = __NIH_BUILD_ID__
const draftKey = 'nih-wide-draft-v1'
const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing interface element: ${selector}`)
  return element
}
const canvas = $<HTMLCanvasElement>('#canvas')
const context = canvas.getContext('2d', { alpha: false })
if (!context) throw new Error('This browser does not provide a 2D canvas.')
const exampleSelect = $<HTMLSelectElement>('#example')
const resolutionSelect = $<HTMLSelectElement>('#resolution')
const autorunInput = $<HTMLInputElement>('#autorun')
const runButton = $<HTMLButtonElement>('#run')
const pauseButton = $<HTMLButtonElement>('#pause')
const buildLabel = $('#build-label')
const helpPanel = $('#help-panel')
const diagnostics = $('#diagnostic')
const recoverButton = $<HTMLButtonElement>('#recover-draft')

interface Draft { source: string; exampleId: string; live: boolean; resolution: number; backup?: { source: string; exampleId: string } | undefined }
let saved: Partial<Draft> = {}
try {
  const value: unknown = JSON.parse(localStorage.getItem(draftKey) ?? 'null')
  if (value && typeof value === 'object') saved = value as Partial<Draft>
} catch { /* Editing remains available when local storage is disabled. */ }
let selectedExample = examples.find((example) => example.id === saved.exampleId) ?? examples[0]!
const initialSource = typeof saved.source === 'string' && saved.source.length <= 262144 ? saved.source : selectedExample.source
let backup = saved.backup && typeof saved.backup.source === 'string' && typeof saved.backup.exampleId === 'string' ? saved.backup : undefined
let storageAvailable = true
let sourceRevision = 1
let lastGood: { source: string; revision: number } | undefined
let worker: Worker | undefined
let activeRevision: number | undefined
let pendingRevision: number | undefined
let activatingRevision: number | undefined
let submittedSource = ''
let inFlight: number | undefined
let reusablePixels: ArrayBuffer | undefined
let nextFrameId = 1
let earliestFrame = 0
let lastDisplayedRevision: number | undefined
let compileTimer: ReturnType<typeof setTimeout> | undefined
let watchdog: ReturnType<typeof setTimeout> | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined
let frameWatchdog: ReturnType<typeof setTimeout> | undefined
let running = true
let elapsedBase = 0
let clockStarted = performance.now()
let lastPresentedAt = 0
let presentedFps = 0
let lastMetricsAt = 0
let hasFrame = false
let suppressEdit = false
let currentError: { revision: number; message: string; fatal?: boolean } | undefined
let disposed = false

for (const example of examples) exampleSelect.add(new Option(example.name, example.id))
exampleSelect.value = selectedExample.id
autorunInput.checked = saved.live !== false
if ([160, 320, 640].includes(Number(saved.resolution))) resolutionSelect.value = String(saved.resolution)
recoverButton.hidden = !backup
buildLabel.textContent = `NIH WIDE · ${buildId.slice(0, 18)}`
buildLabel.title = `Build ${buildId}`
const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
$('#run-shortcut').textContent = isMac ? '⌘ ↵' : 'Ctrl ↵'

;(globalThis as typeof globalThis & { MonacoEnvironment?: unknown }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}
monaco.languages.register({ id: 'nih', extensions: ['.nih'] })
monaco.languages.setLanguageConfiguration('nih', {
  comments: { lineComment: '//', blockComment: ['/*', '*/'] },
  brackets: [['{', '}'], ['[', ']'], ['(', ')']],
  autoClosingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }],
})
monaco.languages.setMonarchTokensProvider('nih', {
  keywords: ['fn', 'cpu', 'gpu', 'return', 'if', 'else', 'comptime', 'true', 'false'],
  types: ['f32', 'i32', 'u32', 'bool', 'vec2', 'vec3', 'vec4', 'void'],
  tokenizer: {
    root: [
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
      [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@types': 'type', '@default': 'identifier' } }],
      [/\d*\.\d+(?:[eE][+-]?\d+)?|\d+(?:[eE][+-]?\d+)?/, 'number'],
      [/"(?:[^"\\]|\\.)*"/, 'string'],
      [/[{}()[\]]/, '@brackets'],
      [/[=+\-*/<>!:]+/, 'operator'],
      [/[;,.]/, 'delimiter'],
    ],
    comment: [[/[^/*]+/, 'comment'], [/\*\//, 'comment', '@pop'], [/[/*]/, 'comment']],
  },
})
monaco.editor.defineTheme('nih-night', {
  base: 'vs-dark', inherit: true,
  rules: [
    { token: 'comment', foreground: '687674' },
    { token: 'keyword', foreground: 'B9EF83' },
    { token: 'type', foreground: '82CCC8' },
    { token: 'number', foreground: 'E8B785' },
    { token: 'identifier', foreground: 'D8DEDA' },
    { token: 'operator', foreground: '9FA8A5' },
  ],
  colors: {
    'editor.background': '#141719', 'editor.foreground': '#D8DEDA',
    'editorLineNumber.foreground': '#4C5755', 'editorLineNumber.activeForeground': '#B9EF83',
    'editor.lineHighlightBackground': '#1B2021', 'editor.selectionBackground': '#36534788',
    'editorCursor.foreground': '#B9EF83', 'editorIndentGuide.background1': '#252D2C',
    'editorGutter.background': '#141719', 'editorOverviewRuler.border': '#00000000',
    'scrollbarSlider.background': '#65716E44', 'scrollbarSlider.hoverBackground': '#65716E88',
  },
})
const model = monaco.editor.createModel(initialSource, 'nih', monaco.Uri.parse('inmemory://nih/canvas.nih'))
const editor = monaco.editor.create($('#editor'), {
  model, theme: 'nih-night', automaticLayout: true,
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  fontSize: 13, lineHeight: 22, fontLigatures: false,
  minimap: { enabled: false }, scrollBeyondLastLine: false,
  lineNumbersMinChars: 3, folding: true, renderLineHighlight: 'line',
  padding: { top: 18, bottom: 22 }, tabSize: 2, insertSpaces: true,
  wordWrap: 'on', wrappingIndent: 'indent', overviewRulerLanes: 0,
  roundedSelection: false, cursorBlinking: 'smooth',
  unicodeHighlight: { ambiguousCharacters: false },
})

function elapsed(): number {
  return elapsedBase + (running ? (performance.now() - clockStarted) / 1000 : 0)
}
function clearWatchdogs() {
  clearTimeout(watchdog); clearTimeout(frameWatchdog)
  watchdog = undefined; frameWatchdog = undefined
}
function stopWorker() {
  worker?.terminate()
  worker = undefined
  activeRevision = undefined
  pendingRevision = undefined
  activatingRevision = undefined
  inFlight = undefined
  clearWatchdogs()
  lastPresentedAt = 0
  presentedFps = 0
}
type WithoutBuild<T> = T extends unknown ? Omit<T, 'buildId'> : never
function send(message: WithoutBuild<WorkerRequest>, transfer: Transferable[] = []) {
  worker?.postMessage({ ...message, buildId }, transfer)
}
function pause() {
  if (running) elapsedBase = elapsed()
  running = false
  clearTimeout(compileTimer)
  stopWorker()
  renderStatus()
}
function fatal(message: string) {
  pause()
  currentError = { revision: sourceRevision, message, fatal: true }
  renderStatus()
}
function markError(message: string) {
  const location = /(?:line\s+|\bat\s+)(\d+)(?::(\d+))?|^(\d+):(\d+)/i.exec(message)
  const line = Math.min(model.getLineCount(), Math.max(1, Number(location?.[1] ?? location?.[3] ?? 1)))
  const column = Math.min(model.getLineMaxColumn(line), Math.max(1, Number(location?.[2] ?? location?.[4] ?? 1)))
  monaco.editor.setModelMarkers(model, 'nih', [{ severity: monaco.MarkerSeverity.Error, message, startLineNumber: line, startColumn: column, endLineNumber: line, endColumn: model.getLineMaxColumn(line) }])
}
function armCompileWatchdog() {
  clearTimeout(watchdog)
  watchdog = setTimeout(() => fatal('Compilation took too long. The worker was stopped and your last canvas was kept. Edit the source and press Run to retry.'), 12000)
}
function ensureWorker() {
  if (worker) return
  const next = new Worker(new URL('./render-worker.ts', import.meta.url), { type: 'module' })
  worker = next
  next.onmessage = (event: MessageEvent<WorkerReply>) => {
    if (worker !== next || disposed) return
    const message = event.data
    if (!message || message.buildId !== buildId) {
      fatal('The page and compiler have different versions. Reload this page; your draft is saved locally.')
      return
    }
    if (message.type === 'ready') return
    if (message.type === 'compiled') {
      if (pendingRevision !== message.revision) return
      pendingRevision = undefined
      clearTimeout(watchdog)
      if (sourceRevision === message.revision && running) {
        lastGood = { source: submittedSource, revision: message.revision }
        activatingRevision = message.revision
        currentError = undefined
        monaco.editor.setModelMarkers(model, 'nih', [])
        send({ type: 'activate', revision: message.revision })
      }
      renderStatus()
      return
    }
    if (message.type === 'activated') {
      if (lastGood?.revision === message.revision) {
        activeRevision = message.revision
        activatingRevision = undefined
      }
      renderStatus()
      return
    }
    if (message.type === 'compile-error') {
      if (pendingRevision === message.revision) {
        pendingRevision = undefined
        clearTimeout(watchdog)
        if (message.revision === sourceRevision) {
          currentError = { revision: message.revision, message: message.message }
          markError(message.message)
        }
      } else if (lastGood?.revision === message.revision && activeRevision === undefined) {
        fatal(`The previous shader could not be restored: ${message.message}`)
      }
      renderStatus()
      return
    }
    if (message.type === 'runtime-error') { fatal(message.message); return }
    if (message.frameId !== inFlight) return
    inFlight = undefined
    clearTimeout(frameWatchdog)
    if (message.type === 'frame-cancelled') return
    const width = Number(resolutionSelect.value)
    reusablePixels = message.pixels.byteLength === width * (width * 9 / 16) * 4 ? message.pixels : undefined
    if (!running || message.revision !== lastGood?.revision || message.width !== width || message.height !== width * 9 / 16 || message.frameId < earliestFrame) return
    if (canvas.width !== message.width || canvas.height !== message.height) { canvas.width = message.width; canvas.height = message.height }
    context!.putImageData(new ImageData(new Uint8ClampedArray(message.pixels), message.width, message.height), 0, 0)
    lastDisplayedRevision = message.revision
    if (!hasFrame) { hasFrame = true; $('#canvas-empty').hidden = true }
    const now = performance.now()
    if (lastPresentedAt) {
      const sample = 1000 / Math.max(1, now - lastPresentedAt)
      presentedFps = presentedFps ? presentedFps * 0.85 + sample * 0.15 : sample
    }
    lastPresentedAt = now
    if (now - lastMetricsAt > 350) {
      $('#render-ms').textContent = message.renderMs.toFixed(1)
      $('#display-fps').textContent = presentedFps ? presentedFps.toFixed(1) : '—'
      lastMetricsAt = now
    }
    renderStatus()
  }
  next.onerror = (event) => {
    event.preventDefault()
    if (worker === next) fatal(event.message || 'The compiler worker stopped unexpectedly. Press Run to restart it.')
  }
  next.onmessageerror = () => { if (worker === next) fatal('The compiler worker returned an unreadable response. Press Run to restart it.') }
  if (lastGood) send({ type: 'restore', revision: lastGood.revision, source: lastGood.source })
}

function compileNow(resume = false) {
  clearTimeout(compileTimer)
  saveDraft()
  if (!running && !resume) { renderStatus(); return }
  if (!running) { running = true; clockStarted = performance.now() }
  ensureWorker()
  submittedSource = model.getValue()
  pendingRevision = sourceRevision
  send({ type: 'compile', revision: sourceRevision, source: submittedSource })
  armCompileWatchdog()
  renderStatus()
}

function saveDraft() {
  clearTimeout(saveTimer)
  try {
    localStorage.setItem(draftKey, JSON.stringify({ source: model.getValue(), exampleId: selectedExample.id, live: autorunInput.checked, resolution: Number(resolutionSelect.value), backup } satisfies Draft))
    storageAvailable = true
  } catch { storageAvailable = false }
  $('#draft-state').textContent = storageAvailable ? 'Saved locally' : 'Storage unavailable'
}

function renderStatus() {
  const error = currentError?.revision === sourceRevision ? currentError : undefined
  const dirty = !lastGood || sourceRevision !== lastGood.revision
  let kind = 'good', title = 'Live canvas', detail = 'NIH compiled to scalar WebAssembly. One CPU worker.'
  if (!running) {
    kind = 'paused'; title = 'Paused'; detail = dirty ? 'Your edits are saved. Resume compiles the current source.' : 'The worker is stopped. Your last frame is preserved.'
  } else if (pendingRevision !== undefined || activatingRevision !== undefined) {
    kind = 'busy'; title = 'Compiling your edit'; detail = hasFrame ? 'The last working frame stays visible.' : 'NIH → WebAssembly → your first pixels.'
  } else if (dirty) {
    kind = 'pending'; title = autorunInput.checked ? 'Waiting for your next edit' : 'Changes ready to run'; detail = hasFrame ? `Showing the last working source, r${lastDisplayedRevision ?? lastGood?.revision}.` : 'Press Run to compile this source.'
  }
  if (error) {
    kind = 'error'; title = error.fatal ? 'Worker stopped' : 'This edit did not compile'
    detail = hasFrame ? `${running ? 'The preview keeps' : 'Paused on'} the last working source, r${lastDisplayedRevision ?? lastGood?.revision}. Your edit is still in the editor.` : 'Your source is preserved. Fix the error and run it again.'
  }
  $('#status-card').dataset.kind = kind
  $('#status-title').textContent = title
  $('#status-detail').textContent = detail
  diagnostics.hidden = !error
  diagnostics.textContent = error?.message ?? ''
  $('#displayed-revision').textContent = lastDisplayedRevision ? `Canvas r${lastDisplayedRevision}` : ''
  $('#source-revision').textContent = `Source r${sourceRevision}`
  $('#playback-label').textContent = running && hasFrame ? 'LIVE' : running ? 'STARTING' : 'PAUSED'
  $('#live-dot').classList.toggle('stopped', !running)
  pauseButton.textContent = running ? 'Pause' : 'Resume'
  pauseButton.setAttribute('aria-label', running ? 'Pause rendering and stop the worker' : 'Resume rendering')
  runButton.classList.toggle('compiling', pendingRevision !== undefined)
  if (!hasFrame) {
    const empty = $('#canvas-empty')
    empty.textContent = error ? 'Your canvas is waiting' : !running ? 'Ready when you are' : 'Compiling your first canvas'
    const sub = document.createElement('span'); sub.textContent = error ? 'Correct the source to see it here.' : 'NIH → WebAssembly → pixels'; empty.append(sub)
  }
}

function updateExampleHeading() {
  $('#example-title').textContent = selectedExample.name
  $('#example-description').textContent = selectedExample.description
  exampleSelect.value = selectedExample.id
}

function replaceSource(source: string, exampleId: string, remember = true) {
  if (remember && model.getValue() !== source) backup = { source: model.getValue(), exampleId: selectedExample.id }
  selectedExample = examples.find((example) => example.id === exampleId) ?? examples[0]!
  suppressEdit = true; model.setValue(source); suppressEdit = false
  sourceRevision++
  currentError = undefined
  monaco.editor.setModelMarkers(model, 'nih', [])
  updateExampleHeading()
  recoverButton.hidden = !backup
  editor.setPosition({ lineNumber: 1, column: 1 })
  editor.revealLine(1)
  compileNow(running)
}

editor.onDidChangeModelContent(() => {
  if (suppressEdit) return
  sourceRevision++
  currentError = undefined
  monaco.editor.setModelMarkers(model, 'nih', [])
  $('#draft-state').textContent = 'Saving…'
  clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 250)
  clearTimeout(compileTimer)
  if (autorunInput.checked && running) compileTimer = setTimeout(() => compileNow(), 450)
  renderStatus()
})
editor.onDidChangeCursorPosition((event) => { $('#editor-position').textContent = `Ln ${event.position.lineNumber}, Col ${event.position.column}` })
editor.addAction({ id: 'nih.run', label: 'Compile and run NIH', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter], run: () => compileNow(true) })
runButton.onclick = () => compileNow(true)
pauseButton.onclick = () => { if (running) pause(); else compileNow(true) }
$('#reset-time').onclick = () => {
  elapsedBase = 0; clockStarted = performance.now(); earliestFrame = nextFrameId
  $('#time').textContent = '00:00.0'
}
autorunInput.onchange = () => {
  clearTimeout(compileTimer)
  saveDraft()
  if (autorunInput.checked && running && sourceRevision !== lastGood?.revision) compileNow()
  else renderStatus()
}
resolutionSelect.onchange = () => { earliestFrame = nextFrameId; lastPresentedAt = 0; saveDraft() }
exampleSelect.onchange = () => { const next = examples.find((example) => example.id === exampleSelect.value)!; replaceSource(next.source, next.id) }
$('#reset-source').onclick = () => replaceSource(selectedExample.source, selectedExample.id)
recoverButton.onclick = () => { if (backup) { const recovered = backup; replaceSource(recovered.source, recovered.exampleId) } }
$('#focus').onclick = () => {
  const enabled = document.body.classList.toggle('immersive')
  $('#focus').setAttribute('aria-pressed', String(enabled))
  editor.layout()
}
function showHelp(show: boolean) { helpPanel.hidden = !show; $('#help-toggle').setAttribute('aria-expanded', String(show)); if (show) $('#help-close').focus() }
$('#help-toggle').onclick = () => showHelp(helpPanel.hidden)
$('#help-close').onclick = () => { showHelp(false); $('#help-toggle').focus() }
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    showHelp(false)
    document.body.classList.remove('immersive')
    $('#focus').setAttribute('aria-pressed', 'false')
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !editor.hasTextFocus()) { event.preventDefault(); compileNow(true) }
})

const splitter = $('#splitter')
const workspace = $('.workspace')
function setSplit(percent: number) {
  const value = Math.max(30, Math.min(70, percent))
  workspace.style.setProperty('--editor-share', `${value}%`)
  splitter.setAttribute('aria-valuenow', String(Math.round(value)))
  editor.layout()
}
splitter.onpointerdown = (event) => { splitter.setPointerCapture(event.pointerId); document.body.classList.add('resizing') }
splitter.onpointermove = (event) => {
  if (!splitter.hasPointerCapture(event.pointerId)) return
  const bounds = workspace.getBoundingClientRect(); setSplit((event.clientX - bounds.left) / bounds.width * 100)
}
splitter.onpointerup = (event) => { splitter.releasePointerCapture(event.pointerId); document.body.classList.remove('resizing') }
splitter.onlostpointercapture = () => document.body.classList.remove('resizing')
splitter.onkeydown = (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setSplit(Number(splitter.getAttribute('aria-valuenow')) + (event.key === 'ArrowLeft' ? -2 : 2)) }
}

let animationId = 0
function tick() {
  if (disposed) return
  const seconds = elapsed()
  const minutes = Math.floor(seconds / 60)
  $('#time').textContent = `${String(minutes).padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`
  if (running && worker && activeRevision !== undefined && activeRevision === lastGood?.revision && pendingRevision === undefined && activatingRevision === undefined && inFlight === undefined) {
    const width = Number(resolutionSelect.value)
    const height = width * 9 / 16
    const pixels = reusablePixels?.byteLength === width * height * 4 ? reusablePixels : undefined
    reusablePixels = undefined
    inFlight = nextFrameId++
    send({ type: 'render', revision: activeRevision, frameId: inFlight, width, height, time: seconds, ...(pixels ? { pixels } : {}) }, pixels ? [pixels] : [])
    frameWatchdog = setTimeout(() => fatal('The shader took too long to render. The worker was stopped. Reduce its complexity and press Run.'), 12000)
  }
  animationId = requestAnimationFrame(tick)
}

function dispose() {
  if (disposed) return
  saveDraft()
  disposed = true
  stopWorker()
  cancelAnimationFrame(animationId)
  clearTimeout(compileTimer); clearTimeout(saveTimer)
  editor.dispose(); model.dispose()
}
window.addEventListener('pagehide', dispose)
window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload() })
if (import.meta.hot) import.meta.hot.dispose(dispose)
updateExampleHeading()
saveDraft()
compileNow()
tick()
