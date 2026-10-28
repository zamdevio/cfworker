# Systems Overview

## Current State (Pre-Refactor)
- Pure ESM JS in `bin/` + `lib/`
- Auth: reads wrangler profiles from `~/.config/.wrangler/config/` (v4) and `~/.wrangler/config/` (v3), plus `~/.config/cfworker/`, plus env vars
- API: calls Cloudflare API v4
- Multipart unwrap + esbuild bundle splitting
- Interactive prompts for missing args

## Target State
- TypeScript source in `src/`
- Lazy-loaded CLI
- Faster startup
- Better UX matching nodehunter/expgov
- Smarter download flow with destination picker + dedup/hashing
- Cross-platform paths
- Unified `--json`
