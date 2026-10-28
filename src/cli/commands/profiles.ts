import { listProfiles } from "../../lib/auth.js";
import { printTable, writeResult } from "../../lib/output.js";
import type { Context } from "../context.js";

export async function runProfiles(ctx: Context): Promise<void> {
  const profiles = listProfiles();
  if (ctx.json) {
    writeResult({
      command: "profiles",
      profiles: profiles.map((profile) => ({
        name: profile.name,
        source: profile.source,
        file: profile.file ?? null,
      })),
    });
    return;
  }

  if (profiles.length === 0) {
    console.log("No credentials found.");
    console.log("- Run: wrangler login");
    console.log("- Run: cfworker login");
    console.log("- Or set CLOUDFLARE_API_TOKEN and pass --profile env");
    return;
  }

  printTable(
    ["name", "source", "file"],
    profiles.map((profile) => [
      profile.name,
      profile.source,
      profile.file ?? "-",
    ]),
  );
}
