import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runLogin } from "../src/cli/commands/login.js";
import {
  defaultWranglerConfigDirs,
  listProfiles,
  loadCredential,
  readOauthToken,
} from "../src/lib/auth.js";
import { withEnv } from "./env.js";

test("default wrangler dirs cover v4 and v3", () => {
  const dirs = defaultWranglerConfigDirs("/home/me");
  assert.equal(
    dirs[0],
    path.join("/home/me", ".config", ".wrangler", "config"),
  );
  assert.equal(dirs[1], path.join("/home/me", ".wrangler", "config"));
});

test("profiles keep their source and prefer cfworker over wrangler", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-auth-"));
  const cfworker = path.join(root, "cfworker");
  const v4 = path.join(root, "v4");
  const v3 = path.join(root, "v3");
  fs.mkdirSync(cfworker);
  fs.mkdirSync(v4);
  fs.mkdirSync(v3);
  fs.writeFileSync(
    path.join(cfworker, "work.toml"),
    'oauth_token = "from-cfworker"\n',
  );
  fs.writeFileSync(path.join(v4, "work.toml"), 'oauth_token = "from-v4"\n');
  fs.writeFileSync(path.join(v3, "legacy.toml"), 'oauth_token = "from-v3"\n');

  await withEnv(
    {
      CFWORKER_CONFIG_DIR: cfworker,
      WRANGLER_CONFIG_DIR: [v4, v3].join(path.delimiter),
      CLOUDFLARE_API_TOKEN: "env-token",
      CF_API_TOKEN: undefined,
      CFWORKER_TOKEN: undefined,
    },
    () => {
      const profiles = listProfiles();
      assert.deepEqual(
        profiles.map((profile) => `${profile.name}:${profile.source}`),
        ["env:env", "legacy:wrangler", "work:cfworker"],
      );
      assert.equal(readOauthToken("work").token, "from-cfworker");
      assert.equal(readOauthToken("legacy").token, "from-v3");
      assert.equal(readOauthToken("env").source, "env");
      assert.throws(() => readOauthToken("missing"), /No credentials/);
    },
  );
});

test("login validates the token before writing a profile", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-login-"));
  const previous = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ success: true, result: { email: "a@b.c" } }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  try {
    await withEnv(
      {
        CFWORKER_CONFIG_DIR: dir,
        CLOUDFLARE_API_TOKEN: undefined,
        CF_API_TOKEN: undefined,
        CFWORKER_TOKEN: undefined,
      },
      async () => {
        await runLogin({
          flags: { profile: "work", token: "tok_123" },
          positional: [],
          json: true,
        });
      },
    );
  } finally {
    globalThis.fetch = previous;
  }

  const file = path.join(dir, "work.toml");
  assert.match(fs.readFileSync(file, "utf8"), /tok_123/);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test("login does not save a rejected token", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-login-"));
  const previous = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: false,
        errors: [{ message: "Invalid token" }],
      }),
      {
        status: 401,
        headers: { "content-type": "application/json" },
      },
    );

  try {
    await withEnv({ CFWORKER_CONFIG_DIR: dir }, async () => {
      await assert.rejects(
        () =>
          runLogin({
            flags: { profile: "work", token: "nope" },
            positional: [],
            json: true,
          }),
        /rejected/,
      );
    });
  } finally {
    globalThis.fetch = previous;
  }

  assert.equal(fs.existsSync(path.join(dir, "work.toml")), false);
});

test("an expired wrangler token is refreshed and written back", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-refresh-"));
  const file = path.join(dir, "work.toml");
  fs.writeFileSync(
    file,
    [
      'oauth_token = "old-access"',
      'expiration_time = "2000-01-01T00:00:00.000Z"',
      'refresh_token = "old-refresh"',
      'scopes = [ "account:read", "workers:write" ]',
      "",
    ].join("\n"),
  );
  const previous = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://dash.cloudflare.com/oauth2/token");
    assert.match(String(init?.body), /refresh_token=old-refresh/);
    assert.match(
      String(init?.body),
      /client_id=54d11594-84e4-41aa-b438-e81b8fa78ee7/,
    );
    return new Response(
      JSON.stringify({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 3600,
        scope: "account:read workers:write",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    await withEnv(
      {
        WRANGLER_CONFIG_DIR: dir,
        CFWORKER_CONFIG_DIR: path.join(dir, "missing-cfworker"),
        CLOUDFLARE_API_TOKEN: undefined,
        CF_API_TOKEN: undefined,
        CFWORKER_TOKEN: undefined,
        WRANGLER_TOKEN_URL: undefined,
        WRANGLER_CLIENT_ID: undefined,
      },
      async () => {
        const credential = await loadCredential("work");
        assert.equal(credential.token, "new-access");
        assert.equal(credential.refreshToken, "new-refresh");
      },
    );
  } finally {
    globalThis.fetch = previous;
  }

  const saved = fs.readFileSync(file, "utf8");
  assert.match(saved, /oauth_token = "new-access"/);
  assert.match(saved, /refresh_token = "new-refresh"/);
  assert.match(saved, /workers:write/);
  assert.doesNotMatch(saved, /old-access/);
});

test("a current wrangler token is used without calling the token endpoint", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cfw-fresh-"));
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  fs.writeFileSync(
    path.join(dir, "work.toml"),
    `oauth_token = "still-good"\nexpiration_time = "${expires}"\nrefresh_token = "keep"\n`,
  );
  const previous = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("token endpoint should not be called");
  };
  try {
    await withEnv(
      {
        WRANGLER_CONFIG_DIR: dir,
        CFWORKER_CONFIG_DIR: path.join(dir, "missing-cfworker"),
        CLOUDFLARE_API_TOKEN: undefined,
        CF_API_TOKEN: undefined,
        CFWORKER_TOKEN: undefined,
      },
      async () => {
        const credential = await loadCredential("work");
        assert.equal(credential.token, "still-good");
      },
    );
  } finally {
    globalThis.fetch = previous;
  }
});
