# Phase 02 - Auth, Profiles & Accounts

Status: Done. Resolution rules are in `maintainer/systems/auth.md`.

## Goals
- Robust profile/account detection
- Support both flows cleanly
- Clear UX

## Tasks
- [ ] Detect wrangler v3 (`~/.wrangler/config`) and v4 (`~/.config/.wrangler/config`) - already started
- [ ] Support `~/.config/cfworker/` for built-in login
- [ ] Env vars: `CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN`, `CFWORKER_TOKEN`
- [ ] `cfworker login` improvements (validate token, test with API)
- [ ] `profiles` command: show source (wrangler/cfworker/env)
- [ ] `accounts` command: better prompting/tables
- [ ] Handle no profiles gracefully with suggestions

## Acceptance
- Finds profiles from both wrangler locations
- Built-in login works and is discoverable
- `--json` works for profiles/accounts
- Clear errors
