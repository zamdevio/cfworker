# @zamdevio/cfworker

Download Cloudflare Workers from Wrangler OAuth profiles, strip multipart wrappers, and split esbuild bundles into a readable file tree.

## Install

Global (recommended):

```bash
npm i -g @zamdevio/cfworker
# or
pnpm add -g @zamdevio/cfworker
# or
yarn global add @zamdevio/cfworker
```

Local/dev:

```bash
pnpm i
pnpm link --global  # or npm link
```

## Prerequisites

You need an authenticated Wrangler profile with an OAuth token. Run `npx wrangler login` to create one. Tokens are read from:

```text
~/.wrangler/config/<profile>.toml  (or $WRANGLER_CONFIG_DIR)
```

## Usage

```bash
# List profiles
cfworker profiles

# List accounts for a profile
cfworker accounts --profile <name>

# List workers in an account
cfworker list --profile <name> --account <account_id>

# Download a worker and split into a file tree
cfworker download --profile <name> --account <account_id> --worker <worker_name>

# Options
cfworker download --profile <name> --account <account_id> --worker <worker_name> \
  --src-only      # skip node_modules paths when splitting
  --no-split      # keep raw bundle only
  --prettier      # run prettier --write on cleaned bundle
  --out ./out     # custom output root
  --name custom   # override output folder name
  --json          # machine-readable output

# Split an existing bundle
cfworker split ./path/to/bundle.js --out ./recovered/worker/split --src-only
```

If stdin is a TTY and flags are missing, you'll be prompted interactively. In non-TTY environments, pass all required flags.

## Output structure

```text
recovered/<worker>/
  bundle.js    # cleaned script (multipart wrappers stripped)
  meta.json    # metadata about the download
  parts/       # extra multipart modules (if present)
  split/       # files carved from `// path/to/file.ext` markers
    _preamble.js  # esbuild preamble (if any)
```

Notes:
- On a 404/worker-not-found, `download` errors cleanly and does **not** create `recovered/<name>/`.
- Multipart responses from Cloudflare are detected and unwrapped automatically.
- The splitter normalizes common esbuild/pnpm paths and can drop `node_modules` with `--src-only`.

## Environment variables

- `CFWORKER_OUT` — default output root (default: `./recovered`)
- `WRANGLER_CONFIG_DIR` — override Wrangler config directory (default: `~/.wrangler/config`)

## License

MIT © zamdevio
