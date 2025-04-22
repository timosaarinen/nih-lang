import json

# Mapping of NIH builtins to JavaScript equivalents
enum = {}  # placeholder
BUILTINS = {
    'print': 'console.log',
    'sqrt': 'Math.sqrt',
}


def emit_js(project_ast, target='node'):
    """
    Generate JavaScript code from NIH project AST.
    project_ast: dict returned by project.to_dict()
    target: 'node' or 'browser'
    Returns JavaScript code as a string.
    """
    # Collect top-level statements
    stmts = []
    for f in project_ast.get('files', []):
        for section in f.get('sections', []):
            if section.get('kind') == 'code':
                ast = section.get('ast', {})
                stmts.extend(ast.get('body', []))
    program = {'type': 'program', 'body': stmts}
    gen = JSCodeGen(target)
    return gen.emit_program(program)


class JSCodeGen:
    def __init__(self, target='node'):
        self.target = target

    def emit_program(self, program):
        lines = []
        # Wrapper for browser or node
        if self.target == 'browser':
            lines.append('window.nih = (function() {')
        else:
            lines.append('(function() {')
        # Emit each top-level statement
        for stmt in program.get('body', []):
            for line in self.emit_statement(stmt, indent=1):
                lines.append(line)
        lines.append('})();')
        return '\n'.join(lines)

    def emit_statement(self, stmt, indent=0):
        ind = '    ' * indent
        t = stmt.get('type')
        lines = []
        if t == 'function':
            lines.extend(self.emit_function(stmt, indent))
        elif t == 'assignment':
            left = stmt['left']['name']
            right = self.emit_expr(stmt['right'])
            lines.append(f"{ind}let {left} = {right};")
        elif t == 'expression':
            expr = self.emit_expr(stmt['expr'])
            lines.append(f"{ind}{expr};")
        elif t == 'return':
            val = self.emit_expr(stmt.get('value')) if stmt.get('value') is not None else ''
            lines.append(f"{ind}return {val};")
        elif t == 'if':
            cond = self.emit_expr(stmt['test'])
            lines.append(f"{ind}if ({cond}) {{")
            for s in stmt.get('body', []):
                lines.extend(self.emit_statement(s, indent+1))
            lines.append(f"{ind}}}")
        elif t == 'while':
            cond = self.emit_expr(stmt['test'])
            lines.append(f"{ind}while ({cond}) {{")
            for s in stmt.get('body', []):
                lines.extend(self.emit_statement(s, indent+1))
            lines.append(f"{ind}}}")
        elif t == 'for':
            var = stmt['var']
            start = self.emit_expr(stmt['start'])
            end = self.emit_expr(stmt['end'])
            lines.append(f"{ind}for (let {var} = {start}; {var} <= {end}; {var}++) {{")
            for s in stmt.get('body', []):
                lines.extend(self.emit_statement(s, indent+1))
            lines.append(f"{ind}}}")
        else:
            # Unsupported statement types are ignored
            pass
        return lines

    def emit_function(self, stmt, indent=0):
        ind = '    ' * indent
        name = stmt.get('name')
        params = [p['name'] for p in stmt.get('params', [])]
        lines = []
        # Pre-scan for local variable declarations
        locals_ = self.collect_locals(stmt.get('body', []))
        params_set = set(params)
        locals_to_declare = [v for v in locals_ if v not in params_set]
        # Function declaration
        lines.append(f"{ind}function {name}({', '.join(params)}) {{")
        # Declare locals at top
        if locals_to_declare:
            lines.append(f"{ind}    let {', '.join(locals_to_declare)};")
        # Body statements
        for s in stmt.get('body', []):
            lines.extend(self.emit_statement(s, indent+1))
        lines.append(f"{ind}}}")
        return lines

    def collect_locals(self, stmts):
        names = set()
        for stmt in stmts:
            t = stmt.get('type')
            if t == 'assignment':
                left = stmt['left']
                if left.get('type') == 'identifier':
                    names.add(left.get('name'))
            elif t == 'for':
                names.add(stmt.get('var'))
                names |= self.collect_locals(stmt.get('body', []))
            elif t in ('if', 'while'):
                names |= self.collect_locals(stmt.get('body', []))
            # nested functions are not scanned
        return names

    def emit_expr(self, expr):
        if expr is None:
            return ''
        t = expr.get('type')
        if t == 'literal':
            v = expr.get('value')
            if isinstance(v, str):
                return json.dumps(v)
            else:
                return str(v)
        elif t == 'identifier':
            return expr.get('name')
        elif t == 'call':
            callee = expr.get('callee')
            args = [self.emit_expr(a) for a in expr.get('arguments', [])]
            fn = BUILTINS.get(callee, callee)
            return f"{fn}({', '.join(args)})"
        elif t == 'binary':
            left = self.emit_expr(expr.get('left'))
            right = self.emit_expr(expr.get('right'))
            op = expr.get('operator')
            return f"({left} {op} {right})"
        elif t == 'unary':
            operand = self.emit_expr(expr.get('operand'))
            return f"{expr.get('operator')}{operand}"
        elif t == 'ternary':
            test = self.emit_expr(expr.get('test'))
            cons = self.emit_expr(expr.get('consequent'))
            alt = self.emit_expr(expr.get('alternate'))
            return f"({test} ? {cons} : {alt})"
        # Unsupported expressions
        return 'undefined'
