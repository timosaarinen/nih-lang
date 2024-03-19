# NIH, a programming language

- A next-generation programming language inspired by the subjective best of all the programming languages since Plankalkül.
- Persistence with structured S-expression code - tabs and spaces are not stored unless quoted - "Ends the Tabs vs Spaces religious war once and for all".
- HTML5/Web/Cloud What You See Is What You Get Integrated Development Environment (WYSIWYG IDE) the intended daily development platform - not included here.
- "Batteries included" vision - package manager and build/test/lint/autoformat/CI/CD integrated into the language itself.
- Benevolent dictatorship in language design, as determined by the author. Sorry, committees not allowed. Ever. Maybe. Strong Maybe.
- Open-source, MIT license - "Monetizing a programming language directly is a folly".

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

While NIH is stored in a S-expression format, it is intended to be viewed and edited mainly in non-Lispy syntax. You can edit the S-expressions directly, if you want, though!

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

No const needed, always go for pure functions and immutability first. Type inference.
~~~
bar = 100
~~~

### Mutability

Long keyword for mutability... Types as in Go.
~~~
mutable numclicks u64 = 0
~~~
### One-liner function declarations
~~~
foo() = bar
~~~

Math-style factors/multipliers without *.
~~~
double(x) = 2x
~~~

Dashes in identifiers. To make parsing work, only unary minus is allowed without whitespace around, otherwise 42 - 0 style.
~~~
the-answer = 42
~~~

Optional return. By default, returns the value of the last expression in a function. Return is useful for early exit.
~~~
the-answer-as-func() = return 42
~~~
### Functions
~~~
foo():
  bar
~~~

~~~
double(x) u64:
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

# TODO

- lex, parse, emitjs, evaljs passes
- webassembly emit later
- no AST eval needed, skip it, eval JS
- OT: for Naama, live coding interface, compile to JS on every char change, eval JS, output as overlay to text input area so works on portrait phones too
- KISS lexical analyzer and AST gen parser.. lexinit,getnexttoken n,allow to add code for repl - keep the line start pos, 
- emit JS, add prefix lib/boot code, emit AST to JS


## Just do it

~~~
$ npm run build:test:start
~~~

# Contributing

Thrilled that you're interested in contributing to NIH! This project thrives on community feedback and the diverse perspectives of programmers like you.