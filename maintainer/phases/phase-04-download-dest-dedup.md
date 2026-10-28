# Phase 04 - Download Flow, Destination & Dedup

Status: Planned

## Goals
- Smarter destination selection
- Safety checks
- Cross-platform paths

## Flow
1. Resolve profile/account/worker
2. Ask for destination interactively (TTY) with smart default
   - Suggest `./<worker>` or based on context
   - Allow `~/`, relative, absolute
   - Handle Windows paths
3. Check if destination exists
   - If exists: compare files we would create vs existing by hash (sha256)
   - Show summary: same / different / new
   - Ask: overwrite? skip same? merge?
4. Stage to temp dir first
5. Write to final destination atomically where possible

## Features
- [ ] `--out` still supported for non-interactive
- [ ] Path expansion (`expandTilde`, normalize)
- [ ] Hash comparison (fast, use existing hashes where possible)
- [ ] `--json` output with plan/details
- [ ] Don't install to /tmp as final destination

## Acceptance
- User chooses destination
- Existing files detected and hashed
- Staged safely
- Works cross-platform
