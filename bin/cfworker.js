#!/usr/bin/env node
import { existsSync } from "node:fs";

const dist = new URL("../dist/cli/index.js", import.meta.url);
if (!existsSync(dist)) {
  console.error("cfworker: build output missing. Run `pnpm build` first.");
  process.exit(1);
}

await import(dist.href);
