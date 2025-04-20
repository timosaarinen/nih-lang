#!/usr/bin/env python3
"""
Parse NIH-formatted document and execute all code sections of it in order with a tree-walking interpreter.
Can also output AST in JSON or S-expression format.

Usage: uv run nih.py [--sexpr | --ast] <file>
"""
import argparse
import json
import sys
import parser
import sexpr
import interpreter
#from parser import Section, File, Project

def main():
    argparser = argparse.ArgumentParser(description="Run NIH file")
    argparser.add_argument("file", help="Path to NIH file")
    argparser.add_argument("--sexpr", action="store_true", help="Output AST in S-expression format (markdown as comments)")
    argparser.add_argument("--ast", action="store_true", help="Output AST in JSON format")
    args = argparser.parse_args()
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

    # execute project
    interp = interpreter.Interpreter()
    interp.run(project)


if __name__ == "__main__":
    main()
