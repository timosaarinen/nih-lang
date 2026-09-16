# NIH for coding agents

V3 treats the compiler as an edit/query server even though the first interface is a CLI.

## Query, don't grep by default

```bash
nih query file.nih function_name
nih query file.nih fn:function_name
nih graph file.nih
```

A function query returns its semantic node, related nodes, call edges and the current semantic graph hash.

Semantic IDs intentionally prefer human-recognizable forms:

- `fn:portal_surface`
- `ct:quality:HIGH`
- `param:portal_surface:local`
- `local:portal_surface:energy`
- `call:portal_surface:3`
- `lit:portal_surface:17`

Symbol IDs are stable across formatting. Ordinal call/literal IDs are stable across formatting but may move after structural edits; the graph hash prevents using them against the wrong revision.

## Patch protocol v1

```json
{
  "expect": "sha256...",
  "ops": [
    { "op": "set-literal", "node": "lit:portal_surface:17", "value": 0.42 },
    { "op": "rename-function", "from": "fbm4", "to": "portal_fbm" },
    { "op": "set-target", "function": "helper", "target": "shared" }
  ]
}
```

`nih patch source.nih patch.json` prints canonical patched source. Add `--write` to replace the file.

Every patch:

- requires the exact semantic hash it was designed against
- fails closed on missing IDs or invalid values
- recompiles/type-checks the whole result
- rewrites through the deterministic formatter

## Why text remains canonical

Agents benefit from semantic operations, but humans still need `git diff`, editors, grep, code review and a source file that survives without NIH tooling. The graph is rebuildable compiler output, not persistent project state.

## Planned protocol growth

Add operations only when there is a real use case:

- rename parameters/locals with scope-aware reference updates
- insert/delete statements by semantic anchor
- replace an expression subtree
- add a function/call with typed arguments
- narrow graph queries to dependency slices
- compiler-produced minimal context bundles for an agent task

The desired endpoint is `nih query/patch` as a compact local protocol suitable for CLIs, MCP/tools and long-running agents.
