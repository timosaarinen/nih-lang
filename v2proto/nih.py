#!/usr/bin/env python3
"""
Enter REPL with no file specified or parse NIH-formatted document and execute all code sections
in order with a tree-walking interpreter. Can also output AST in JSON or S-expression format.

Usage: uv run nih.py [--sexpr | --ast | --compile-js] [file]
"""
import argparse
import json
import sys
import parser
import sexpr
import interpreter
import js_codegen
#from parser import Section, File, Project

def repl_mode(args):
  interp = interpreter.Interpreter(debug=args.debug)
  print("NIH REPL. Type quit() or exit() to quit.")
  env = interp.globals
  while True:
      try:
          line = input(">>> ")
      except (EOFError, KeyboardInterrupt):
          print()
          break
      if not line.strip() or line.strip() in ("exit()", "quit()"):
          break
      try:
          prog = parser.parse_code(line)
          body = prog["body"]
          # single‐expression -> eval & print
          if len(body)==1 and body[0]["type"]=="expression":
              val = interp._eval_expression(body[0]["expr"], env)
              if val is not None:
                  print(val)
          else:
              interp._eval_statements(body, env)
      except Exception as e:
          print("Error:", e)
  return

def main():
    argparser = argparse.ArgumentParser(description="Run NIH file")
    argparser.add_argument("file", nargs="?", help="Path to NIH file (optional in REPL mode)")
    argparser.add_argument("--sexpr", action="store_true", help="Output AST in S-expression format (markdown as comments)")
    argparser.add_argument("--ast", action="store_true", help="Output AST in JSON format")
    argparser.add_argument("--compile-js", action="store_true", help="Generate JavaScript code")
    argparser.add_argument("--js-target", choices=["node","browser"], default="node", help="JavaScript target platform (node or browser)")
    argparser.add_argument("--out", help="Output file for compiled code (default: stdout)")
    argparser.add_argument("--debug", action="store_true", help="Print debug execution steps")
    args = argparser.parse_args()

    if not args.file:
        repl_mode(args)
        return

    try:
        with open(args.file, "r", encoding="utf-8") as f:
            src = f.read()
    except Exception as e:
        print(f"Error reading file: {e}", file=sys.stderr)
        sys.exit(1)
    project = parser.parse_document(src)

    if getattr(args, 'sexpr', False):
        sexpr.print_sexpr_project(project)
        return
    if getattr(args, 'ast', False):
        print(json.dumps(project.to_dict(), indent=2))
        return
    if getattr(args, 'compile_js', False):
        code = js_codegen.emit_js(project.to_dict(), args.js_target)
        if args.out:
            with open(args.out, "w", encoding="utf-8") as f:
                f.write(code)
        else:
            print(code)
        return

    # execute project
    interp = interpreter.Interpreter(debug=args.debug)
    interp.run(project)


if __name__ == "__main__":
    main()
