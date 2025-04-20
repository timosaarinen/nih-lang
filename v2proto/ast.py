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
    # skip empty markdown sections
    if mode == "markdown" and not content.strip():
        buffer.clear()
        return
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


def parse_expression(expr):
    expr = expr.strip()
    if not expr:
        return None
    token_specification = [
        ('NUMBER',   r'\d+(\.\d*)?'),
        ('STRING',   r"'[^']*'"),
        ('IDENT',    r'[A-Za-z_][A-Za-z0-9_]*'),
        ('OP',       r'\+|\-|\*|\/|>=|<=|==|!=|>|<|\?|:'),
        ('LPAREN',   r'\('),
        ('RPAREN',   r'\)'),
        ('COMMA',    r','),
        ('SKIP',     r'[ \t]+'),
    ]
    tok_regex = '|'.join('(?P<%s>%s)' % pair for pair in token_specification)
    tokens = []
    for mo in re.finditer(tok_regex, expr):
        kind = mo.lastgroup
        value = mo.group(kind)
        if kind == 'NUMBER':
            tokens.append(('NUMBER', float(value) if '.' in value else int(value)))
        elif kind == 'STRING':
            tokens.append(('STRING', value[1:-1]))
        elif kind == 'IDENT':
            tokens.append(('IDENT', value))
        elif kind == 'OP':
            tokens.append(('OP', value))
        elif kind in ('LPAREN', 'RPAREN', 'COMMA'):
            tokens.append((kind, value))
        elif kind == 'SKIP':
            continue
        else:
            raise SyntaxError(f'Unknown token {value}')
    tokens.append(('EOF', None))

    pos = 0
    def peek():
        return tokens[pos]
    def advance():
        nonlocal pos
        tok = tokens[pos]
        pos += 1
        return tok
    def expect(kind, value=None):
        tok = peek()
        if tok[0] != kind or (value is not None and tok[1] != value):
            raise SyntaxError(f'Expected {kind} {value}, got {tok}')
        return advance()
    def parse_primary():
        tok = peek()
        if tok[0] == 'NUMBER':
            advance()
            return {'type': 'literal', 'value': tok[1]}
        if tok[0] == 'STRING':
            advance()
            return {'type': 'literal', 'value': tok[1]}
        if tok[0] == 'IDENT':
            advance()
            name = tok[1]
            if peek()[0] == 'LPAREN':
                advance()
                args = []
                if peek()[0] != 'RPAREN':
                    while True:
                        args.append(parse_expression_inner())
                        if peek()[0] == 'COMMA':
                            advance()
                            continue
                        break
                expect('RPAREN')
                return {'type': 'call', 'callee': name, 'arguments': args}
            return {'type': 'identifier', 'name': name}
        if tok[0] == 'LPAREN':
            advance()
            node = parse_expression_inner()
            expect('RPAREN')
            return node
        if tok[0] == 'OP' and tok[1] == '-':
            advance()
            operand = parse_primary()
            return {'type': 'unary', 'operator': '-', 'operand': operand}
        raise SyntaxError(f'Unexpected token {tok}')
    def parse_multiplicative():
        node = parse_primary()
        while peek()[0] == 'OP' and peek()[1] in ('*','/'):
            op = advance()[1]
            right = parse_primary()
            node = {'type': 'binary', 'operator': op, 'left': node, 'right': right}
        return node
    def parse_additive():
        node = parse_multiplicative()
        while peek()[0] == 'OP' and peek()[1] in ('+','-'):
            op = advance()[1]
            right = parse_multiplicative()
            node = {'type': 'binary', 'operator': op, 'left': node, 'right': right}
        return node
    def parse_comparison():
        node = parse_additive()
        if peek()[0] == 'OP' and peek()[1] in ('>','<','>=','<=','==','!='):
            op = advance()[1]
            right = parse_additive()
            node = {'type': 'binary', 'operator': op, 'left': node, 'right': right}
        return node
    def parse_ternary():
        node = parse_comparison()
        if peek()[0] == 'OP' and peek()[1] == '?':
            advance()
            true_expr = parse_expression_inner()
            expect('OP', ':')
            false_expr = parse_expression_inner()
            node = {'type': 'ternary', 'test': node, 'consequent': true_expr, 'alternate': false_expr}
        return node
    def parse_expression_inner():
        return parse_ternary()

    return parse_expression_inner()


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
            statements.append({"type": "return", "value": parse_expression(val)})
            idx += 1
            continue
        # Assignment or expression
        parts = lines[idx].split(";")
        for part in parts:
            p = part.strip()
            if not p:
                continue
            # Handle augmented assignments first
            aug_map = {'+=': '+', '-=': '-', '*=': '*', '/=': '/'}
            for op, binop in aug_map.items():
                if op in p:
                    lhs_str, rhs_str = p.split(op, 1)
                    lhs_node = parse_expression(lhs_str.strip())
                    rhs_node = parse_expression(rhs_str.strip())
                    # transform to lhs = lhs binop rhs
                    new_rhs = {'type': 'binary', 'operator': binop, 'left': lhs_node, 'right': rhs_node}
                    statements.append({'type': 'assignment', 'left': lhs_node, 'right': new_rhs})
                    break
            else:
                if '=' in p:
                    lhs_str, rhs_str = p.split('=', 1)
                    statements.append({'type': 'assignment', 'left': parse_expression(lhs_str.strip()), 'right': parse_expression(rhs_str.strip())})
                else:
                    statements.append({'type': 'expression', 'expr': parse_expression(p)})
        idx += 1
    return statements


def to_sexpr(node):
    if node is None:
        return 'nil'
    if isinstance(node, (str, int, float)):
        if isinstance(node, str):
            return '"' + node.replace('"', '\\"') + '"'
        return str(node)
    if isinstance(node, list):
        return '(' + ' '.join(to_sexpr(n) for n in node) + ')'
    if isinstance(node, dict):
        t = node.get('type')
        parts = []
        if t:
            parts.append(t)
            for k, v in node.items():
                if k == 'type':
                    continue
                parts.append('(' + k + ' ' + to_sexpr(v) + ')')
        else:
            for k, v in node.items():
                parts.append('(' + k + ' ' + to_sexpr(v) + ')')
        return '(' + ' '.join(parts) + ')'
    return repr(node)


def print_sexpr_project(project):
    for f in project.files:
        for s in f.sections:
            if s.kind == 'markdown':
                for line in s.text.splitlines():
                    print('# ' + line)
            else:
                ast = parse_code(s.text)
                print(to_sexpr(ast))


def main():
    parser = argparse.ArgumentParser(description="Parse NIH file and output AST as JSON")
    parser.add_argument("--sexpr", action="store_true", help="Output AST in S-expression format (markdown as comments)")
    parser.add_argument("file", help="Path to NIH file")
    args = parser.parse_args()
    try:
        with open(args.file, "r", encoding="utf-8") as f:
            src = f.read()
    except Exception as e:
        print(f"Error reading file: {e}", file=sys.stderr)
        sys.exit(1)
    project = parse_document(src)
    if getattr(args, 'sexpr', False):
        print_sexpr_project(project)
        return
    print(json.dumps(project.to_dict(), indent=2))


if __name__ == "__main__":
    main()
