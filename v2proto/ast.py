#!/usr/bin/env python3
"""
Parse NIH-formatted document and output its AST in JSON.
Usage: uv run v2proto/ast.py <file>
"""
import argparse
import json
import re
import sys

class Section:
    def __init__(self, kind, text):
        self.kind = kind
        self.text = text

    def to_dict(self):
        if self.kind == "markdown":
            return {"kind": self.kind, "text": self.text}
        return {"kind": self.kind, "source": self.text, "ast": parse_code(self.text)}

class File:
    def __init__(self, name, lang=None):
        self.name = name
        self.lang = lang
        self.sections = []

    def to_dict(self):
        return {
            "name": self.name,
            "lang": self.lang,
            "sections": [s.to_dict() for s in self.sections],
        }

class Project:
    def __init__(self):
        self.files = []

    def to_dict(self):
        return {"files": [f.to_dict() for f in self.files]}


def parse_file_attrs(rest):
    name = "<unnamed>"
    lang = None
    m = re.search(r'name="([^"]*)"', rest)
    if m:
        name = m.group(1)
    m = re.search(r'lang="([^"]*)"', rest)
    if m:
        lang = m.group(1)
    return name, lang


def flush_section(current_file, buffer, mode):
    if not buffer:
        return
    content = "".join(buffer)
    if mode == "markdown":
        current_file.sections.append(Section("markdown", content))
    else:
        current_file.sections.append(Section("code", content))
    buffer.clear()


def parse_document(src):
    project = Project()
    current_file = None
    mode = "markdown"
    buffer = []
    for line in src.splitlines(keepends=True):
        stripped = line.lstrip()
        if line.startswith("#file"):
            if current_file:
                flush_section(current_file, buffer, mode)
                project.files.append(current_file)
            rest = line[len("#file"):].strip()
            name, lang = parse_file_attrs(rest)
            current_file = File(name, lang)
            mode = "markdown"
        elif stripped.startswith("#code"):
            if current_file:
                flush_section(current_file, buffer, mode)
                mode = "code"
        elif stripped.startswith("#end code"):
            if current_file:
                flush_section(current_file, buffer, mode)
                mode = "markdown"
        elif stripped.startswith("#end file"):
            if current_file:
                flush_section(current_file, buffer, mode)
                project.files.append(current_file)
                current_file = None
            mode = "markdown"
        else:
            buffer.append(line)
    if current_file:
        flush_section(current_file, buffer, mode)
        project.files.append(current_file)
    return project


def parse_code(source):
    """Parse code string into an AST."""
    # Remove line comments
    src = '\n'.join([re.sub(r'//.*', '', line) for line in source.splitlines()])
    lines = src.splitlines()
    return {"type": "program", "body": parse_statements(lines)}


def parse_statements(lines):
    statements = []
    idx = 0
    while idx < len(lines):
        line = lines[idx].strip()
        if not line:
            idx += 1
            continue
        # Function definition
        if line.startswith("fun "):
            m = re.match(r"fun\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?::\s*([^ \t]+))?", line)
            name = m.group(1) if m else ""
            params_str = m.group(2) if m else ""
            ret = m.group(3) if m and m.group(3) else None
            params = []
            if params_str:
                for p in params_str.split(","):
                    parts = p.split(":")
                    if len(parts) == 2:
                        params.append({"name": parts[0].strip(), "type": parts[1].strip()})
            idx += 1
            body_lines = []
            nest = 1
            while idx < len(lines) and nest > 0:
                l = lines[idx].strip()
                if l.startswith("fun "):
                    nest += 1
                    body_lines.append(lines[idx])
                elif l == "end":
                    nest -= 1
                    if nest == 0:
                        break
                    else:
                        body_lines.append(lines[idx])
                else:
                    body_lines.append(lines[idx])
                idx += 1
            body = parse_statements(body_lines)
            statements.append({"type": "function", "name": name, "params": params, "returnType": ret, "body": body})
            idx += 1
            continue
        # While loop
        if line.startswith("while "):
            cond = line[len("while "):].strip()
            if cond.endswith(" do"):
                cond = cond[:-3].strip()
            idx += 1
            body_lines = []
            nest = 1
            while idx < len(lines) and nest > 0:
                l = lines[idx].strip()
                if l.startswith("while "):
                    nest += 1
                    body_lines.append(lines[idx])
                elif l == "end":
                    nest -= 1
                    if nest == 0:
                        break
                    else:
                        body_lines.append(lines[idx])
                else:
                    body_lines.append(lines[idx])
                idx += 1
            body = parse_statements(body_lines)
            statements.append({"type": "while", "test": cond, "body": body})
            idx += 1
            continue
        # If statement
        if line.startswith("if "):
            cond = line[len("if "):].strip()
            if cond.endswith(" then"):
                cond = cond[:-5].strip()
            idx += 1
            body_lines = []
            nest = 1
            while idx < len(lines) and nest > 0:
                l = lines[idx].strip()
                if l.startswith("if "):
                    nest += 1
                    body_lines.append(lines[idx])
                elif l == "end":
                    nest -= 1
                    if nest == 0:
                        break
                    else:
                        body_lines.append(lines[idx])
                else:
                    body_lines.append(lines[idx])
                idx += 1
            body = parse_statements(body_lines)
            statements.append({"type": "if", "test": cond, "body": body})
            idx += 1
            continue
        # Return statement
        if line.startswith("return"):
            val = line[len("return"):].strip()
            statements.append({"type": "return", "value": val})
            idx += 1
            continue
        # Assignment or expression
        parts = lines[idx].split(";")
        for part in parts:
            p = part.strip()
            if not p:
                continue
            if "=" in p:
                lhs, rhs = p.split("=", 1)
                statements.append({"type": "assignment", "left": lhs.strip(), "right": rhs.strip()})
            else:
                statements.append({"type": "expression", "expr": p})
        idx += 1
    return statements


def main():
    parser = argparse.ArgumentParser(description="Parse NIH file and output AST as JSON")
    parser.add_argument("file", help="Path to NIH file")
    args = parser.parse_args()
    try:
        with open(args.file, "r", encoding="utf-8") as f:
            src = f.read()
    except Exception as e:
        print(f"Error reading file: {e}", file=sys.stderr)
        sys.exit(1)
    project = parse_document(src)
    print(json.dumps(project.to_dict(), indent=2))


if __name__ == "__main__":
    main()
