# Audit baseline

Measured on Node v24.22.1, Linux, before the TypeScript rewrite. Command: `node bin/cfworker.js`.

## Startup

| Command | Time |
|---|---|
| `--help` (cold) | 2.23s |
| `--help` (next two runs) | 1.41s, 1.39s |
| `profiles` | 0.03s |

`--help` is slow because it calls `hasWrangler()`, which runs `wrangler --version` synchronously while printing usage. `profiles` does not, and it returns immediately.

## Import graph

`bin/cfworker.js` statically imports `lib/auth.js`, `lib/api.js`, `lib/multipart.js`, and `lib/split.js`.

Nothing in those modules touches the filesystem or network at import time. Sync work starts when a command runs: profile scans, prompts, `fetch`, bundle writes.

## Command flow

1. `profiles` / `whoami` — scan Wrangler and `~/.config/cfworker` toml files.
2. `login` / `auth` — prompt for a token and write `~/.config/cfworker/<profile>.toml` at mode `0600`. No API check.
3. `accounts` — token, `GET /user`, `GET /accounts`.
4. `list` — token, `GET /user`, accounts, `GET /accounts/:id/workers/scripts`.
5. `download` — resolve profile, account, and worker, then write under the output root. A 404 does not create the folder.
6. `split` — unwrap multipart if present, write `bundle.js` beside the split directory, carve `// path` markers.

Missing flags prompt only when stdin and stdout are TTYs. One profile, account, or worker is auto-selected.

## JSON gaps

- `profiles --json` prints a bare string array.
- Errors stay plain text when `--json` is set.
- `split` prints human lines before the JSON payload.
- There is no shared `{ ok, command, ... }` / `{ ok: false, error }` envelope.

## Other findings

- Default output is `<package-root>/recovered`, from `import.meta.url`. A global install writes into the package directory. The README describes `./recovered` from the working directory.
- `configDir()` returns the first Wrangler directory that exists, so v3 and v4 are not both scanned when both are present.
- `listProfiles()` drops the source, so a cfworker profile and a Wrangler profile with the same name collapse into one name.
- Env tokens (`CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN`, `CFWORKER_TOKEN`) win for `default` / `env`, then act as a fallback for any missing profile file.
- Split already rejects absolute paths and `..` after `path.posix.normalize`, and it rewrites pnpm store paths to `node_modules/<pkg>/...`. Writes are not atomic, and a symlink directory inside the output folder would be followed.
- No runtime dependencies. No tests, typecheck, or lint.

## Decisions locked for the rewrite

The master plan left these open. These are the choices the implementation uses:

- ESM only.
- Build with tsup (`bundle: false` so command modules stay lazy). Dev runs through tsx.
- In-house prompts, tables, and color. No prompt library. Color turns off when `NO_COLOR` is set or stdout is not a TTY.
- No extra state directory. Dedup hashes the destination files directly.
- Non-interactive downloads go to `./recovered/<worker>` from the current working directory (`CFWORKER_OUT` overrides the root). A TTY with no `--out` asks, using that path as the default.
- `--json` is non-interactive and uses the default destination unless `--out` is set.
- Existing different files fail the run unless `--force` is set or a TTY chooses overwrite, update, or merge. `meta.json` is refreshed every time and is not a conflict.
- Do not publish from this change. Package metadata is ready for a later 2.0.0 publish.
