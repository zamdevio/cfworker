<div align="center">
  <img src="./assets/cfworker.svg" width="72" height="72" alt="cfworker logo" />

  <h1>cfworker</h1>

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
  [![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![pnpm](https://img.shields.io/badge/pnpm-package%20manager-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

  <p><strong>Download · unwrap · split</strong></p>
  <p>
    Pull Cloudflare Workers from Wrangler profiles, strip multipart wrappers, and split esbuild bundles into a file tree.
  </p>
  <p>
    <a href="https://github.com/zamdevio/cfworker">GitHub</a> ·
    <a href="https://www.npmjs.com/package/@zamdevio/cfworker">npm</a> ·
    <a href="#quick-start">Quick start</a>
  </p>
</div>

---

Recover a Worker you already shipped. Credentials come from Wrangler or `cfworker login`. A download is staged first, and files that differ are not overwritten unless you choose that.

| Surface | URL | Role |
|---------|-----|------|
| **npm** | [@zamdevio/cfworker](https://www.npmjs.com/package/@zamdevio/cfworker) | Global `cfworker` command |
| **GitHub** | [github.com/zamdevio/cfworker](https://github.com/zamdevio/cfworker) | Source, issues, changelog |

## Install

Requires **Node.js >= 20**.

```bash
# global CLI
npm install -g @zamdevio/cfworker
# or: pnpm add -g @zamdevio/cfworker
```

```bash
# on-demand without a global install
npx @zamdevio/cfworker --help
pnpm dlx @zamdevio/cfworker --help
```

## Quick start

```bash
cfworker profiles
cfworker accounts --profile zamdevio
cfworker list --profile zamdevio --account <account_id>
cfworker download --profile zamdevio --account <account_id> --worker <name> --src-only
cfworker split ./bundle.js --out ./recovered/<name>/split --src-only
```

JSON for scripts:

```bash
cfworker profiles --json
cfworker list --profile zamdevio --account <account_id> --json
```

Bare `cfworker` prints help. Missing flags prompt only when stdin and stdout are TTYs. `--json` never prompts.

## Commands

| Command | Purpose |
|---------|---------|
| `profiles` | List Wrangler, cfworker, and env credentials, with the source |
| `login` | Check a token against the API and save `~/.config/cfworker/<profile>.toml` |
| `accounts` | List Cloudflare accounts for a profile |
| `list` | List Worker scripts in an account |
| `download` | Download, unwrap, and split one Worker |
| `split` | Split a bundle you already have on disk |

`whoami` is `profiles`. `auth` is `login`.

Download flags: `--out`, `--name`, `--src-only`, `--no-split`, `--prettier`, `--force`, `--json`.

With no `--out`, a TTY asks for a destination. The suggestion is `./recovered/<worker>` from the current directory (`CFWORKER_OUT` changes the root). `--out` is that root, and the worker folder is created inside it.

If the folder already has different files, a TTY can overwrite, update, or merge. Otherwise the command stops until you pass `--force`. Identical files stay put. `meta.json` is refreshed every time and is not a conflict.

## Output

```text
recovered/<worker>/
  bundle.js
  meta.json
  parts/            # extra multipart modules, when the upload had more than one
  split/
    _preamble.js    # esbuild preamble, when the bundle has one
```

A missing Worker is an error and does not create the folder. The body is written in a temp directory first, then moved into the destination. A temp directory is rejected as the final path.

## Auth

Profiles are read from:

1. `~/.config/cfworker/<name>.toml` after `cfworker login`
2. Wrangler v4, `~/.config/.wrangler/config/<name>.toml`
3. Wrangler v3, `~/.wrangler/config/<name>.toml`

`--profile env` uses `CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN`, or `CFWORKER_TOKEN`. If that is the only credential, it is selected for you. An env token does not replace a named profile that has a file.

Wrangler access tokens expire. cfworker exchanges the stored refresh token and writes the new tokens back to that Wrangler profile, the same way `wrangler whoami` does. One rejected call refreshes and retries once.

## JSON

Success goes to stdout:

```json
{ "ok": true, "command": "profiles", "profiles": [] }
```

Failure also goes to stdout and exits 1:

```json
{ "ok": false, "error": "..." }
```

## Environment

| Variable | Role |
|----------|------|
| `CFWORKER_OUT` | Download root. Default `./recovered` from the working directory |
| `CFWORKER_CONFIG_DIR` | cfworker profile directory |
| `WRANGLER_CONFIG_DIR` | Wrangler config directory. Several paths use the platform path delimiter |
| `CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN`, `CFWORKER_TOKEN` | Token for `--profile env` |
| `WRANGLER_CLIENT_ID`, `WRANGLER_TOKEN_URL`, `WRANGLER_AUTH_DOMAIN` | Overrides for the OAuth refresh request |
| `NO_COLOR` | Turn color off |

## Development

```bash
pnpm install
pnpm cfworker --help    # runs TypeScript through tsx
pnpm typecheck
pnpm test
pnpm lint
pnpm build              # dist/ for the published bin
```

The `cfworker` binary on npm runs `dist/`. `prepublishOnly` builds it.

## License

MIT — see [LICENSE](./LICENSE).
