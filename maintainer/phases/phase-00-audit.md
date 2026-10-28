# Phase 00 - Audit & Baseline

Status: Done. See `maintainer/notes/audit-baseline.md`.

## Goals
- Document current architecture
- Measure startup time
- Map command flows
- Identify bottlenecks

## Inventory
- [ ] Entry point: `bin/cfworker.js`
- [ ] Libs: `lib/auth.js`, `lib/api.js`, `lib/multipart.js`, `lib/split.js`
- [ ] Config locations: wrangler v3/v4 + cfworker own + env
- [ ] Dependencies (runtime/dev)

## Baseline Measurements
- [ ] `time cfworker --help`
- [ ] `time cfworker profiles`
- [ ] `time cfworker accounts --profile ...` (with auth)
- [ ] Cold start vs warm

## Findings to Capture
- Current import graph
- Sync I/O on module load
- Prompting behavior
- JSON support gaps

## Deliverables
- `maintainer/notes/audit-baseline.md` with findings + numbers
