import assert from "node:assert/strict";
import test from "node:test";
import { ArgError, parseArgs } from "../src/cli/args.js";

test("parseArgs splits commands, booleans, and values", () => {
  const parsed = parseArgs([
    "download",
    "--profile",
    "work",
    "--src-only",
    "--json",
  ]);
  assert.deepEqual(parsed.positional, ["download"]);
  assert.equal(parsed.flags.profile, "work");
  assert.equal(parsed.flags["src-only"], true);
  assert.equal(parsed.flags.json, true);
});

test("parseArgs rejects a flag with no value", () => {
  assert.throws(() => parseArgs(["--out"]), ArgError);
});

test("parseArgs treats -- as the end of flags", () => {
  const parsed = parseArgs(["split", "--", "--weird.js"]);
  assert.deepEqual(parsed.positional, ["split", "--weird.js"]);
  assert.equal(parsed.flags.help, undefined);
});
