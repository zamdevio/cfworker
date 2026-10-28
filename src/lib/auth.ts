import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertProfileName } from "./paths.js";

export type ProfileSource = "wrangler" | "cfworker" | "env";

export interface Profile {
  name: string;
  source: ProfileSource;
  file?: string;
}

export interface Credential {
  token: string;
  source: ProfileSource;
  file?: string;
  refreshToken?: string;
  expiresAt?: string;
}

const WRANGLER_CLIENT_ID = "54d11594-84e4-41aa-b438-e81b8fa78ee7";
const REFRESH_SKEW_MS = 60_000;

export function envToken(): string | undefined {
  return (
    process.env.CLOUDFLARE_API_TOKEN ||
    process.env.CF_API_TOKEN ||
    process.env.CFWORKER_TOKEN ||
    undefined
  );
}

export function cfworkerConfigDir(): string {
  return (
    process.env.CFWORKER_CONFIG_DIR ||
    path.join(os.homedir(), ".config", "cfworker")
  );
}

export function defaultWranglerConfigDirs(home = os.homedir()): string[] {
  return [
    path.join(home, ".config", ".wrangler", "config"),
    path.join(home, ".wrangler", "config"),
  ];
}

export function wranglerConfigDirs(): string[] {
  const fromEnv = process.env.WRANGLER_CONFIG_DIR;
  if (fromEnv) {
    return fromEnv.split(path.delimiter).filter((dir) => dir.length > 0);
  }
  return defaultWranglerConfigDirs();
}

export function listProfiles(): Profile[] {
  const found = new Map<string, Profile>();
  const ranked = [
    ...scanDir(cfworkerConfigDir(), "cfworker"),
    ...wranglerConfigDirs().flatMap((dir) => scanDir(dir, "wrangler")),
  ];

  for (const hit of ranked) {
    if (hit.name === "env" || found.has(hit.name)) continue;
    found.set(hit.name, hit);
  }

  if (envToken()) {
    found.set("env", { name: "env", source: "env" });
  }

  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function readOauthToken(profile: string): Credential {
  if (profile === "env") {
    const token = envToken();
    if (!token) {
      throw new Error(
        "No token in CLOUDFLARE_API_TOKEN, CF_API_TOKEN, or CFWORKER_TOKEN.",
      );
    }
    return { token, source: "env" };
  }

  assertProfileName(profile);

  const cfworkerFile = path.join(cfworkerConfigDir(), `${profile}.toml`);
  const cfworkerToken = readTokenFromFile(cfworkerFile);
  if (cfworkerToken)
    return { token: cfworkerToken, source: "cfworker", file: cfworkerFile };

  for (const dir of wranglerConfigDirs()) {
    const file = path.join(dir, `${profile}.toml`);
    const stored = readWranglerCredential(file);
    if (stored) return stored;
  }

  throw new Error(
    `No credentials found for profile '${profile}'.\n` +
      "Options:\n" +
      "  1) wrangler login\n" +
      `  2) cfworker login --profile ${profile}\n` +
      "  3) export CLOUDFLARE_API_TOKEN=... and pass --profile env",
  );
}

export function saveProfile(profile: string, token: string): string {
  const name = assertProfileName(profile);
  if (token.includes("\n") || token.includes("\r")) {
    throw new Error("Token must be a single line.");
  }

  const dir = cfworkerConfigDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    // Windows may reject POSIX modes.
  }

  const file = path.join(dir, `${name}.toml`);
  const escaped = token.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  fs.writeFileSync(file, `# cfworker profile\noauth_token = "${escaped}"\n`, {
    mode: 0o600,
  });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Windows may reject POSIX modes.
  }
  return file;
}

function scanDir(dir: string, source: ProfileSource): Profile[] {
  if (!fs.existsSync(dir)) return [];
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const profiles: Profile[] = [];
  for (const name of names) {
    if (!name.endsWith(".toml")) continue;
    const profile = name.slice(0, -".toml".length);
    if (!profile) continue;
    profiles.push({ name: profile, source, file: path.join(dir, name) });
  }
  return profiles;
}

export async function loadCredential(profile: string): Promise<Credential> {
  const credential = readOauthToken(profile);
  if (!needsRefresh(credential)) return credential;
  return refreshWranglerCredential(credential);
}

export async function withProfile<T>(
  profile: string,
  run: (credential: Credential) => Promise<T>,
): Promise<T> {
  const credential = await loadCredential(profile);
  try {
    return await run(credential);
  } catch (error) {
    if (!canRefreshAfterAuthFailure(credential, error)) throw error;
    return run(await refreshWranglerCredential(credential));
  }
}

export function needsRefresh(credential: Credential): boolean {
  if (credential.source !== "wrangler" || !credential.refreshToken)
    return false;
  if (!credential.expiresAt) return true;
  const expiry = Date.parse(credential.expiresAt);
  if (Number.isNaN(expiry)) return true;
  return Date.now() + REFRESH_SKEW_MS >= expiry;
}

export async function refreshWranglerCredential(
  credential: Credential,
): Promise<Credential> {
  if (!credential.file || !credential.refreshToken) {
    throw new Error(
      "Wrangler OAuth token expired and this profile has no refresh token. Run `wrangler login`.",
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: credential.refreshToken,
    client_id: process.env.WRANGLER_CLIENT_ID || WRANGLER_CLIENT_ID,
  });
  const response = await fetch(wranglerTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await readJson(response);
  const accessToken = stringField(payload, "access_token");
  if (!response.ok || !accessToken || stringField(payload, "error")) {
    const detail =
      stringField(payload, "error_description") ||
      stringField(payload, "error") ||
      `HTTP ${response.status}`;
    throw new Error(
      `Wrangler token refresh failed (${detail}). Run \`wrangler login\`.`,
    );
  }

  const refreshToken =
    stringField(payload, "refresh_token") || credential.refreshToken;
  const expiresIn = numberField(payload, "expires_in") ?? 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const scope = stringField(payload, "scope");
  writeWranglerCredential(credential.file, {
    token: accessToken,
    refreshToken,
    expiresAt,
    scopes: scope
      ? scope.split(" ").filter((item) => item.length > 0)
      : undefined,
  });

  return {
    ...credential,
    token: accessToken,
    refreshToken,
    expiresAt,
  };
}

export function isAuthFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /invalid access token|authentication error/i.test(message);
}

function canRefreshAfterAuthFailure(
  credential: Credential,
  error: unknown,
): boolean {
  return (
    credential.source === "wrangler" &&
    Boolean(credential.refreshToken) &&
    isAuthFailure(error)
  );
}

function wranglerTokenUrl(): string {
  if (process.env.WRANGLER_TOKEN_URL) return process.env.WRANGLER_TOKEN_URL;
  const domain = process.env.WRANGLER_AUTH_DOMAIN || "dash.cloudflare.com";
  return `https://${domain}/oauth2/token`;
}

function readText(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function readWranglerCredential(file: string): Credential | null {
  const text = readText(file);
  if (text === null) return null;
  const token = matchTomlString(text, "oauth_token");
  if (!token) return null;
  const refreshToken = matchTomlString(text, "refresh_token") || undefined;
  const expiresAt = matchTomlString(text, "expiration_time") || undefined;
  return { token, source: "wrangler", file, refreshToken, expiresAt };
}

function writeWranglerCredential(
  file: string,
  next: {
    token: string;
    refreshToken: string;
    expiresAt: string;
    scopes?: string[];
  },
): void {
  const current = readText(file) ?? "";
  let text = replaceTomlString(current, "oauth_token", next.token);
  text = replaceTomlString(text, "refresh_token", next.refreshToken);
  text = replaceTomlString(text, "expiration_time", next.expiresAt);
  if (next.scopes && next.scopes.length > 0) {
    const rendered = `scopes = [ ${next.scopes.map(tomlQuoted).join(", ")} ]`;
    text = /^[ \t]*scopes[ \t]*=.*$/m.test(text)
      ? text.replace(/^[ \t]*scopes[ \t]*=.*$/m, rendered)
      : `${text.replace(/\n?$/, "\n")}${rendered}\n`;
  }
  fs.writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`, {
    mode: 0o600,
  });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Windows may reject POSIX modes.
  }
}

function replaceTomlString(text: string, key: string, value: string): string {
  const line = `${key} = ${tomlQuoted(value)}`;
  const pattern = new RegExp(`^[ \\t]*${key}[ \\t]*=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, line);
  return `${text.replace(/\n?$/, "\n")}${line}\n`;
}

function tomlQuoted(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function matchTomlString(text: string, key: string): string | null {
  const match = new RegExp(
    `^[ \\t]*${key}[ \\t]*=[ \\t]*"((?:\\\\.|[^"\\\\])*)"`,
    "m",
  ).exec(text);
  return match?.[1] ? unescapeToml(match[1]) : null;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function stringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object" || !(key in value)) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.length > 0 ? field : undefined;
}

function numberField(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== "object" || !(key in value)) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "number" && Number.isFinite(field)
    ? field
    : undefined;
}

function readTokenFromFile(file: string): string | null {
  const text = readText(file);
  if (text === null) return null;

  const quoted = /^[ \t]*oauth_token[ \t]*=[ \t]*"((?:\\.|[^"\\])*)"/m.exec(
    text,
  );
  if (quoted?.[1]) return unescapeToml(quoted[1]);

  const named =
    /^[ \t]*(?:token|api_token|cloudflare_api_token)[ \t]*=[ \t]*"((?:\\.|[^"\\])*)"/m.exec(
      text,
    );
  if (named?.[1]) return unescapeToml(named[1]);

  const bare =
    /^[ \t]*(?:token|api_token|cloudflare_api_token)[ \t]*=[ \t]*([^\s#]+)/m.exec(
      text,
    );
  if (bare?.[1]) return bare[1].replace(/^['"]|['"]$/g, "");
  return null;
}

function unescapeToml(value: string): string {
  return value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}
