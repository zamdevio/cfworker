import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { sanitizeRelPath, splitBundle } from "../src/lib/split.js";

test("sanitizeRelPath drops escapes and rewrites pnpm paths", () => {
  assert.equal(sanitizeRelPath("src/../../outside.js"), null);
  assert.equal(sanitizeRelPath("/etc/passwd.js"), null);
  assert.equal(sanitizeRelPath("C:/Windows/system.js"), null);
  assert.equal(
    sanitizeRelPath(
      "../../node_modules/.pnpm/left-pad@1.3.0/node_modules/left-pad/index.js",
    ),
    "node_modules/left-pad/index.js",
  );
});

test("splitBundle writes contained files and skips escapes", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-split-"));
  const source = [
    "const preamble = 1;",
    "// src/../../outside.js",
    "nope",
    "// ../../node_modules/.pnpm/left-pad@1.3.0/node_modules/left-pad/index.js",
    "module.exports = 1",
    "// src/app.ts",
    "export const value = 1",
    "",
  ].join("\n");

  const result = splitBundle(source, { outDir: out, srcOnly: true });
  assert.equal(
    fs
      .readFileSync(path.join(out, "src", "app.ts"), "utf8")
      .includes("export const value"),
    true,
  );
  assert.equal(fs.existsSync(path.join(out, "outside.js")), false);
  assert.equal(
    fs.existsSync(path.join(out, "node_modules", "left-pad", "index.js")),
    false,
  );
  assert.equal(result.skipped, 2);
  assert.equal(fs.existsSync(path.join(out, "_preamble.js")), true);
});
