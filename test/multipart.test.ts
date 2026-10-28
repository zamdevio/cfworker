import assert from "node:assert/strict";
import test from "node:test";
import { unwrapWorkerPayload } from "../src/lib/multipart.js";

test("plain scripts stay intact", () => {
  const result = unwrapWorkerPayload(Buffer.from("console.log(1)\n"));
  assert.equal(result.isMultipart, false);
  assert.equal(result.script.toString("utf8"), "console.log(1)\n");
  assert.equal(result.parts.size, 0);
});

test("a leading -- without multipart headers is not unwrapped", () => {
  const result = unwrapWorkerPayload(
    Buffer.from("--not a boundary\nconsole.log(1)\n"),
  );
  assert.equal(result.isMultipart, false);
  assert.match(result.script.toString("utf8"), /console\.log/);
});

test("multipart bodies yield the primary script and extra parts", () => {
  const boundary = "----cfworkerboundary";
  const raw = [
    boundary,
    'Content-Disposition: form-data; name="util.js"',
    "",
    "export const util = 1",
    boundary,
    'Content-Disposition: form-data; name="index.js"',
    "",
    'console.log("hi")',
    `${boundary}--`,
    "",
  ].join("\r\n");

  const result = unwrapWorkerPayload(Buffer.from(raw));
  assert.equal(result.isMultipart, true);
  assert.equal(result.script.toString("utf8"), 'console.log("hi")');
  assert.equal(
    result.parts.get("util.js")?.toString("utf8"),
    "export const util = 1",
  );
});
