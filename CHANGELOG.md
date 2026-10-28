# Changelog

## 2.0.0

TypeScript CLI. Behavior that scripts may depend on has changed.

- Source lives in `src/` and builds to `dist/` with tsup. `cfworker --help` no longer shells out to Wrangler (about 1.4s before, about 0.02s after).
- `--json` on every command uses `{ "ok": true, ... }` and `{ "ok": false, "error" }`.
- Profiles report their source: `cfworker`, `wrangler`, or `env`. Wrangler v3 and v4 directories are both scanned.
- `cfworker login` calls the API before saving a token.
- `--profile env` is the environment token. A named profile with a file is not replaced by `CLOUDFLARE_API_TOKEN`.
- Default download directory is `./recovered/<worker>` from the current working directory. A TTY can pick another path. Existing files are hashed and are not overwritten unless you choose an action or pass `--force`.
- Split and download writes stay inside the destination, replace symlinks instead of following them, and stage through a temp directory first.
