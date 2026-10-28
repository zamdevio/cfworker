# Phase 06 - Tooling, QA, Packaging & Release

Status: Done except publish. Tests, Biome, knip, madge, CI, and `pnpm pack` are in place. `npm publish` was not run.

## Goals
- Code hygiene
- Packaging
- Release ready

## Tooling
- [ ] `knip` - find unused deps/exports
- [ ] `madge` - circular deps / graph
- [ ] `typecheck` script
- [ ] Linting (biome/eslint) if desired
- [ ] CI friendly

## Packaging
- [ ] Update `files` field
- [ ] Ensure bin points correctly
- [ ] Test `npm pack` / `pnpm pack`
- [ ] Test global install from tarball and local dir
- [ ] README up to date

## QA
- [ ] Test all commands
- [ ] Test wrangler v3/v4 detection
- [ ] Test built-in login
- [ ] Test download flow with new UX
- [ ] Cross-platform smoke tests

## Release
- [ ] Version bump
- [ ] Changelog
- [ ] Publish to npm as `@zamdevio/cfworker`

## Acceptance
- Clean knip/madge
- Typecheck passes
- Installs cleanly
- Ready to publish
