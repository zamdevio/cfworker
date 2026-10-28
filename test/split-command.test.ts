import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runSplit } from "../src/cli/commands/split.js";

test("split writes the tree and cleaned bundle outside the temp dir", async () => {
  const root = path.join(process.cwd(), "recovered", "unit-split");
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const source = path.join(root, "in.js");
  fs.writeFileSync(source, "// src/app.ts\nexport const value = 1\n");

  await runSplit({
    flags: { out: path.join(root, "split") },
    positional: [source],
    json: true,
  });

  const splitFile = path.join(root, "split", "src", "app.ts");
  assert.equal(fs.existsSync(splitFile), true);
  assert.match(fs.readFileSync(splitFile, "utf8"), /export const value/);
  assert.match(
    fs.readFileSync(path.join(root, "bundle.js"), "utf8"),
    /src\/app\.ts/,
  );
  fs.rmSync(root, { recursive: true, force: true });
});
