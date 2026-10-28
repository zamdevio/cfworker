# Phase 01 - Project Structure & TS Migration

Status: Planned

## Goals
- Migrate to TypeScript
- Set up build/dev tooling like nodehunter/expgov
- Keep bin working

## Proposed Structure
```
src/
  cli/
    index.ts
    commands/
  lib/
    auth.ts
    api.ts
    multipart.ts
    split.ts
    paths.ts
    prompts.ts
    utils.ts
  types/
bin/
  cfworker.js  (or generated)
dist/ (build output)
```

## Tooling
- [ ] `tsconfig.json` (strict-ish, ESM)
- [ ] `tsx` for dev
- [ ] `tsup` for build (or tsc) - prefer tsup
- [ ] `typescript` as devDep
- [ ] Update `package.json` scripts: `dev`, `build`, `typecheck`

## Tasks
- [ ] Create src/ and move logic
- [ ] Add types for CF API responses
- [ ] Generate bin that runs built output
- [ ] Ensure `pnpm i -g .` still works
- [ ] Add `types/` if needed

## Acceptance
- `pnpm typecheck` passes
- `pnpm build` produces working CLI
- `cfworker --help` works from built output
