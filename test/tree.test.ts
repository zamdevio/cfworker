import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyTree, conflicts, planTree } from "../src/lib/tree.js";

test("planTree classifies new, same, and different files", () => {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-stage-"));
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-dest-"));
  fs.writeFileSync(path.join(stage, "same.js"), "same\n");
  fs.writeFileSync(path.join(dest, "same.js"), "same\n");
  fs.writeFileSync(path.join(stage, "changed.js"), "new\n");
  fs.writeFileSync(path.join(dest, "changed.js"), "old\n");
  fs.writeFileSync(path.join(stage, "added.js"), "added\n");
  fs.mkdirSync(path.join(stage, "split"));
  fs.writeFileSync(path.join(stage, "split", "a.js"), "a\n");

  const plan = planTree(stage, dest);
  const byRel = new Map(plan.map((file) => [file.rel, file.status]));
  assert.equal(byRel.get("same.js"), "same");
  assert.equal(byRel.get("changed.js"), "different");
  assert.equal(byRel.get("added.js"), "new");
  assert.equal(byRel.get("split/a.js"), "new");
  assert.equal(
    conflicts(plan)
      .map((file) => file.rel)
      .join(","),
    "changed.js",
  );
});

test("merge writes new files and leaves different ones alone", () => {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-stage-"));
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-dest-"));
  fs.writeFileSync(path.join(stage, "changed.js"), "new\n");
  fs.writeFileSync(path.join(dest, "changed.js"), "old\n");
  fs.writeFileSync(path.join(stage, "added.js"), "added\n");
  fs.writeFileSync(path.join(stage, "meta.json"), "{}\n");

  const plan = planTree(stage, dest);
  applyTree(stage, dest, plan, "merge");
  assert.equal(fs.readFileSync(path.join(dest, "changed.js"), "utf8"), "old\n");
  assert.equal(fs.readFileSync(path.join(dest, "added.js"), "utf8"), "added\n");
  assert.equal(fs.readFileSync(path.join(dest, "meta.json"), "utf8"), "{}\n");
});
