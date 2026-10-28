import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeInside } from "../src/lib/safe-fs.js";

test("writes replace a symlink instead of following it outside the root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-root-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-out-"));
  const secret = path.join(outside, "secret.txt");
  fs.writeFileSync(secret, "secret");
  fs.symlinkSync(secret, path.join(root, "bundle.js"));

  writeInside(root, "bundle.js", "safe");

  assert.equal(fs.readFileSync(secret, "utf8"), "secret");
  assert.equal(fs.readFileSync(path.join(root, "bundle.js"), "utf8"), "safe");
  assert.equal(
    fs.lstatSync(path.join(root, "bundle.js")).isSymbolicLink(),
    false,
  );
});

test("a symlinked directory cannot receive files outside the root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-root-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-out-"));
  fs.symlinkSync(outside, path.join(root, "split"));
  assert.throws(() => writeInside(root, "split/file.js", "x"), /outside/);
  assert.equal(fs.existsSync(path.join(outside, "file.js")), false);
});
