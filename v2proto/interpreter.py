#!/usr/bin/env python3
import math
import sys
import parser

class ReturnException(Exception):
    def __init__(self, value):
        self.value = value

class Interpreter:
    def __init__(self, debug=False):
        self.debug = debug
        self.globals = {}
        self.functions = {}
        self.builtins = {
            'print': self._builtin_print,
            'sqrt': math.sqrt,
        }

    def _builtin_print(self, arg):
        sys.stdout.write(str(arg))
        return None

    def run(self, project):
        for f in project.files:
            for s in f.sections:
                if s.kind == 'code':
                    self.execute_program(s.ast)

    def execute_program(self, program):
        self._eval_statements(program['body'], self.globals)

    def _eval_statements(self, stmts, env):
        for stmt in stmts:
            self._eval_statement(stmt, env)

    def _eval_statement(self, stmt, env):
        if self.debug:
            print("Executing stmt:", stmt)
        t = stmt['type']
        if t == 'function':
            self.functions[stmt['name']] = stmt
            return
        if t == 'while':
            while self._eval_expression(stmt['test'], env):
                self._eval_statements(stmt['body'], env)
            return
        if t == 'if':
            if self._eval_expression(stmt['test'], env):
                self._eval_statements(stmt['body'], env)
            return
        if t == 'return':
            val = None
            if stmt.get('value') is not None:
                val = self._eval_expression(stmt['value'], env)
            raise ReturnException(val)
        if t == 'assignment':
            name = stmt['left']['name']
            value = self._eval_expression(stmt['right'], env)
            env[name] = value
            return
        if t == 'expression':
            self._eval_expression(stmt['expr'], env)
            return
        raise RuntimeError(f'Unknown statement type: {t}')

    def _eval_expression(self, expr, env):
        if self.debug:
            print("Evaluating expr:", expr)
        if expr is None:
            return None
        t = expr['type']
        if t == 'literal':
            val = expr['value']
            if isinstance(val, str):
                return bytes(val, 'utf-8').decode('unicode_escape')
            return val
        if t == 'identifier':
            name = expr['name']
            if name in env:
                return env[name]
            if name in self.builtins:
                return self.builtins[name]
            raise NameError(f'Undefined variable: {name}')
        if t == 'call':
            callee = expr['callee']
            args = [self._eval_expression(a, env) for a in expr['arguments']]
            if callee in self.builtins:
                return self.builtins[callee](*args)
            if callee in self.functions:
                func = self.functions[callee]
                local_env = dict(self.globals)
                for param, arg in zip(func['params'], args):
                    local_env[param['name']] = arg
                try:
                    self._eval_statements(func['body'], local_env)
                except ReturnException as r:
                    return r.value
                return None
            raise NameError(f'Undefined function: {callee}')
        if t == 'binary':
            op = expr['operator']
            left = self._eval_expression(expr['left'], env)
            right = self._eval_expression(expr['right'], env)
            if op == '+': return left + right
            if op == '-': return left - right
            if op == '*': return left * right
            if op == '/': return left / right
            if op == '>': return left > right
            if op == '<': return left < right
            if op == '>=': return left >= right
            if op == '<=': return left <= right
            if op == '==': return left == right
            if op == '!=': return left != right
            raise RuntimeError(f'Unknown binary operator: {op}')
        if t == 'unary':
            op = expr['operator']
            operand = self._eval_expression(expr['operand'], env)
            if op == '-': return -operand
            raise RuntimeError(f'Unknown unary operator: {op}')
        if t == 'ternary':
            test = self._eval_expression(expr['test'], env)
            if test: return self._eval_expression(expr['consequent'], env)
            return self._eval_expression(expr['alternate'], env)
        raise RuntimeError(f'Unknown expression type: {t}')
