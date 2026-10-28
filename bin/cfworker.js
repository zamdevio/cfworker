#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { listProfiles, readOauthToken, wranglerLoginCmd, wranglerCmd, hasWrangler, cfworkerConfigDir } from "../lib/auth.js";
import {
  getUser,
  listAccounts,
  listWorkers,
  downloadWorker,
} from "../lib/api.js";
import { unwrapWorkerPayload } from "../lib/multipart.js";
import { splitBundle } from "../lib/split.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUT = process.env.CFWORKER_OUT || path.join(ROOT, "recovered");

function usage(code = 0) {
  console.log(`cfworker — download & recover Cloudflare Workers

Usage:
  cfworker profiles
  cfworker login      [--profile NAME] [--token TOKEN]
  cfworker accounts   --profile NAME
  cfworker list       --profile NAME --account ID
  cfworker download   --profile NAME --account ID --worker NAME [options]
  cfworker split      <file.js> [--out DIR] [options]

Auth:
  cfworker reads Wrangler OAuth profiles from ~/.wrangler/config/*.toml by default.
  It also checks ~/.config/cfworker/*.toml and env vars (CLOUDFLARE_API_TOKEN, CF_API_TOKEN).
  ${hasWrangler() ? "Wrangler detected in PATH." : "Wrangler not found in PATH — will suggest 'npx wrangler'."}

Download options:
  --out DIR          Output root (default: ./recovered)
  --no-split         Keep only the raw bundle, do not create a split tree
  --src-only         When splitting, skip node_modules paths
  --prettier         Run prettier --write on the raw bundle after save
  --name NAME        Override folder basename (default: worker name)
  --json             Machine-readable output

Split options:
  --out DIR          Output directory for split files
  --src-only         Skip node_modules paths
  --prettier         Format cleaned bundle if multipart was stripped
  --json             Machine-readable output

Non-interactive:
  Pass --profile / --account / --worker as needed. Missing values prompt
  only when stdin is a TTY; otherwise the command errors.

Examples:
  ${wranglerLoginCmd()}
  cfworker login --profile zamdevio
  cfworker profiles
  cfworker accounts --profile zamdevio
  cfworker list --profile zamdevio --account abc123
  cfworker download --profile zamdevio --account abc123 --worker tiktok --src-only
  cfworker split ./old/clipx.js --out ./recovered/clipx/split --src-only
`);
  process.exit(code);
}

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  /** @type {string[]} */
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      flags.help = true;
      continue;
    }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const boolFlags = new Set([
        "help",
        "no-split",
        "src-only",
        "prettier",
        "json",
      ]);
      if (boolFlags.has(key)) {
        flags[key] = true;
        continue;
      }
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Flag --${key} requires a value`);
      }
      flags[key] = next;
      i++;
      continue;
    }
    positional.push(a);
  }

  return { flags, positional };
}

function isTTY() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * @param {string} label
 * @param {string[]} choices
 */
async function promptChoice(label, choices) {
  if (!isTTY()) {
    throw new Error(`${label}: required (non-interactive; pass a flag)`);
  }
  console.log(`\n${label}:\n`);
  choices.forEach((c, i) => console.log(`  [${i + 1}] ${c}`));
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`\nSelect [1-${choices.length}]: `);
    const n = Number(answer);
    if (!Number.isInteger(n) || n < 1 || n > choices.length) {
      throw new Error("Invalid selection");
    }
    return choices[n - 1];
  } finally {
    rl.close();
  }
}

/** @param {string} name */
function safeName(name) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_");
}

/** @param {Record<string, string | boolean>} flags */
async function resolveProfile(flags) {
  if (flags.profile) return String(flags.profile);
  const profiles = listProfiles();
  if (!profiles.length) {
    throw new Error("No Wrangler profiles. Run: npx wrangler login");
  }
  if (profiles.length === 1) return profiles[0];
  return promptChoice("Select Wrangler profile", profiles);
}

/**
 * @param {Record<string, string | boolean>} flags
 * @param {string} token
 */
async function resolveAccount(flags, token) {
  if (flags.account) return String(flags.account);
  const accounts = await listAccounts(token);
  if (!accounts.length) throw new Error("No Cloudflare accounts available");
  if (accounts.length === 1) return accounts[0].id;
  const labels = accounts.map((a) => `${a.name} (${a.id})`);
  const chosen = await promptChoice("Select account", labels);
  return accounts[labels.indexOf(chosen)].id;
}

/**
 * @param {Record<string, string | boolean>} flags
 * @param {string} token
 * @param {string} account
 */
async function resolveWorker(flags, token, account) {
  if (flags.worker) return String(flags.worker);
  const workers = await listWorkers(token, account);
  if (!workers.length) throw new Error("No Workers in this account");
  if (workers.length === 1) return workers[0];
  return promptChoice("Select Worker", workers);
}

/**
 * @param {string} bundlePath
 * @param {Record<string, string | boolean>} flags
 */
function maybePrettier(bundlePath, flags) {
  if (!flags.prettier) return;
  const r = spawnSync("npx", ["--yes", "prettier", "--write", bundlePath], {
    stdio: "inherit",
    shell: false,
  });
  if (r.status !== 0) {
    console.warn("prettier failed; raw bundle was still saved");
  }
}

/** @param {Record<string, string | boolean>} flags */
async function cmdLogin(flags) {
  const rl = readline.createInterface({ input, output });
  try {
    let profile = flags.profile || flags.name;
    if (!profile) {
      if (input.isTTY) {
        profile = (await rl.question("Profile name [default]: ")).trim() || "default";
      } else {
        profile = "default";
      }
    }

    let token = flags.token;
    if (!token) {
      const envToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
      if (envToken && input.isTTY) {
        const useEnv = (await rl.question("Use CLOUDFLARE_API_TOKEN from env? [Y/n]: ")).trim().toLowerCase();
        if (useEnv !== "n" && useEnv !== "no") token = envToken;
      }
      if (!token && input.isTTY) {
        console.log("\nGet a token at: https://dash.cloudflare.com/profile/api-tokens");
        console.log("You can use an API token or OAuth token.\n");
        token = (await rl.question("Paste token: ")).trim();
      }
    }
    if (!token) {
      throw new Error("No token provided. Use --token or set CLOUDFLARE_API_TOKEN.");
    }

    const dir = cfworkerConfigDir();
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(dir, 0o700); } catch {}
    const file = path.join(dir, `${profile}.toml`);
    const content = `# cfworker profile\noauth_token = "${String(token).replace(/"/g, '\\"')}"\n`;
    fs.writeFileSync(file, content, { mode: 0o600 });
    try { fs.chmodSync(file, 0o600); } catch {}

    if (flags.json) {
      console.log(JSON.stringify({ ok: true, profile, file }, null, 2));
    } else {
      console.log(`Saved token to ${file}`);
      console.log("You can now use: cfworker accounts --profile " + profile);
    }
  } finally {
    rl.close();
  }
}

/** @param {Record<string, string | boolean>} flags */
async function cmdProfiles(flags) {
  const profiles = listProfiles();
  if (flags.json) {
    console.log(JSON.stringify(profiles, null, 2));
    return;
  }
  if (!profiles.length) {
    console.log("No credentials found.");
    console.log(`- Run: ${wranglerLoginCmd()} (uses Wrangler profiles)`);
    console.log("- Run: cfworker login");
    console.log("- Or set: export CLOUDFLARE_API_TOKEN=...");
    return;
  }
  for (const p of profiles) console.log(p);
}

/** @param {Record<string, string | boolean>} flags */
async function cmdAccounts(flags) {
  const profile = await resolveProfile(flags);
  const token = readOauthToken(profile);
  const user = await getUser(token);
  const email = user.result?.email || "unknown";
  const accounts = await listAccounts(token);

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          profile,
          email,
          accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Profile: ${profile}`);
  console.log(`User:    ${email}`);
  for (const a of accounts) {
    console.log(`${a.id}\t${a.name}`);
  }
}

/** @param {Record<string, string | boolean>} flags */
async function cmdList(flags) {
  const profile = await resolveProfile(flags);
  const token = readOauthToken(profile);
  await getUser(token);
  const account = await resolveAccount(flags, token);
  const workers = await listWorkers(token, account);

  if (flags.json) {
    console.log(JSON.stringify({ profile, account, workers }, null, 2));
    return;
  }

  console.log(`Account: ${account}`);
  for (const w of workers) console.log(w);
}

/** @param {Record<string, string | boolean>} flags */
async function cmdDownload(flags) {
  const profile = await resolveProfile(flags);
  const token = readOauthToken(profile);
  const user = await getUser(token);
  const account = await resolveAccount(flags, token);
  const worker = await resolveWorker(flags, token, account);
  const base = safeName(String(flags.name || worker));
  const outRoot = path.resolve(String(flags.out || DEFAULT_OUT));
  const workerDir = path.join(outRoot, base);

  console.log(`Downloading ${worker} …`);
  const { ok, status, buf, notFound, message } = await downloadWorker(
    token,
    account,
    worker,
  );
  if (!ok) {
    // Never create recovered/<name>/ for missing workers
    if (notFound || status === 404) {
      throw new Error(message || `Worker not found: '${worker}'`);
    }
    throw new Error(message || `Download failed: HTTP ${status}`);
  }

  // Only create the output dir after a successful download
  fs.mkdirSync(workerDir, { recursive: true });

  const { isMultipart, script, parts } = unwrapWorkerPayload(buf);
  const bundlePath = path.join(workerDir, "bundle.js");
  fs.writeFileSync(bundlePath, script);

  if (parts.size > 1) {
    const partsDir = path.join(workerDir, "parts");
    fs.mkdirSync(partsDir, { recursive: true });
    for (const [name, body] of parts) {
      fs.writeFileSync(path.join(partsDir, safeName(name)), body);
    }
  }

  maybePrettier(bundlePath, flags);

  /** @type {{ files: string[], skipped: number } | null} */
  let splitInfo = null;
  if (!flags["no-split"]) {
    const splitDir = path.join(workerDir, "split");
    fs.rmSync(splitDir, { recursive: true, force: true });
    splitInfo = splitBundle(script.toString("utf8"), {
      outDir: splitDir,
      srcOnly: Boolean(flags["src-only"]),
    });
  }

  const meta = {
    profile,
    email: user.result?.email || null,
    account,
    worker,
    downloadedAt: new Date().toISOString(),
    multipart: isMultipart,
    bytes: script.length,
    bundle: bundlePath,
    splitFiles: splitInfo?.files.length ?? 0,
    splitSkipped: splitInfo?.skipped ?? 0,
  };
  fs.writeFileSync(
    path.join(workerDir, "meta.json"),
    JSON.stringify(meta, null, 2) + "\n",
  );

  if (flags.json) {
    console.log(JSON.stringify(meta, null, 2));
    return;
  }

  console.log("OK");
  console.log(`  profile   : ${profile}`);
  console.log(`  account   : ${account}`);
  console.log(`  worker    : ${worker}`);
  console.log(`  multipart : ${isMultipart}`);
  console.log(`  bundle    : ${bundlePath}`);
  if (splitInfo) {
    console.log(
      `  split     : ${path.join(workerDir, "split")} (${splitInfo.files.length} files, ${splitInfo.skipped} skipped)`,
    );
  }
}

/**
 * @param {Record<string, string | boolean>} flags
 * @param {string[]} positional
 */
async function cmdSplit(flags, positional) {
  const file = positional[0];
  if (!file) throw new Error("split requires a <file.js> argument");
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);

  const source = fs.readFileSync(abs);
  const { isMultipart, script } = unwrapWorkerPayload(source);
  const outDir = path.resolve(
    String(flags.out || path.join(path.dirname(abs), "split")),
  );
  fs.mkdirSync(path.dirname(outDir), { recursive: true });
  fs.rmSync(outDir, { recursive: true, force: true });

  // Always write a cleaned bundle beside the split tree
  const cleaned = path.join(path.dirname(outDir), "bundle.js");
  fs.writeFileSync(cleaned, script);
  maybePrettier(cleaned, flags);
  if (isMultipart || source.compare(script) !== 0) {
    console.log(`Stripped multipart → ${cleaned}`);
  } else {
    console.log(`Bundle → ${cleaned}`);
  }

  const info = splitBundle(script.toString("utf8"), {
    outDir,
    srcOnly: Boolean(flags["src-only"]),
  });

  if (flags.json) {
    console.log(JSON.stringify({ outDir, multipart: isMultipart, ...info }, null, 2));
    return;
  }

  console.log(
    `Split ${info.files.length} files → ${outDir} (${info.skipped} skipped)`,
  );
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length) usage(0);

  let flags;
  let positional;
  try {
    ({ flags, positional } = parseArgs(argv));
  } catch (e) {
    console.error(String(/** @type {Error} */ (e).message || e));
    process.exit(1);
  }

  if (flags.help) usage(0);

  const cmd = positional[0];
  const rest = positional.slice(1);

  try {
    switch (cmd) {
      case "profiles":
      case "whoami":
        await cmdProfiles(flags);
        break;
      case "login":
      case "auth":
        await cmdLogin(flags);
        break;
      case "accounts":
        await cmdAccounts(flags);
        break;
      case "list":
        await cmdList(flags);
        break;
      case "download":
        await cmdDownload(flags);
        break;
      case "split":
        await cmdSplit(flags, rest);
        break;
      default:
        console.error(`Unknown command: ${cmd}`);
        usage(1);
    }
  } catch (e) {
    console.error(`Error: ${/** @type {Error} */ (e).message || e}`);
    process.exit(1);
  }
}

main();
