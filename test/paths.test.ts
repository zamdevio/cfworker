import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertFinalDestination,
  expandUserPath,
  safeName,
} from "../src/lib/paths.js";

test("expandUserPath resolves ~ and relative paths", () => {
  assert.equal(expandUserPath("~"), os.homedir());
  assert.equal(expandUserPath("~/workers"), path.join(os.homedir(), "workers"));
  assert.equal(
    expandUserPath("./recovered", "/work"),
    path.resolve("/work", "recovered"),
  );
  assert.equal(
    expandUserPath("C:\\workers\\app"),
    path.win32.normalize("C:\\workers\\app"),
  );
});

test("final destinations cannot live in the temp directory", () => {
  assert.throws(() => assertFinalDestination(os.tmpdir()), /temp directory/);
  assert.throws(
    () => assertFinalDestination(path.join(os.tmpdir(), "worker")),
    /temp directory/,
  );
  const kept = path.join(process.cwd(), "recovered", "worker");
  assert.equal(assertFinalDestination(kept), path.resolve(kept));
});

test("safeName keeps folder names inside one path segment", () => {
  assert.equal(safeName("my worker"), "my_worker");
  assert.throws(() => safeName(".."));
});
