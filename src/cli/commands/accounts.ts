import { getUser, listAccounts } from "../../lib/api.js";
import { withProfile } from "../../lib/auth.js";
import { printTable, spinner, writeResult } from "../../lib/output.js";
import type { Context } from "../context.js";
import { resolveProfile } from "../resolve.js";

export async function runAccounts(ctx: Context): Promise<void> {
  const profile = await resolveProfile(ctx.flags);
  const spin = spinner("Fetching accounts", ctx.json);
  try {
    await withProfile(profile, async (credential) => {
      const [user, accounts] = await Promise.all([
        getUser(credential.token),
        listAccounts(credential.token),
      ]);
      const email = user.result?.email || "unknown";
      if (ctx.json) {
        writeResult({
          command: "accounts",
          profile,
          source: credential.source,
          email,
          accounts: accounts.map((account) => ({
            id: account.id,
            name: account.name,
          })),
        });
        return;
      }
      console.log(`${profile} (${credential.source})  ${email}`);
      printTable(
        ["account", "name"],
        accounts.map((account) => [account.id, account.name]),
      );
    });
  } finally {
    spin.stop();
  }
}
