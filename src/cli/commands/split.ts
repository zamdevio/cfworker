import fs from "node:fs";
import path from "node:path";
import { unwrapWorkerPayload } from "../../lib/multipart.js";
import { writeResult } from "../../lib/output.js";
import { assertFinalDestination, expandUserPath } from "../../lib/paths.js";
import { maybePrettier } from "../../lib/prettier.js";
import { writeInside } from "../../lib/safe-fs.js";
import { splitBundle } from "../../lib/split.js";
import { makeStage, replaceDir } from "../../lib/tree.js";
import { type Context, flag } from "../context.js";

export async function runSplit(ctx: Context): Promise<void> {
  const file = ctx.positional[0];
  if (!file) throw new Error("split requires a <file.js> argument");

  const abs = expandUserPath(file);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);

  const source = fs.readFileSync(abs);
  const unwrapped = unwrapWorkerPayload(source);
  const outDir = assertFinalDestination(
    expandUserPath(
      flag(ctx.flags, "out") || path.join(path.dirname(abs), "split"),
    ),
  );

  const stage = makeStage();
  try {
    const info = splitBundle(unwrapped.script.toString("utf8"), {
      outDir: stage.dir,
      srcOnly: Boolean(ctx.flags["src-only"]),
    });
    replaceDir(stage.dir, outDir);

    const bundlePath = path.join(path.dirname(outDir), "bundle.js");
    writeInside(path.dirname(outDir), "bundle.js", unwrapped.script);
    maybePrettier(bundlePath, Boolean(ctx.flags.prettier));

    const files = info.files.map((written) =>
      path.join(outDir, path.relative(stage.dir, written)),
    );
    if (ctx.json) {
      writeResult({
        command: "split",
        outDir,
        bundle: bundlePath,
        multipart: unwrapped.isMultipart,
        files,
        skipped: info.skipped,
      });
      return;
    }

    console.log(
      unwrapped.isMultipart
        ? `Stripped multipart → ${bundlePath}`
        : `Bundle → ${bundlePath}`,
    );
    console.log(
      `Split ${files.length} files → ${outDir} (${info.skipped} skipped)`,
    );
  } finally {
    stage.remove();
  }
}
