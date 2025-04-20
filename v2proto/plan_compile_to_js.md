# Plan: Compile NIH → JavaScript

## 1. Goals
- Support both **Node.js** and **Browser** targets.
- Preserve NIH semantics (functions, loops, expressions, builtins).

## 2. CLI Interface
- Add a new flag: `--compile-js` or `--target js[=node|browser]` to `nih.py`.
- Optional `--out <file.js>` to write output; default to stdout.
- Fallback: existing modes (`--sexpr`, `--ast`, REPL, file execution).

## 3. Codegen Module (`js_codegen.py`)
- Export `emit_js(program_ast, target) -> string`.
- AST → JS mapping:
  - **Program**: wrap in IIFE or export for ESM/CommonJS.
  - **Function**: `function name(params){ … }`.
  - **Assignment**: `let name = expr;` (collect locals per scope).
  - **Expression**: bare expr + semicolon.
  - **Return**: `return expr;`.
  - **If/While/For**: map to JS `if`, `while`, `for(let var=start; var<=end; var++)`.
  - **Call**: map `print(...)` → `console.log(...)`, `sqrt` → `Math.sqrt`.
  - **Operators**: `+,-,*,/,>,<,...` map directly.

## 4. Variable Scoping & Declarations
- Pre-scan each function body to list all assigned identifiers as `let` declarations at top.
- Global assignments become top‐level `const/let`.

## 5. Builtins & Polyfills
- Map NIH builtins to JS globals:
  - `print` → `console.log`
  - `sqrt` → `Math.sqrt`
- Allow injection of small runtime helpers if needed.

## 6. Output Formats & Bundling
- **Node**: emit CommonJS (`module.exports`) or ESM (`export function ...`).
- **Browser**: wrap in IIFE, expose API on `window` or `window.nih`.
- Later: integrate Rollup/Webpack for bundling if project grows.

## 7. Testing & Validation
- Create `.nih` → `.js` conversion test suite.
- Run Node on output and compare text output to interpreter behavior.
- Automate in CI.

## 8. Documentation & Examples
- Update README with compile instructions.
- Provide simple example pipeline:
  ```bash
  uv run nih.py --compile-js example.nih --out example.js
  node example.js
  ```

## 9. Timeline & Effort Estimation
- **Prototype**: 1–2 days to map core AST constructs.
- **Polish & Tests**: 2–3 days to handle edge cases and docs.
- **Total**: ~1 work week for a minimal Node/browser emitter.
