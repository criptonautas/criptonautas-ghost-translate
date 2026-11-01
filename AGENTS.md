# AGENTS.md

Translates Ghost posts and pages from criptonautas.co (Spanish) to en.criptonautas.co (English), re-translating only the blocks that changed. The logic lives here; n8n Code nodes run it.

## Layout

- `ghost-translate/core.js`: all pure logic, no I/O. Lines ending in `// export` are removed when emitted.
- `ghost-translate/access.js`: visibility logic, pasted alone into the small access nodes.
- `ghost-translate/wrappers/`: Code node bodies that read n8n node outputs and call `core.js`.
- `ghost-translate/emit-node.js`: prints `core.js` plus one wrapper, ready to paste into a Code node.
- `ghost-translate/fixtures/posts.json`: published posts used by the tests.
- `workflows/`: n8n templates with `__TOKENS__` instead of private values.
- `ghost-translate/export-workflows.js`: raw n8n JSON to templates. Raw exports never enter this repository.
- `ghost-translate/build-workflows.js`: templates plus `config.json` to importable files in `build/`.

## Commands

Node 24, no npm packages.

```bash
node --test
node ghost-translate/emit-node.js prepare
```

Wrappers: `prepare`, `finish`, `payload`, `snapshot`, `search-doc`, `source-head`, `access-check`, `access-apply`, `search-gate`.

## Rules

- English in code and comments. Comments explain only the why, in one line.
- Code nodes cannot load HTML parser libraries or read `$env`, and carry no secrets. `crypto` works.
- After changing `core.js` or a wrapper, paste the emitted body into the n8n node again, republish the workflow and refresh the templates.
- Compare the deployed Code nodes with the emitted hash before publishing.
- Unpublish and delete act only after the source Ghost confirms them: the webhook has no signature.
- The English site is a database clone of the Spanish one, so every slug already exists there in Spanish. An empty state means "translate everything", never "reuse English".
- No secrets and no nginx config in this repository.
- Commit prefixes `FEATURE:`, `FIX:`, `DEV:`, `DOCS:`. Short subject, no body, no trailers.
