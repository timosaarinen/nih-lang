# Plan: Immutable Variables in JS Codegen

## 1. Goal
- Use `const` for variables that are assigned exactly once (immutable), fall back to `let` for mutable bindings.

## 2. Pre‑scan & Analysis
1. **Count assignments per identifier** in each function/global scope:
   - Traverse AST to tally how many times each name appears on the left of an assignment (including `for` loop vars).
   - Parameters and builtins are not counted.

2. **Determine immutability**:
   - An identifier with exactly one assignment and never reassigned is *immutable*.
   - Loop counters and variables updated in loops are *mutable*.

## 3. Codegen Changes
- In `emit_function`:
  1. Compute a map `assignment_counts` from pre‑scan.
  2. Derive two sets:
     - `immutable_locals` = locals_to_declare ∩ {name | count == 1}
     - `mutable_locals` = locals_to_declare ∖ `immutable_locals`
  3. Emit declarations:
     - For each in `immutable_locals`, inline its initial value with `const name = value;` and remove its separate assignment.
     - For `mutable_locals`, emit `let name;` at top and emit assignments later.
- In global emit:
  - Apply same logic to top‑level assignments.

## 4. CLI & Flags
- Optionally add `--use-const` or always apply immutable analysis.

## 5. Testing & Validation
- Add tests comparing generated JS AST:
  - Ensure `const` appears for single‑assignment vars.
- Run Node to confirm behavior.

## 6. Timeline
- **1 day**: implement pre‑scan and classification.
- **1 day**: update codegen and tests.
