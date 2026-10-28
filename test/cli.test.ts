import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function run(args: string[], extra: NodeJS.ProcessEnv = {}) {
  const env = { ...process.env, ...extra };
  delete env.CLOUDFLARE_API_TOKEN;
  delete env.CF_API_TOKEN;
  delete env.CFWORKER_TOKEN;
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "src/cli/index.ts", ...args],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env,
    },
  );
}

test("help exits 0 without requiring a build", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /cfworker — download and recover/);
});

test("unknown commands are JSON errors when --json is set", () => {
  const result = run(["nope", "--json"]);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: false,
    error: "Unknown command: nope",
  });
});

test("profiles --json lists an empty isolated config", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-cli-"));
  const result = run(["profiles", "--json"], {
    CFWORKER_CONFIG_DIR: root,
    WRANGLER_CONFIG_DIR: root,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    command: "profiles",
    profiles: [],
  });
});
