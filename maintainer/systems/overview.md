# Systems Overview

## Current state

- TypeScript in `src/`, built to `dist/` with tsup (`bundle: false`)
- `bin/cfworker.js` loads `dist/cli/index.js`
- Commands are dynamic imports, so `--help` does not scan profiles or start a network client
- Auth: Wrangler v4 (`~/.config/.wrangler/config`), Wrangler v3 (`~/.wrangler/config`), cfworker (`~/.config/cfworker`), and `--profile env`
- Cloudflare API v4, multipart unwrap, esbuild split
- Download destination prompt, temp staging, sha256 compare before write
- `--json` envelope on every command, including errors

## Layout

```text
src/cli/index.ts          argument parsing and command dispatch
src/cli/commands/         one file per command
src/lib/                  auth, api, multipart, split, paths, safe writes
test/                     node:test via tsx
```

Baseline measurements from before this layout are in `maintainer/notes/audit-baseline.md`.
