# Resurrect NIH 2026: local Codex handoff

## Goal and current decision

Continue [issue #1](https://github.com/timosaarinen/nih-lang/issues/1): make WIDE a delightful, reliable live NIH coding page. This first implementation is **standalone**. The planned minified fgpu npm distribution is not ready; NIH must build without private fgpu, ValoX, Maa, fshadertoy, source copies, assets, credentials, or Git submodules.

Development uses pinned Bun + Vite. The public language remains embedded-only, with host-provided time/input and no ambient OS/browser capabilities. Native embedding and packaged fgpu integration follow the working web product.

The work branch is `feat/resurrect-nih-2026-standalone`, based on upstream `6cf5af5bf0135db77b9b6db6d3a156f0407d7f90`. Historical branches and legacy CLI/WGSL code are preserved.

## What is implemented

| Area | Implementation |
| --- | --- |
| Browser workspace | Pinned Bun 1.4.5, Vite 8.3.8, Monaco 0.57.0, real Bun lockfile |
| Live editor | NIH highlighting, line diagnostics, Run/Ctrl+Enter, debounced Live mode, saved draft/settings |
| Visual experience | Split/adjustable editor and Canvas2D preview, responsive layout, immersive translucent mode |
| Examples | Chromatic tunnel, electric plasma, first-light gradient |
| Runtime | Independent NIH worker, eight-row WASM jobs, one frame in flight, reusable transferred RGBA buffer |
| Revision handling | Page/worker build IDs, source revisions, candidate activation, obsolete-frame rejection |
| Lifecycle | Pause terminates the worker; Resume restores last-good source then attempts current draft; reset/resolution/disposal guards |
| Compiler | Existing public NIH lexer/parser/AST, new checked direct WASM backend, no imported functions |
| Freshness | Dev no-store headers, forced optimizer startup, source fingerprint/session ID, full reload on source/worker/compiler changes |
| Static output | Minified JS/CSS, hashed worker/assets, no sourcemaps, production base /opengpu/nih/, build.json identity |

The first delivery is a usable vertical slice, not a declaration that all of issue #1 is complete.

## Start locally

Use SSH for GitHub operations. Preserve local changes; use another checkout/worktree if necessary.

```sh
git clone git@github.com:timosaarinen/nih-lang.git
cd nih-lang
git fetch origin
git switch --track origin/feat/resurrect-nih-2026-standalone

bun --version
bun install --frozen-lockfile
bun run check
bun run check:web
bun run build
bun run dev
```

The expected Bun version is 1.4.5. Open **http://127.0.0.1:5173/**. The dev port uses strictPort. For the built release:

```sh
bun run preview
```

Open **http://127.0.0.1:4173/opengpu/nih/**. `NIH_BASE=/` can select root hosting; use it consistently for build and preview. A build creates `dist-web/`; it does not publish to opengpu.

## Compiler boundary

`compileShader(source)` returns WASM bytes. Its module exports fixed 16 MiB memory, each ordinary source helper with flattened vector arguments/results, and:

```text
pixel(u: f32, v: f32, time: f32) -> four f32 color values
render(width: i32, height: i32, time: f32, startY: i32, endY: i32)
```

NIH source declares `fn pixel(uv: vec2, t: f32) -> vec4`. UVs are normalized pixel centres, top-left origin/Y downward. `render` writes only rows [startY,endY), with dimension/range validation before any writes.

Supported now: plain fn helpers, f32/bool/vec2/vec3/vec4, immutable bindings, explicit/tail returns, arithmetic/comparisons/Boolean expressions, constructors/swizzles, and sin/cos/abs/sqrt/floor/fract/min/max/clamp/saturate/lerp/dot/length/normalize.

Explicitly rejected: mutable bindings, branches, loops, recursion, comptime, strings, I/O, integer-typed declarations, and cpu/gpu declarations. Do not silently interpret or eval unsupported source.

Ordinary source arithmetic is f32. Trig uses internal f64 range reduction and an f32 polynomial; tests cover graphics inputs through ±1000 at error below 2e-6. This does not promise correctly rounded libm or precise extreme-input phase. Color packing clamps infinities and maps NaN to zero.

The new backend checks its supported subset because the historical checker has audited holes. It shares the existing parser/AST; it does not introduce another syntax. Consolidate semantic checking when useful, without rebuilding a generalized compiler architecture ahead of the page. The historical JS interpreter is not yet a numerical oracle for this f32 backend.

## Verification completed in the remote workspace

- Real `bun install --frozen-lockfile`: succeeded without changes.
- Real TypeScript checks and production build: passed.
- All **18** compiler tests passed: 11 existing plus 7 new generated-WASM execution tests.
- WASM tests exercise zero imports, helper/pixel agreement, f32 rounding, trig accuracy, vector semantics, output packing, memory/row boundaries, rejection, recursion/depth/work bounds.
- Actual HTTP responses for HTML, manifest, app source, shader worker, compiler and optimized Monaco dependency: no-store, including conditional responses.
- Matching build identity in HTML, main module and worker; changes update the identity.
- Headless Chromium 153 ran the actual Vite page: all three examples render, edited source changes pixels, a wrong return type retains the prior good canvas, Pause/Resume and 640x360 work, normal reload preserves the draft, and mobile layout has no horizontal overflow.
- Desktop/mobile screenshots were inspected. The interaction run reported no browser errors.
- Same-profile, caching-enabled A-to-B tests passed for actual HTML, compiler behavior, and worker behavior through automatic and ordinary reload; original source was restored exactly after each test. All build identities agreed and the saved NIH draft survived.
- Restarting Vite established a new session/build identity and passed ordinary reload in the same browser context.
- Production preview at /opengpu/nih/ loaded hashed UI/worker assets, rendered the example, accepted real mouse/keyboard editing into a red shader, and preserved that source/output on ordinary reload. No source-map requests or browser errors were observed.

The environment's installed Chromium was blocked by Unix-socket restrictions; a standalone headless-shell browser worked. Tests used real HTTP and browser workers, not mocked WASM or screenshots of a static design. This does not replace local Safari/Firefox checks or hands-on editing.

These checks cover the local dev server and local production preview. Actual GitHub Pages cache behavior and other browser engines still need their own acceptance evidence.

## Next steps, in order

### 1. Reproduce locally and finish browser acceptance

Run the commands above, then use the page with browser caching enabled. Keep the same browser profile for freshness tests; do not use hard reload or DevTools Disable cache as the fix.

- [ ] Check Chrome/Chromium and Safari on the target Mac; Firefox is useful for another engine.
- [ ] Edit app UI, compiler behavior, and worker code. Each successful rebuild and ordinary reload must use the changed code and matching build identities.
- [ ] Restart Vite and switch branches/source revisions. A normal reload must establish one coherent page/compiler/worker generation.
- [ ] Rapidly submit valid/invalid/valid edits. Only the newest accepted compilation activates; stale diagnostics/results cannot overwrite it.
- [ ] Exercise Pause during compilation/rendering, Resume with an invalid draft, repeated resize/time reset, example switching/recover draft, and back/forward navigation.
- [ ] Check keyboard controls, editor/preview divider, immersive contrast, mobile stacking, and sustained editing without growing workers or buffers.
- [ ] Test a deliberately stale NIH-scoped service worker/cache. No service worker is registered by this app; if recovery code is needed, identify only the known NIH scope/namespace. Preserve drafts and unrelated storage. Use a dedicated dev origin when another app owns the controller.

Turn the useful freshness/lifecycle cases into a small automated browser regression test. Avoid creating a large test framework or mirroring implementation details.

### 2. Finish the small product gaps

- Add host-side import/export of plain .nih source; keep capability access out of NIH scripts.
- Make compilation time observable alongside render time when useful; distinguish compile CPU time from worker queue/round-trip delay.
- Make any required source-location, focus, draft-recovery or rendering-lifecycle corrections found in hands-on use.
- Measure the actual examples at stated resolutions on the target machine. Keep the UI responsive; optimize measured costs.
- Add language features only when an example needs them. Control flow needs correct type/return behavior; loops need real execution bounds. SIMD/native/GPU backends are later work.

### 3. Prepare a public release

The static build works independently of a Bun server. `build.json` identifies a build; it is **not yet a production update bootstrap**. Dev server headers do not configure GitHub Pages.

Before publishing:

- Verify cached old HTML can discover/load a coherent new release on the actual host.
- Add any minimal manifest/bootstrap handling required by that observed hosting behavior.
- Include NIH/dependency revision provenance and required third-party licenses.
- Validate worker paths, Monaco assets and lazy imports beneath /opengpu/nih/.
- Keep old hashed assets as needed for existing tabs; avoid mixing generations.
- Keep production sourcemaps/private/debug data out of the release.
- Copy only the tested release into the proposed opengpu/docs/nih destination as a separate release action.

### 4. Integrate fgpu when its package is ready

Use the documented public npm package and lockfile integrity. Keep the default build independent of private repository access. First evaluate a small presentation/effect adapter; do not vendor Maa or expand this page into a renderer framework. Temporal reconstruction needs valid motion/depth/history guides and is not the initial color-only shader path.

## Reporting and acceptance

Update issue #1 with the exact commit, commands, browser/OS, what passed, visible defects, and remaining gates. Preserve this distinction: compiler tests, HTTP freshness, browser interaction, production-host caching, and visual quality are separate evidence.

The first product gate is: **open the page, edit NIH, see generated WASM change the live visual, recover from errors, and reload normally without an old build.** Keep the work centered on that experience.
