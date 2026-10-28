# cfworker maintainer docs

This folder holds planning, architecture, and refactor docs for `@zamdevio/cfworker`. 

No runtime code lives here. Treat this as the source of truth for upcoming changes before implementation.

## Quick links

- [Phases / Refactor Plan](./phases/refactor.md)
- [Phase 00 - Audit & Baseline](./phases/phase-00-audit.md)
- [Phase 01 - Project Structure & TS Migration](./phases/phase-01-structure-ts.md)
- [Phase 02 - Auth, Profiles & Accounts](./phases/phase-02-auth-profiles-accounts.md)
- [Phase 03 - CLI UX, Speed & JSON Mode](./phases/phase-03-cli-ux-speed-json.md)
- [Phase 04 - Download Flow, Destination & Dedup](./phases/phase-04-download-dest-dedup.md)
- [Phase 05 - Split/Unwrap, Cross-platform & Safety](./phases/phase-05-split-unwrap-safety.md)
- [Phase 06 - Tooling, QA, Packaging & Release](./phases/phase-06-tooling-qa-release.md)

## Goals

- Match the UI/ergonomics of `nodehunter` and `expgov`
- Migrate to TypeScript with proper typechecking
- Add `knip`, `madge` for hygiene/dependency graphs
- Faster startup (lazy imports, less sync I/O)
- Better auth: support both Wrangler login and built-in `cfworker login`, detect profiles/accounts correctly across wrangler v3/v4
- Smarter download: ask for destination path, support `~/`, Windows/mac/Linux paths, stage in temp, compare existing files by hash before overwriting
- Consistent `--json` output everywhere
- Cross-platform safe

## Structure

```
maintainer/
├── README.md
├── phases/        # Planning docs per phase
├── shipped/       # Completed work, PR notes, changelog entries
├── systems/       # Architecture, decisions, patterns, how things work
├── adr/           # Architecture Decision Records
└── notes/         # Scratch notes, research, findings
```

- `phases/` - Roadmap and phase breakdowns (plan first)
- `shipped/` - What’s been done, releases, summaries
- `systems/` - Deeper system design docs (auth flow, download flow, etc.)
- `adr/` - ADRs for significant decisions
- `notes/` - Working notes
