export function printHelp(): void {
  process.stdout.write(`cfworker — download and recover Cloudflare Workers

Usage:
  cfworker profiles
  cfworker login      [--profile NAME] [--token TOKEN]
  cfworker accounts   [--profile NAME]
  cfworker list       [--profile NAME] [--account ID]
  cfworker download   [--profile NAME] [--account ID] [--worker NAME] [options]
  cfworker split      <file.js> [--out DIR] [options]

Auth:
  Profiles are read from Wrangler v4 (~/.config/.wrangler/config),
  Wrangler v3 (~/.wrangler/config), and cfworker (~/.config/cfworker).
  --profile env uses CLOUDFLARE_API_TOKEN, CF_API_TOKEN, or CFWORKER_TOKEN.

Download options:
  --out DIR          Output root. The worker folder is created inside it.
  --name NAME        Folder name (default: worker name)
  --no-split         Keep the bundle only
  --src-only         Skip node_modules paths when splitting
  --prettier         Run prettier --write on the saved bundle
  --force            Overwrite files that differ
  --json             Machine-readable output

  With no --out, a TTY asks for the destination. The default is
  ./recovered/<worker> from the current directory (or $CFWORKER_OUT).
  --json does not prompt. If the destination has different files, the
  command stops unless --force is set or you choose an action in a TTY.

Split options:
  --out DIR          Split directory (default: ./split next to the file)
  --src-only         Skip node_modules paths
  --prettier         Format the cleaned bundle
  --json             Machine-readable output

JSON:
  Success prints { "ok": true, "command": "...", ... } to stdout.
  Failure prints { "ok": false, "error": "..." } and exits 1.

Examples:
  cfworker login --profile zamdevio
  cfworker accounts --profile zamdevio
  cfworker download --profile zamdevio --account abc123 --worker tiktok --src-only
  cfworker split ./bundle.js --out ./recovered/tiktok/split --src-only
`);
}
