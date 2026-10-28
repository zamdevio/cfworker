import { listAccounts, listWorkers } from "../lib/api.js";
import { listProfiles } from "../lib/auth.js";
import { promptChoice } from "../lib/prompt.js";
import { type Context, flag } from "./context.js";

export async function resolveProfile(flags: Context["flags"]): Promise<string> {
  const requested = flag(flags, "profile");
  if (requested) return requested;

  const profiles = listProfiles();
  if (profiles.length === 0) {
    throw new Error(
      "No credentials found. Run `cfworker login`, `wrangler login`, or set CLOUDFLARE_API_TOKEN and pass --profile env.",
    );
  }
  if (profiles.length === 1) return profiles[0]?.name ?? missing("profile");

  const labels = profiles.map(
    (profile) => `${profile.name}  ${profile.source}`,
  );
  const chosen = await promptChoice("Select profile", labels);
  const profile = profiles[labels.indexOf(chosen)];
  if (!profile) throw new Error("Invalid selection");
  return profile.name;
}

export async function resolveAccount(
  flags: Context["flags"],
  token: string,
): Promise<string> {
  const requested = flag(flags, "account");
  if (requested) return requested;

  const accounts = await listAccounts(token);
  if (accounts.length === 0)
    throw new Error("No Cloudflare accounts available");
  if (accounts.length === 1) return accounts[0]?.id ?? missing("account");

  const labels = accounts.map((account) => `${account.name}  ${account.id}`);
  const chosen = await promptChoice("Select account", labels);
  const account = accounts[labels.indexOf(chosen)];
  if (!account) throw new Error("Invalid selection");
  return account.id;
}

export async function resolveWorker(
  flags: Context["flags"],
  token: string,
  account: string,
): Promise<string> {
  const requested = flag(flags, "worker");
  if (requested) return requested;

  const workers = await listWorkers(token, account);
  if (workers.length === 0) throw new Error("No Workers in this account");
  if (workers.length === 1) return workers[0] ?? missing("worker");
  return promptChoice("Select Worker", workers);
}

function missing(kind: string): never {
  throw new Error(`No ${kind} available`);
}
