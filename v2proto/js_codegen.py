import json

# Mapping of NIH builtins to JavaScript equivalents
enum = {}  # placeholder
BUILTINS = {
    'print': 'stdlib.print',
    'sqrt': 'stdlib.sqrt',
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
            # runtime stubs for print and sqrt
            lines.append('    const stdlib = {')
            lines.append('        print: function(s) { console.log(String(s)); },')
            lines.append('        sqrt: Math.sqrt')
            lines.append('    };')
        else:
            lines.append('(function() {')
            # runtime stubs for print and sqrt
            lines.append('    const stdlib = {')
            lines.append('        print: function(s) { process.stdout.write(String(s)); },')
            lines.append('        sqrt: Math.sqrt')
            lines.append('    };')
        # Pre-scan for top-level assignments
        stmts = program.get('body', [])
        # Only consider assignments at the top level
        top_assigns = [s for s in stmts if s.get('type') == 'assignment']
        assignment_counts = {}
        for s in top_assigns:
            name = s['left']['name']
            assignment_counts[name] = assignment_counts.get(name, 0) + 1
        # Loop variables at top level
        for_vars = [s.get('var') for s in stmts if s.get('type') == 'for']
        # Globals: assigned names and for-loop counters
        globals_ = set(assignment_counts.keys()) | set(for_vars)
        # Immutable: assigned once and not loop counters
        immutable_globals = [v for v, c in assignment_counts.items() if c == 1 and v not in for_vars]
        mutable_globals = [v for v in globals_ if v not in immutable_globals]
        # Separate initial values and remaining statements
        initial_values = {s['left']['name']: s['right'] for s in top_assigns if s['left']['name'] in immutable_globals}
        new_stmts = [s for s in stmts if not (s.get('type') == 'assignment' and s['left']['name'] in immutable_globals)]
        # Emit global declarations
        if mutable_globals:
            lines.append('    let ' + ', '.join(mutable_globals) + ';')
        for v in immutable_globals:
            expr = self.emit_expr(initial_values[v])
            lines.append(f'    const {v} = {expr};')
        # Emit each top-level statement
        for stmt in new_stmts:
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
            # simple assignment if already declared as local
            if hasattr(self, 'current_locals') and left in self.current_locals:
                lines.append(f"{ind}{left} = {right};")
            else:
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
            # avoid redeclaring loop var if already declared
            if hasattr(self, 'current_locals') and var in self.current_locals:
                lines.append(f"{ind}for ({var} = {start}; {var} <= {end}; {var}++) {{")
            else:
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
        # Pre-scan function body
        body = stmt.get('body', [])
        locals_ = self.collect_locals(body)
        params_set = set(params)
        # Counts of assignments per identifier
        assignment_counts = self.count_assignments(body)
        # Loop counters
        for_vars = self.collect_for_vars(body)
        # Variables assigned inside any loop body
        loop_assigned = self.collect_loop_assigned(body)
        # Determine immutable (assigned once outside loops) and mutable locals
        immutable_locals = [v for v in locals_ if v not in params_set and assignment_counts.get(v, 0) == 1 and v not in for_vars and v not in loop_assigned]
        mutable_locals = [v for v in locals_ if v not in params_set and v not in immutable_locals]
        # Partition body to extract initial values and remove immutable assignments
        initial_values = {}
        def partition(stmts):
            new = []
            for s in stmts:
                if s.get('type') == 'assignment' and s['left']['name'] in immutable_locals:
                    initial_values[s['left']['name']] = s['right']
                elif s.get('type') in ('if', 'while', 'for'):
                    s_copy = dict(s)
                    s_copy['body'] = partition(s.get('body', []))
                    new.append(s_copy)
                else:
                    new.append(s)
            return new
        new_body = partition(body)
        # Emit function signature
        lines = [f"{ind}function {name}({', '.join(params)}) {{"]
        # Emit const declarations for immutable locals
        for v in immutable_locals:
            expr = self.emit_expr(initial_values[v])
            lines.append(f"{ind}    const {v} = {expr};")
        # Emit let declarations for mutable locals
        if mutable_locals:
            lines.append(f"{ind}    let {', '.join(mutable_locals)};")
        # Set current locals for nested assignments
        old_locals = getattr(self, 'current_locals', None)
        self.current_locals = set(mutable_locals)
        # Emit body
        for s in new_body:
            for line in self.emit_statement(s, indent+1):
                lines.append(line)
        # Close function
        lines.append(f"{ind}}}")
        # Restore previous current_locals
        if old_locals is None:
            delattr(self, 'current_locals')
        else:
            self.current_locals = old_locals
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

    def count_assignments(self, stmts):
        counts = {}
        for stmt in stmts:
            t = stmt.get('type')
            if t == 'assignment':
                left = stmt['left']
                if left.get('type') == 'identifier':
                    name = left.get('name')
                    counts[name] = counts.get(name, 0) + 1
            elif t in ('if', 'while', 'for'):
                # recurse into bodies of control-flow statements
                nested_counts = self.count_assignments(stmt.get('body', []))
                for k, v in nested_counts.items():
                    counts[k] = counts.get(k, 0) + v
        return counts

    def collect_for_vars(self, stmts):
        vars_ = set()
        for stmt in stmts:
            t = stmt.get('type')
            if t == 'for':
                vars_.add(stmt.get('var'))
            elif t in ('if', 'while'):
                vars_ |= self.collect_for_vars(stmt.get('body', []))
        return vars_

    def collect_loop_assigned(self, stmts):
        assigned = set()
        for s in stmts:
            t = s.get('type')
            if t in ('for', 'while'):
                body = s.get('body', [])
                assigned |= self.collect_locals(body)
                assigned |= self.collect_loop_assigned(body)
            elif t == 'if':
                assigned |= self.collect_loop_assigned(s.get('body', []))
        return assigned

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
