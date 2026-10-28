import { getUser } from "../../lib/api.js";
import { envToken, saveProfile } from "../../lib/auth.js";
import { spinner, writeResult } from "../../lib/output.js";
import { assertProfileName } from "../../lib/paths.js";
import {
  isTTY,
  promptConfirm,
  promptLine,
  promptText,
} from "../../lib/prompt.js";
import { type Context, flag } from "../context.js";

export async function runLogin(ctx: Context): Promise<void> {
  const requested = flag(ctx.flags, "profile") || flag(ctx.flags, "name");
  const profileName =
    requested ||
    (isTTY() && !ctx.json
      ? await promptLine("Profile name", "default")
      : "default");
  const profile = assertProfileName(profileName);

  let token = flag(ctx.flags, "token");
  if (!token) {
    const fromEnv = envToken();
    if (fromEnv && isTTY() && !ctx.json) {
      const useEnv = await promptConfirm(
        "Use the API token from the environment?",
        true,
      );
      if (useEnv) token = fromEnv;
    } else if (fromEnv && !isTTY()) {
      token = fromEnv;
    }
    if (!token && isTTY() && !ctx.json) {
      console.log(
        "\nCreate a token at https://dash.cloudflare.com/profile/api-tokens\n",
      );
      token = await promptText("Paste token");
    }
  }
  if (!token)
    throw new Error(
      "No token provided. Use --token or set CLOUDFLARE_API_TOKEN.",
    );

  const spin = spinner("Checking token", ctx.json);
  let email = "unknown";
  try {
    const user = await getUser(token);
    email = user.result?.email || "unknown";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Token was rejected by Cloudflare. ${message}`);
  } finally {
    spin.stop();
  }

  const file = saveProfile(profile, token);
  if (ctx.json) {
    writeResult({ command: "login", profile, file, email });
    return;
  }
  console.log(`Saved ${profile} (${email})`);
  console.log(file);
}
