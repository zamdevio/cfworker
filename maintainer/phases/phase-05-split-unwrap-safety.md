# Phase 05 - Split/Unwrap, Cross-platform & Safety

Status: Done. Boundary plus Content-Disposition, contained writes, symlink refusal.

## Goals
- Harden multipart/split
- Path safety
- Cross-platform

## Tasks
- [ ] Better multipart boundary detection
- [ ] Improved split heuristics
- [ ] Path traversal protection (already started)
- [ ] pnpm path normalization
- [ ] Cross-platform separators
- [ ] Symlink safety considerations
- [ ] Atomic writes
- [ ] Cleanup on errors

## Acceptance
- No path escapes
- Handles different bundle formats
- Safe on all platforms
