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
        return {"kind": self.kind, "source": self.text}

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
