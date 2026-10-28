import fs from "node:fs";
import path from "node:path";
import { downloadWorker, getUser } from "../../lib/api.js";
import { withProfile } from "../../lib/auth.js";
import { unwrapWorkerPayload } from "../../lib/multipart.js";
import { spinner, writeResult } from "../../lib/output.js";
import {
  assertFinalDestination,
  expandUserPath,
  safeName,
} from "../../lib/paths.js";
import { maybePrettier } from "../../lib/prettier.js";
import { isTTY, promptChoice, promptLine } from "../../lib/prompt.js";
import { writeInside } from "../../lib/safe-fs.js";
import { splitBundle } from "../../lib/split.js";
import {
  applyTree,
  conflicts,
  makeStage,
  planTree,
  type SyncAction,
  summarize,
} from "../../lib/tree.js";
import { type Context, flag } from "../context.js";
import { resolveAccount, resolveProfile, resolveWorker } from "../resolve.js";

export async function runDownload(ctx: Context): Promise<void> {
  const profile = await resolveProfile(ctx.flags);
  await withProfile(profile, async (credential) => {
    const userPromise = getUser(credential.token);
    const account = await resolveAccount(ctx.flags, credential.token);
    const worker = await resolveWorker(ctx.flags, credential.token, account);
    const user = await userPromise;
    const destination = await chooseDestination(ctx, worker);

    const spin = spinner(`Downloading ${worker}`, ctx.json);
    let payload: Awaited<ReturnType<typeof downloadWorker>>;
    try {
      payload = await downloadWorker(credential.token, account, worker);
    } finally {
      spin.stop();
    }
    if (!payload.ok)
      throw new Error(
        payload.message || `Download failed: HTTP ${payload.status}`,
      );

    const unwrapped = unwrapWorkerPayload(payload.buf);
    const stage = makeStage();
    try {
      const bundlePath = path.join(stage.dir, "bundle.js");
      fs.writeFileSync(bundlePath, unwrapped.script);
      maybePrettier(bundlePath, Boolean(ctx.flags.prettier));

      if (unwrapped.parts.size > 1) {
        for (const [name, body] of unwrapped.parts) {
          writeInside(path.join(stage.dir, "parts"), safeName(name), body);
        }
      }

      let splitInfo: { files: string[]; skipped: number } | null = null;
      if (!ctx.flags["no-split"]) {
        splitInfo = splitBundle(unwrapped.script.toString("utf8"), {
          outDir: path.join(stage.dir, "split"),
          srcOnly: Boolean(ctx.flags["src-only"]),
        });
      }

      const meta = {
        profile,
        source: credential.source,
        email: user.result?.email ?? null,
        account,
        worker,
        downloadedAt: new Date().toISOString(),
        multipart: unwrapped.isMultipart,
        bytes: unwrapped.script.length,
        splitFiles: splitInfo?.files.length ?? 0,
        splitSkipped: splitInfo?.skipped ?? 0,
      };
      fs.writeFileSync(
        path.join(stage.dir, "meta.json"),
        `${JSON.stringify(meta, null, 2)}\n`,
      );

      const plan = planTree(stage.dir, destination);
      const action = await chooseAction(ctx, destination, plan);
      applyTree(stage.dir, destination, plan, action);
      const counts = summarize(plan);

      const result = {
        command: "download",
        profile,
        source: credential.source,
        email: meta.email,
        account,
        worker,
        destination,
        multipart: unwrapped.isMultipart,
        bytes: unwrapped.script.length,
        bundle: path.join(destination, "bundle.js"),
        splitDir: splitInfo ? path.join(destination, "split") : null,
        splitFiles: meta.splitFiles,
        splitSkipped: meta.splitSkipped,
        action,
        files: counts,
      };

      if (ctx.json) {
        writeResult(result);
        return;
      }

      console.log(`Downloaded ${worker}`);
      console.log(`  destination  ${destination}`);
      console.log(`  profile      ${profile} (${credential.source})`);
      console.log(`  account      ${account}`);
      console.log(`  multipart    ${unwrapped.isMultipart ? "yes" : "no"}`);
      console.log(`  bundle       ${result.bundle}`);
      if (result.splitDir) {
        console.log(
          `  split        ${result.splitDir} (${result.splitFiles} files, ${result.splitSkipped} skipped)`,
        );
      }
      console.log(
        `  files        ${counts.added} new, ${counts.different} different, ${counts.same} unchanged`,
      );
      console.log(`  action       ${action}`);
    } finally {
      stage.remove();
    }
  });
}

async function chooseDestination(
  ctx: Context,
  worker: string,
): Promise<string> {
  const folder = safeName(flag(ctx.flags, "name") || worker);
  const root = expandUserPath(
    flag(ctx.flags, "out") || process.env.CFWORKER_OUT || "./recovered",
  );
  const fallback = path.join(root, folder);
  if (flag(ctx.flags, "out") || ctx.json || !isTTY())
    return assertFinalDestination(fallback);

  const entered = await promptLine("Destination", fallback);
  return assertFinalDestination(expandUserPath(entered));
}

async function chooseAction(
  ctx: Context,
  destination: string,
  plan: ReturnType<typeof planTree>,
): Promise<SyncAction> {
  if (ctx.flags.force) return "overwrite";
  const changed = conflicts(plan);
  if (changed.length === 0) return "update";

  const preview = changed
    .slice(0, 20)
    .map((file) => `  ${file.rel}`)
    .join("\n");
  if (ctx.json || !isTTY()) {
    throw new Error(
      `Destination has ${changed.length} different file(s): ${destination}\n${preview}\nPass --force to overwrite.`,
    );
  }

  console.log(
    `\n${destination} has ${changed.length} different file(s):\n${preview}`,
  );
  const choice = await promptChoice("What should happen to existing files?", [
    "overwrite — replace every file",
    "update — write new and changed files",
    "merge — add files that are not there yet",
    "abort",
  ]);
  if (choice.startsWith("overwrite")) return "overwrite";
  if (choice.startsWith("update")) return "update";
  if (choice.startsWith("merge")) return "merge";
  return "abort";
}
