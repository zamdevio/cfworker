# Refactor Plan: cfworker

This is the master plan. Each phase has its own doc with details, checklists, and acceptance criteria.

## Overview

We want to turn `cfworker` into a clean, fast, type-safe CLI that feels like `nodehunter`/`expgov`. Keep behavior compatible where it makes sense, but improve UX significantly.

## Phases

| Phase | Title | Status | Notes |
|---|---|---|---|
| 00 | Audit & Baseline | Done | `maintainer/notes/audit-baseline.md` |
| 01 | Project Structure & TS Migration | Done | `src/`, tsup, tsx, strict tsc |
| 02 | Auth, Profiles & Accounts | Done | v3/v4, cfworker login, `--profile env` |
| 03 | CLI UX, Speed & JSON Mode | Done | lazy commands, tables, `{ ok }` JSON |
| 04 | Download Flow, Destination & Dedup | Done | prompt, temp stage, sha256 |
| 05 | Split/Unwrap, Cross-platform & Safety | Done | path checks, symlink refusal, atomic writes |
| 06 | Tooling, QA, Packaging & Release | Done | tests, biome, knip, madge, CI. Not published |

## Guiding Principles

- **Plan first, change later**: No code changes until we agree on phases
- **Don't hardcode**: Detect everything from env/config/filesystem
- **XDG aware**: Prefer `~/.config/cfworker/` for config/auth, `~/.local/share/cfworker/` only if we need persistent data/cache
- **Cross-platform**: Handle `~`, `./`, `../`, Windows drive paths reasonably
- **Safe by default**: Don't overwrite blindly, compare hashes, stage to temp
- **Fast**: Lazy load, avoid blocking I/O at import time
- **Consistent UX**: Match `nodehunter`/`expgov` style (tables, prompts, `--json`)
- **Type-safe**: Migrate to TS, strict where practical

## Decisions

- [x] ESM only
- [x] tsup, with `bundle: false` so command imports stay lazy
- [x] In-house prompts, tables, and color. No prompt library
- [x] No extra state directory. Dedup hashes the files in the destination
- [x] Non-interactive default is `./recovered/<worker>` from the current directory. A TTY without `--out` asks, using that path as the suggestion
