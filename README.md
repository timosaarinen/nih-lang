[![NIH Web IDE Prototyping](https://img.youtube.com/vi/uA5v16mtczs/0.jpg)](https://youtu.be/uA5v16mtczs)

# NIH: a KISS programming language
- A next-generation pragmatic programming language inspired by the subjective best of all the programming languages since Plankalkül
- Made for daily work where you should have *fun* (most of time, at least..)
- KISS as the main development rule - and compared to DRY/YAGNI & co, the only non-subjective and non-context-dependant one

## Web IDE (WIDE) vision
- NIH Web IDE as the daily development platform, in addition to traditional ```$ nih main.nih``` way
- 2D/3D rendering allows inline math equations, graphs, images, videos and other non-text elements into code view
- While controversial, also allow audio in the inline code documentation
- 3D scenes and image shaders can run behind a transparent code view - or in own viewport, monitor or even in a VR/AR view
- Programmatical interactive elements in inline code documentation (literal programming as one inspiration)
- Avoiding the biggest mistake in GUIs that concerns coders: GUIs are great for discoverability and visualization, but mouse input is *slow* versus keyboard for those that hit the keyboard every day with all the 10 fingers -> in WIDE, almost everything will be controllable with a keyboard and text input, in addition to keeping the GUI option for discoverability
- Dark theme only.

# General purpose CPU-targeted code and GPU-target shader/compute unification
- NIH aims for sharing library code between GLSL-like shader/compute kernel code and general CPU-targeted code
- GPU shaders run in more limited but massively parallel scope
- Swizzling natively in syntax: v2.xyzw = v1.wzyx
- ..and other GLSL-like syntax features
- Also includes lerp(), saturate() and f16 (half)
- Integrated shader debugging capabilities with CPU-emulated shaders in NIH Web IDE

## General features
- "Batteries included" vision - package manager and build/test/lint/autoformat/CI/CD integrated into the language itself, controlled by config.nih in the project root
- The source is still text, no obscure undiffable binary formats
- Source code can be in two syntaxes: Nih-Sexpr, which is the main persistance format for WIDE, and Nih-C, which is for *most part* faster to write and read
- Automatic code formatting naturally with S-expressions, WIDE doesn't store tabs and unnecessary spaces unless in literal strings - same with ```$ nih --output-sexpr source.nih``` 
- "Ends the Tabs vs Spaces religious war once and for all".. goal
- Whole program optimization
- Benevolent dictatorship in language design, as determined by the author. Sorry, committees not allowed. Ever. Maybe. Strong Maybe.
- Open-source, MIT license - "Monetizing a programming language directly is a folly".

# Syntax features
- The Lisp-family & C-family syntax can be mixed in the same source code module with a lang #pragma
- 'import' keyword in modules is not required, project-level config.nih configured packages for lookup of module scoped variables/functions
- 'alias' allows to shorten any type or module.scoped.variable/function name per programmer discretion
- While there is no 'class' in Nih, can use '.' operator to pass lhs to a function like in most mainstream languages - *syntactic sugar*
- Piping operator '|>' which also allows assignment to a variable at the end

## Documentation vision
- Automatic documentation generation from code is supported by base NIH compiler as a user-extendable library
- Same syntax as inline math equations, links, images, 3D object refs, ...  - WYSIWYG
- Code completion for all imported NIH libraries, but also for external JS/C APIs if type declarations are provided for them

## Type declarations for external not-NIH APIs 
- Auto-generation of type declarations from C and TS libraries (C++.. maybe, this is heavily opionated language after all)
- AI-assisted auto-generation of type declarations from JS libraries by running JS interpreter - and also inputting JS library documentation, if available
- for JS compilation target, allows 'any' for total dynamic.. freedom - *gradual typing*

# Syntax

While syntax in a PLD sense is not the most important concern, the syntax does relate to the daily life of a programmer - NIH aims to keep the syntax as simple as possible, but not simpler.

The same program in Nih-C and S-expression syntax:

```
// Mandelbrot set with console output
WIDTH = 16
HEIGHT = 16

:float mandelbrot(:float cx, :float cy)
  // @returns # of iterations (0 if not in Mandelbrot set)
  maxiters = 80
  zx := 0
  zy := 0
  n := 0
  do
    px = zx^2 - zy^2
    py = 2 * zx * zy
    zx := px + cx
    zy := py + cy
    d = sqrt(zx^2 + zy^2)
    n++
    if d > 2 return 0 // if not in Mandelbrot set, early return
  while n < maxiters
  return n

//------------------------------------------------------------------------
rs = -2.0
re = 1.0
is = -1.0
ie = 1.0

for i = 0..WIDTH
  for j = 0..HEIGHT
    cx = rs + :float i / WIDTH * (re - rs)
    cy = is + :float j / HEIGHT * (ie - is)
    m = mandelbrot(cx, cy)
    printchars(m > 0.0 ? '*' : ' ')
  printlf()
```

Unlike most of C-family syntaxes, newline acts as a terminator ';' and {} are replaced with meaningful-indentation. Nih compiler does not allow TABs in the source code, unless inside quotes.
Variables are const by default, mutable variables must be assigned with ':=' operator. Parenthesis are optional for function calls unless ambiguous. Range '..' operator excludes the end value.
Type inference allows most of code to be untyped, but for clarity and unambiguity explicit types (character ':' as the first letter) can be added before the corresponding identifier or expression, like above.
Casting can be achieved by prefixing with a type ("constructor syntax"), also like above in ```:float i``` case, for example.

### ..and same in sexpr:

```
#lang = nih-sexpr
(let WIDTH 16)
(let HEIGHT 16)

(:int fun mandelbrot (:float cx :float cy)
  (doc "@returns # of iterations (0 if not in Mandelbrot set)")
  (let maxiters 80)
  (set! zx 0)
  (set! zy 0)
  (set! n 0)
  (do-while (
    (let px (- (^ zx 2) (^ zy 2)))
    (let py (- (* 2 zx zy)))
    (set! zx (+ px cx))
    (set! zy (+ py cy))
    (let d (sqrt (+ (^ zx 2) (^ zy 2))))
    (inc! n)
    (if (> d 2) (return 0.0))
  ) (< n maxiters))
  (return n))

(let rs -2.0)
(let re 1.0)
(let is -1.0)
(let ie 1.0)

(for-lt i 0 WIDTH
  (for-lt j 0 HEIGHT
    (let cx (+ rs (* (/ i :float WIDTH) (- re rs))))
    (let cy (+ is (* (/ j :float HEIGHT) (- ie is))))
    (let m (call mandelbrot cx cy))
    (call printchars (? (> m 0.0) '*' ' '))
    (call printlf)))
```

## Inspirations (and selective not-inspirations)

### Inspired by:
- **Lua**: For its lightweight nature, overall simplicity and embeddability.
- **Lisp**: The power of macros and its approach to code as data. And S-expressions, of course - the direct Abstract Syntax Tree (AST) format.
- **C**: The foundation of system programming languages, valued for its efficiency, control and (subjective) simplicity.
- **C#**: Its balance of modern features and strong typing.
- **TypeScript**: Strong static typing for JavaScript, saves a lot of time and energy on large software projects.
- **Erlang (OTP)/Elixir**: For fault tolerance, the actor model, and a functional approach to concurrency.
- **F#**: Fun.
- **Nim**: Appreciated for its efficiency and expressive syntax.
- **Elm**: For its focus on usability and frontend development simplicity.
- **GLSL/HLSL**: The unique domain of shader programming languages offers insights into specialized computation.
- **BASICs**: Remembered for its simplicity and the joy of the immediate feedback loop in coding.

### Appreciated, but not followed:
- **C++**: Acknowledged for its influence and power, but seeking to avoid its complexity.
- **Java**: Recognized for its portability and JVM, aiming for a more succinct syntax.
- **JavaScript**: For its rapid development and deployment capabilities.
- **Haskell**: Its functional programming model is enlightening, yet looking to remain more accessible and practical without deep functional concepts.

### Concepts/paradigms/way-of-life:
- **KISS (Keep It Simple, Stupid)**: A principal guide in design for clarity and efficiency.
- **Live Coding and REPL**: Valuing the interactive development experience and immediate feedback.
- **Actor Model**: Adopting a model of concurrency that promotes isolation and message passing.
- **Literal Programming**: Exploring the narrative within code, where documentation and logic intertwine seamlessly.

### With a nod and a smile:
- **COBOL**: Though not directly inspiring, it’s a nod to the history and evolution of programming languages.
- **Not-Inspirations** in jest (C++, Java, JavaScript, Haskell): While teasingly mentioned, it's with respect for their contributions to the programming world. Each language has its place and purpose, and understanding their challenges and complexities can also inspire innovation and clarity in new language design.

# Nih-C examples

### Print/logging

Lua-style simplicity, one-liner scripts work (automatically main module). No parens needed for parameters.
~~~
print 'Hiihoo'
~~~
~~~
print 'The answer to life, universe is... ' (6 * 7)
~~~
You can use parens, but not the default. Necessary when ambiguous otherwise. Single or double-quote, you decide. No backtick '`'.
~~~
print("The answer to life, universe = ", 6 * 7)
~~~

### String interpolation
~~~
print 'Hey $yourname, the answer to life, universe and everything is.. $(6 * 7).'
s = fmt 'Hey $yourname, the answer to life, universe and everything is.. $(6 * 7).'
~~~

### Multi-line strings (automatically from the block, leading/trailing spaces not stored, \n are)
~~~
nethack-putka:
  ######
  #.$..|
  ######
~~~

### Variables

Pure functions and immutable values should always be the first option over mutability. No need for 'const' keyword below, as both 'foo' and 'bar' are immutable values by default. NIH also uses type inference - which makes code shorter, easier to write and more readable in trivial unambiguous cases. It is still a good idea to specify types in an API for clarity, for example, even if not strictly required.
~~~
foo = 100               // type inferred -> integer
bar = 123.0             // type inferred -> float (maintains original representation, if possible - if assigned to a 'f64' for example)
barf = 123.0f           // C-style explicit float syntax supported -> 'f32'
x = :float 123 / 2      // casting with constructor syntax
v = :vec3 1.5 0.5 42.7  // GLSL-style native 3D vectors
mypi = :f16 3.141592    // constructor syntax
:f16 mypi = 3.141592    // type-for-variable, the above does the same
~~~

Mutable variables with ':='
~~~
counter := 0
counter++
~~~

Dashes in identifiers. To make it unambiguous, only unary minus is allowed without whitespace around, otherwise 42 - 0 style.
~~~
the-answer = 42
~~~

Optional return. By default, returns the value of the last expression in a function. Return is useful for early exit.
~~~
fun the-answer-as-func() = return 42
~~~

### Function declarations
~~~
fun foo() = bar
:int answer() = 42      // can replace 'fun' keyword with the return type for C-family feels
fun :int answer() = 42  // not preferred way: ..and above is also the better way, not just the feels
fun double(x) = 2x      // math-style factors/multipliers without '*', not usable with multi-character variable names
double = (x) => 2x      // lambda (note: this is what above compiles to, see s-expr - up to programmer discretion which to use)

fun hmmm(x)
  y = sqrt(x)
  z = x * x
  return z / x 

:u64 double(:u64 x)
  return 2 * x

:f32 dot(:vec3 a, :vec3 b)  // as an example, dot() is actually a native function
  return a.x * b.x + a.y * b.y + a.z * b.z

fun fact(:uint n)
  if n == 0 return 1
  n * fact(n - 1)  // return can be omitted on the last expression

fact = (x) => (n == 0) ? 1 : n * fact(n - 1)
~~~

# Getting Started
TODO: still heavily work-in-progress, wander around the source if you are adventurous

# Development notes
- install ESLint extensions for Visual Studio Code

# Contributing
Thrilled that you're interested in contributing to NIH! This project thrives on community feedback and the diverse perspectives of programmers like you.
