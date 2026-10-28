import { listWorkers } from "../../lib/api.js";
import { withProfile } from "../../lib/auth.js";
import { spinner, writeResult } from "../../lib/output.js";
import type { Context } from "../context.js";
import { resolveAccount, resolveProfile } from "../resolve.js";

export async function runList(ctx: Context): Promise<void> {
  const profile = await resolveProfile(ctx.flags);
  const spin = spinner("Fetching workers", ctx.json);
  try {
    await withProfile(profile, async (credential) => {
      const account = await resolveAccount(ctx.flags, credential.token);
      const workers = await listWorkers(credential.token, account);
      if (ctx.json) {
        writeResult({
          command: "list",
          profile,
          source: credential.source,
          account,
          workers,
        });
        return;
      }
      console.log(`${workers.length} workers in ${account}`);
      for (const worker of workers) console.log(worker);
    });
  } finally {
    spin.stop();
  }
}
