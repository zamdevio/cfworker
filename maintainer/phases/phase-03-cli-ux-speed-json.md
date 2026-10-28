# Phase 03 - CLI UX, Speed & JSON Mode

Status: Planned

## Goals
- Faster startup
- Better UI like nodehunter/expgov
- Unified JSON

## Speed
- [ ] Lazy imports per command
- [ ] Defer readline/prompts until needed
- [ ] Avoid sync fs on module load
- [ ] Cache where safe

## UI
- [ ] Consistent tables
- [ ] Spinners for network calls
- [ ] Better prompts (clack-style or in-house)
- [ ] Colors with `NO_COLOR` support
- [ ] Help formatting

## JSON
- [ ] `--json` on all commands
- [ ] Errors as JSON when `--json`
- [ ] Stable schema

## Acceptance
- Noticeably faster startup
- Consistent UX
- Machine readable everywhere
