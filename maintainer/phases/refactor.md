# Refactor Plan: cfworker

This is the master plan. Each phase has its own doc with details, checklists, and acceptance criteria.

## Overview

We want to turn `cfworker` into a clean, fast, type-safe CLI that feels like `nodehunter`/`expgov`. Keep behavior compatible where it makes sense, but improve UX significantly.

## Phases

| Phase | Title | Status | Notes |
|---|---|---|---|
| 00 | Audit & Baseline | Planned | Inventory current state, measure startup time, map flows |
| 01 | Project Structure & TS Migration | Planned | Convert to TS, add tsconfig, build tooling (tsup/tsx), paths |
| 02 | Auth, Profiles & Accounts | Planned | Support wrangler v3/v4, `cfworker login`, env tokens, profile/account resolution |
| 03 | CLI UX, Speed & JSON Mode | Planned | Lazy imports, faster startup, prompts/tables/colors, unified `--json` |
| 04 | Download Flow, Destination & Dedup | Planned | Interactive destination picker, path expansion, temp staging, hash comparison vs existing |
| 05 | Split/Unwrap, Cross-platform & Safety | Planned | Robust multipart/split, path sanitization, cross-platform paths, safer writes |
| 06 | Tooling, QA, Packaging & Release | Planned | knip, madge, typecheck, lint, tests (if any), npm publish prep |

## Guiding Principles

- **Plan first, change later**: No code changes until we agree on phases
- **Don't hardcode**: Detect everything from env/config/filesystem
- **XDG aware**: Prefer `~/.config/cfworker/` for config/auth, `~/.local/share/cfworker/` only if we need persistent data/cache
- **Cross-platform**: Handle `~`, `./`, `../`, Windows drive paths reasonably
- **Safe by default**: Don't overwrite blindly, compare hashes, stage to temp
- **Fast**: Lazy load, avoid blocking I/O at import time
- **Consistent UX**: Match `nodehunter`/`expgov` style (tables, prompts, `--json`)
- **Type-safe**: Migrate to TS, strict where practical

## Immediate Questions to Decide

- [ ] Keep ESM only or dual? (lean ESM)
- [ ] Use `tsup` for build or `tsc`? (lean tsup like modern CLIs)
- [ ] Prompt library: in-house minimal vs `@clack/prompts`? (match existing style)
- [ ] Where to store non-token state? (`~/.local/state/cfworker/` vs none)
- [ ] Default download dir behavior: `./<worker>` vs `./recovered/<worker>` vs ask every time
