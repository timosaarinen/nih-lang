# Plan: Compile NIH → Rust

## 1. Goals
- Provide a `--compile-rs` (`--target rust`) mode in `nih.py`.
- Emit idiomatic, safe Rust code retaining NIH semantics (dynamic types, builtins, control flow).
- Produce a standalone Rust project (Cargo.toml + src) or a single `*.rs` file.

## 2. CLI Interface Enhancements
1. **New Flag**: `argparser.add_argument("--compile-rs", action="store_true", help="Generate Rust code")`
2. **Output Path**: `--out <dir>` or `--out <file.rs>` to specify target.
3. **Mutual Exclusion**: CLI should error if both compile and `--ast`/`--sexpr`/`--repl`/file-exec are requested.
4. **Default**: compile-to-Rust mode writes to `<file>.rs` or `stdout`.

## 3. Codegen Module (`rust_codegen.py`)
- Create `v2proto/rust_codegen.py` with:
  ```python
  def emit_rust(program_ast, out_path=None, target="bin") -> None:
      # 1. Generate Cargo.toml if directory mode
      # 2. Render `src/main.rs` or single file
      # 3. Write file(s)
  ```
- Integrate into `nih.py` after parsing: `if args.compile_rs: rust_codegen.emit_rust(project.to_dict(), args.out)`

## 4. AST → Rust Translation
- **Module Structure**:
  - **Binary**: wrap code in `fn main()`; statements become code in `main()`.
  - **Library**: emit `pub fn run(env: &mut Env)`, expose as lib.

- **Runtime Types**:
  ```rust
  #[derive(Clone)]
  pub enum Value {
      Int(i64),
      Float(f64),
      Str(String),
      Func(FuncPtr),
      Null,
  }
  type Env = HashMap<String, Value>;
  ```
  - `FuncPtr` = enum variant holding either user-defined AST or a direct Rust function pointer for builtins.

- **Functions**:
  ```rust
  fn mandelbrot(cx: Value, cy: Value, env: &mut Env) -> Result<Value> {
      // declare locals: maxiters, zx, zy, n
      let maxiters = Value::Int(80);
      let mut zx = Value::Float(0.0);
      ...
      // while, if, arithmetic with match arms
      Ok(Value::Int(n_int))
  }
  ```
  - **Locals**: declare each at top, using `let mut`.
  - **Return**: `return Ok(value);`
  - **Error Propagation**: use `anyhow::Result<Value>`.

- **Assignments & Expressions**:
  - Map assignments to `env.insert("name".to_string(), expr_val);` for globals, or to `let mut name = expr_val;` for locals.
  - Arithmetic: helper functions or `impl Add for Value` to unify types.
  - Identifier lookup: `env.get("name").cloned().unwrap_or(Err(...))`.
  - Literals: `Value::Int(42)` or `Value::Float(3.14)` or `Value::Str("...".to_string())`.

- **Control Flow**:
  - **While**: `while eval_test()? { ... }
  - **If**: `if eval_test()? { ... }
  - **For**: `for i in start_int..=end_int { env.insert(var,...); body... }

- **Function Calls**:
  - De-sugar `call(expr, args...)` into:
    ```rust
    match callee {
        Value::Func(fp) => fp.invoke(args, env)?,
        _ => return Err(...),
    }
    ```
  - Builtins wired to Rust closures or native functions (`console.log` → `println!`, `sqrt` → `f64::sqrt`).

## 5. Language Changes & Type Requirements
1. **Dynamic Value Type**: introduce `Value` enum in runtime; NIH remains dynamically typed.
2. **Type Conversions**: require runtime checks for `Int` vs `Float` before op; decide on promotion rules.
3. **Error Handling**: Rust functions must return `Result<Value>`; propagate with `?`.
4. **String Escaping**: generate valid Rust string literals, handling quotes and escapes.
5. **Optional Static Inference**: (advanced) implement type inference pass to collapse `Value` to primitive Rust types when safe.
6. **Mutability**: track `mut` for locals, use `HashMap` for globals.

## 6. Runtime Library (`nih_runtime.rs`)
- **Helpers**:
  - `fn eval_expr(expr: &Expr, env: &mut Env) -> Result<Value>`
  - `fn eval_stmt(stmt: &Stmt, env: &mut Env) -> Result<Option<Value>>`
  - `fn apply_binary(op: &str, a: Value, b: Value) -> Result<Value>`
- **Builtins Registration**: register at top of `main()`:
  ```rust
  let mut env = Env::new();
  env.insert("print".into(), Value::Func(builtin_print));
  env.insert("sqrt".into(), Value::Func(builtin_sqrt));
  ```

## 7. Project & Packaging
- Scaffold a Cargo project under `out_dir/`:
  - `Cargo.toml` with `anyhow`, `log`, `thiserror`.
  - `src/main.rs`, `src/lib.rs` if needed.
- **Build Script**: Optionally generate a `build.rs` to include embedded NIH source in binary.
- **Examples**: include `examples/` folder with compiled outputs.

## 8. Testing & Validation
- **Roundtrip Tests**: interpret `.nih`, compile-to-Rust, compile & run, compare outputs.
- **Unit Tests**: for `rust_codegen.emit_rust()` functions.
- **CI Integration**: run `cargo test` on generated projects via ephemeral directories.

## 9. Timeline & Effort Estimate
- **Runtime & Codegen Prototype**: 2–3 days.
- **Type/Value System & Builtins**: 2 days.
- **Packaging & CI**: 1 day.
- **Static Inference (optional)**: 2–3 days more.
- **Total**: ~1–2 weeks for dynamic-typed support; add another week for static inference.
