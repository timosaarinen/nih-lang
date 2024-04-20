[![NIH Web IDE Prototyping](https://img.youtube.com/vi/uA5v16mtczs/0.jpg)](https://youtu.be/uA5v16mtczs)

# NIH - KISS programming language

- A next-generation pragmatic programming language inspired by the subjective best of all the programming languages since Plankalkül
- Made for daily work where you should have *fun* (most of time, at least..)
- KISS as the main development rule - and compared to DRY/YAGNI & co, the only non-subjective and non-context-dependant one

## Web IDE (WIDE) Vision
- NIH Web IDE as the daily development platform, in addition to traditional ```$ nih main.nih``` way
- 2D/3D rendering allows inline math equations, graphs, images and other non-text elements into code view (..maybe not audio.. maybe..)
- 3D scenes and image shaders can run behind the code view or in own viewport, or on own monitor, or own VR headset
- Programmatical interactive elements in code documentation, inlined with code (literal programming as one inspiration)
- Avoiding the biggest mistake in GUIs that concerns coders: GUIs are great for discoverability and visualization, but mouse input is *slow* versus keyboard for those that hit the keyboard every day with all the 10 fingers -> in WIDE, almost everything will be controllable with a keyboard and text input, in addition to keeping the GUI option for discoverability

## General Features
- "Batteries included" vision - package manager and build/test/lint/autoformat/CI/CD integrated into the language itself, controlled by config.nih in the project root
- The source is still text, not obscure undiffable binary formats
- Source code can be in two syntaxes: Nih-Sexpr, which is the main persistance format for WIDE, and Nih-C, which is for *most part* faster to write and read
- The Lisp-family & C-family syntax can be mixed in the same source code module with a lang #pragma
- Automatic code formatting naturally with S-expressions, WIDE doesn't store tabs and unnecessary spaces unless in literal strings, same with ```$ nih --output-sexpr source.nih``` 
- "Ends the Tabs vs Spaces religious war once and for all".. goal
- Benevolent dictatorship in language design, as determined by the author. Sorry, committees not allowed. Ever. Maybe. Strong Maybe.
- Open-source, MIT license - "Monetizing a programming language directly is a folly".

## Documentation Vision
- Automatic documentation generation from code is supported by base NIH compiler
- Same syntax as inline math equations, links, images, 3D object refs, ...  - WYSIWYG
- Code completion for all imported NIH libraries, but also for external JS/C APIs if type declarations are provided for them

## Type declarations for external not-NIH APIs 
- Auto-generation of type declarations from C and TS libraries (C++.. maybe, this is heavily opionated language after all)
- AI-assisted auto-generation of type declarations from JS libraries by running JS interpreter - and also inputting JS library documentation, if available

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
  do:
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
e = 1.0

for i = 0..WIDTH
  for j = 0..HEIGHT
    cx = rs + :float i / WIDTH * (re - rs)
    cy = is + :float j / HEIGHT * (ie - is)
    m = mandelbrot(cx, cy)
    printchars(m > 0.0 ? '*' : ' ')
  printlf()
```

Unlike C, newline acts as a terminator ';' and {} are replaced with meaningful-indentation. Nih compiler does not allow TABs in the source code, unless inside quotes.

..and in more mainstream C-family syntax:

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

## Inspirations (and Selective Not-Inspirations)

### Inspired By:
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

### Appreciated, But Not Followed:
- **C++**: Acknowledged for its influence and power, but seeking to avoid its complexity.
- **Java**: Recognized for its portability and JVM, aiming for a more succinct syntax.
- **JavaScript**: For its rapid development and deployment capabilities.
- **Haskell**: Its functional programming model is enlightening, yet looking to remain more accessible and practical without deep functional concepts.

### Also As Concepts/Paradigms/Way-Of-Life:
- **KISS (Keep It Simple, Stupid)**: A principal guide in design for clarity and efficiency.
- **Live Coding and REPL**: Valuing the interactive development experience and immediate feedback.
- **Actor Model**: Adopting a model of concurrency that promotes isolation and message passing.
- **Literal Programming**: Exploring the narrative within code, where documentation and logic intertwine seamlessly.

### With a Nod and a Smile:
- **COBOL**: Though not directly inspiring, it’s a nod to the history and evolution of programming languages.
- **Not-Inspirations** in jest (C++, Java, JavaScript, Haskell): While teasingly mentioned, it's with respect for their contributions to the programming world. Each language has its place and purpose, and understanding their challenges and complexities can also inspire innovation and clarity in new language design.

# Syntax Examples

While NIH is meant to be stored in a S-expression format, it is intended to be viewed and edited mainly in non-Lispy syntax. You can edit the S-expressions directly if you so desire - and as option, compiling traditionally from a text file will be supported to keep the options open (and as the language evolves, will even be the first option).

### Print/logging (configurable, from System.print automatically, no need for imports)

Lua-style simplicity, one-liner scripts work (automatically main module). No parens needed for parameters.
~~~
print 'Hiihoo'
~~~
~~~
print 'The answer to life, universe is...' (6*7)
~~~
You can use parens, but not the default. Necessary when ambiguous otherwise. " or ', you decide.
~~~
print("The answer to life, universe =", 6*7)
~~~

### String Interpolation
~~~
print 'Hey $yourname, the answer to life, universe and everything is.. $(6*7).'
~~~

### S-Expressions
~~~
(print 'Hiihoo')
~~~
~~~
(print 'The answer to life, universe is...' (* 6 7))
~~~
Note that inside quotes, nothing is different, always UTF-8.
~~~
(print 'Hey $yourname, the answer to life, universe and everything is.. $(6*7).')
~~~
### Variables

As a design goal, prefer pure functions and immutable values first and require more syntax for mutability. No need for 'const' keyword below, as both 'foo' and 'bar' are immutable values by default. NIH also uses type inference - which makes code shorter and more readable in trivial unambiguous cases (still a good idea to specify types in an API for clarity, for example, even if not strictly required).
~~~
foo = 100    // type inferred -> integer
bar = 123.0  // type inferred -> float (32-bit floating point 'f32' by default)
~~~

Mutable variables with :=
~~~
counter := 0
~~~

Explicit type syntax as in Go, no ':' required. Note that 'f16' below is a 16-bit floating point type as used in GPU shaders - usually called 'half'. On that note, one the main goals of NIH is to support sharing library code between CPU and GPU code (shaders/compute).
~~~
mypi = f16(3.141592)  // 'constructor' syntax
mypi = 3.141592 f16   // typed literal value
mypi f16 = 3.141592   // 
~~~
### One-liner function declarations
~~~
fun foo() = bar
~~~

Math-style factors/multipliers without *.
~~~
fun double(x) = 2x
~~~

Dashes in identifiers. To make parsing work, only unary minus is allowed without whitespace around, otherwise 42 - 0 style.
~~~
the-answer = 42
~~~

Optional return. By default, returns the value of the last expression in a function. Return is useful for early exit.
~~~
fun the-answer-as-func() = return 42
~~~
### Functions
~~~
fun foo():
  bar
~~~

~~~
fun double(x) u64:
  return 2 * x
~~~
### Multi-line strings (automatically from the block, leading/trailing spaces not stored, \n are)
~~~
nethack-putka:
  ######
  #.$..|
  ######
~~~

# Getting Started

TODO

# Development

- Node/TypeScript project with ES Modules, testing, and linting
- node/tsc/esnext/esm/eslint/jest/prettier
- install ESLint and Prettier extensions for Visual Studio Code

# Roadmap

-> GLSL backend (one the goals of NIH is to share library code between CPU and GPU code)
-> Web live coding editor
-> Integrated linter
-> Integrated code formatter (if required for 'textual NIH' source code? For S-expressions no need)
-> WebAssembly backend

## Just do it

~~~
$ npm run build:test:start
~~~

# Contributing

Thrilled that you're interested in contributing to NIH! This project thrives on community feedback and the diverse perspectives of programmers like you.
