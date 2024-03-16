# NIH, the programming language

- the next generation programming language inspired by the best of the best (or parts of)
- ends the Tabs vs Spaces religious war once and for all. You are welcome.
- structured S-expression storage, tabs and spaces are not stored unless quoted (think HTML whitespace)
- web/H5 IDE with WYSIWYG, but terminal support naturally too (devrant: don't make GUIs for coders unless needed, please.. slow as...)
- package manager and build system with CI/CD integrated into the NIH package itself (git only, Suomi Finland Per..)
- total dictatorship in design by Timo Saarinen. Sorry, committees not allowed. Ever. Maybe. Strong Maybe.
- open-source, MIT license (...monetizing a programming language directly is a folly)

# Inspirations (and not-inspirations)

* Lua
* Lisp
* C
* not C++ (@Bjarne... why did I waste 30 years with this language, why??)
* not Java
* C#
* TypeScript
* not JavaScript.... (well, you got it up and running fast, @Brendan Eich, props for that)
* not Haskell (except for the mind-opening, but no monads or category theory burgers here)
* Go
* F# (fun)
* Nim (the name is similar..)
* Elm
* GLSL/HLSL shader programming languages (also computation)
* Literal Programming
* COBO.. nah, but:
* BASICs(!) - the ultimate simplicity and REPL on home computers, not good for large software projects (10+ lines)
* +++

# Syntax Examples

While NIH is stored in a S-expression format, it is viewed and edited in non-Lispy syntax. You CAN edit the S-expressions directly, if you want, though!

## Print/logging (configurable, from System.print automatically, no need for imports)
~~~
print 'Hiihoo'  # Lua-style simplicity, one-liners work (automatically main module). No parens needed for parameters
print 'The answer to life, universe is...' (6*7)
print("The answer to life, universe =", 6*7)  # You CAN use parens, but not the default. Necessary when ambiguous otherwise. " or ', you decide
print 'The answer to life, universe = $(6*7), $yourname')  # String interpolation
~~~
## S-Expressions
~~~
(print 'Hiihoo')
(print 'The answer to life, universe is...' (* 6 7))
(print 'The answer to life, universe = $(6*7), $yourname')  # Note that inside quotes, nothing is different, always UTF-8
~~~
## Variables
~~~
bar = 100  # No const needed, always go for pure functions and immutability first. Type inference
~~~

~~~
mutable numclicks u64 = 0  # Long keyword for mutability... Types as in Go
~~~
## One-liner function declarations
~~~
foo() = bar  # returns the value of 'bar'
double(x) = 2x  # math-style factors/multipliers without *
the-answer = 42  # dashes (to make parsing work, only unary minus is allowed without whitespace around, otherwise 42 - 0 style)
the-answer-as-func() = return 42  # optional return, otherwise returns the value of the last expression in a function. Useful for early exit
~~~
## Functions
~~~
foo():
  bar
~~~

~~~
double(x) u64:
  return 2 * x
~~~
## Multi-line strings (automatically from the block, leading/trailing spaces not stored, \n are)
~~~
nethack-putka:
  ######
  #.$..|
  ######
~~~

# Development

- Node/TypeScript project with ES Modules, testing, and linting
- node/tsc/esnext/esm/eslint/jest/prettier
- install ESLint and Prettier extensions for Visual Studio Code

## Just do it

~~~
$ npm run build:test:start
~~~
