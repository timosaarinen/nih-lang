from parser import Section, File, Project

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
                print(to_sexpr(s.ast))