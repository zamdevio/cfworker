import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

export function hasWrangler() {
  const res = spawnSync("wrangler", ["--version"], { stdio: "ignore" });
  return res.status === 0;
}

export function wranglerCmd() {
  return hasWrangler() ? "wrangler" : "npx wrangler";
}

export function wranglerLoginCmd() {
  return `${wranglerCmd()} login`;
}

export function configDir() {
  if (process.env.WRANGLER_CONFIG_DIR) return process.env.WRANGLER_CONFIG_DIR;
  // Wrangler v4 uses ~/.config/.wrangler/config, older versions use ~/.wrangler/config
  const v4 = path.join(os.homedir(), ".config", ".wrangler", "config");
  const v3 = path.join(os.homedir(), ".wrangler", "config");
  if (fs.existsSync(v4)) return v4;
  if (fs.existsSync(v3)) return v3;
  // Default to v4 location (current wrangler)
  return v4;
}

export function wranglerBaseDir() {
  if (process.env.WRANGLER_HOME_DIR) return process.env.WRANGLER_HOME_DIR;
  const v4 = path.join(os.homedir(), ".config", ".wrangler");
  const v3 = path.join(os.homedir(), ".wrangler");
  if (fs.existsSync(v4)) return v4;
  if (fs.existsSync(v3)) return v3;
  return v4;
}

export function cfworkerConfigDir() {
  return process.env.CFWORKER_CONFIG_DIR || path.join(os.homedir(), ".config", "cfworker");
}

function readTokenFromFile(file) {
  if (!fs.existsSync(file)) return null;
  try {
    const text = fs.readFileSync(file, "utf8");
    // Try oauth_token
    let m = /^[ \t]*oauth_token[ \t]*=[ \t]*"([^"]+)"/m.exec(text);
    if (m?.[1]) return m[1];
    // Try token / api_token
    m = /^[ \t]*(?:token|api_token|cloudflare_api_token)[ \t]*=[ \t]*"([^"]+)"/m.exec(text);
    if (m?.[1]) return m[1];
    m = /^[ \t]*(?:token|api_token|cloudflare_api_token)[ \t]*=[ \t]*([^\s#]+)/m.exec(text);
    if (m?.[1]) return m[1].replace(/^['"]|['"]$/g, "");
  } catch {}
  return null;
}

/** @returns {string[]} */
export function listProfiles() {
  const profiles = new Set();

  // Wrangler profiles
  const dir = configDir();
  if (fs.existsSync(dir)) {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith(".toml")) profiles.add(f.replace(/\.toml$/, ""));
      }
    } catch {}
  }

  // cfworker profiles
  const cdir = cfworkerConfigDir();
  if (fs.existsSync(cdir)) {
    try {
      for (const f of fs.readdirSync(cdir)) {
        if (f.endsWith(".toml")) profiles.add(f.replace(/\.toml$/, ""));
      }
    } catch {}
  }

  return [...profiles].sort();
}

/** @param {string} profile */
export function readOauthToken(profile) {
  // Check env vars first
  const envToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || process.env.CFWORKER_TOKEN;
  if (envToken && (!profile || profile === "default" || profile === "env")) {
    return envToken;
  }

  // Check cfworker config first (our own), then wrangler config
  const cfile = path.join(cfworkerConfigDir(), `${profile}.toml`);
  let token = readTokenFromFile(cfile);
  if (token) return token;

  const wfile = path.join(configDir(), `${profile}.toml`);
  token = readTokenFromFile(wfile);
  if (token) return token;

  // If profile is default/env and no file found, maybe try env
  if (envToken) return envToken;

  throw new Error(
    `No credentials found for profile '${profile}'.\n` +
    `Options:\n` +
    `  1) Login with Wrangler: ${wranglerLoginCmd()} (stores in ~/.wrangler/config/)\n` +
    `  2) Login with cfworker: cfworker login --profile ${profile}\n` +
    `  3) Set env var: export CLOUDFLARE_API_TOKEN=...`,
  );
}
