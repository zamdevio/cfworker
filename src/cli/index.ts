import { writeError } from "../lib/output.js";
import { ArgError, parseArgs } from "./args.js";
import type { Context } from "./context.js";
import { printHelp } from "./help.js";

const COMMANDS = [
  "profiles",
  "whoami",
  "login",
  "auth",
  "accounts",
  "list",
  "download",
  "split",
] as const;
type Command = (typeof COMMANDS)[number];

function isCommand(value: string): value is Command {
  return (COMMANDS as readonly string[]).includes(value);
}

// Each command is loaded on use so `--help` stays small and does not scan auth or start a network client.
async function dispatch(command: Command, ctx: Context): Promise<void> {
  switch (command) {
    case "profiles":
    case "whoami": {
      const { runProfiles } = await import("./commands/profiles.js");
      await runProfiles(ctx);
      return;
    }
    case "login":
    case "auth": {
      const { runLogin } = await import("./commands/login.js");
      await runLogin(ctx);
      return;
    }
    case "accounts": {
      const { runAccounts } = await import("./commands/accounts.js");
      await runAccounts(ctx);
      return;
    }
    case "list": {
      const { runList } = await import("./commands/list.js");
      await runList(ctx);
      return;
    }
    case "download": {
      const { runDownload } = await import("./commands/download.js");
      await runDownload(ctx);
      return;
    }
    case "split": {
      const { runSplit } = await import("./commands/split.js");
      await runSplit(ctx);
      return;
    }
    default: {
      const exhaustive: never = command;
      throw new Error(`Unknown command: ${String(exhaustive)}`);
    }
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printHelp();
    return;
  }

  let json = argv.includes("--json");
  try {
    const parsed = parseArgs(argv);
    json = Boolean(parsed.flags.json);
    if (parsed.flags.help) {
      printHelp();
      return;
    }
    const command = parsed.positional[0];
    if (!command || !isCommand(command)) {
      throw new Error(
        command ? `Unknown command: ${command}` : "Missing command",
      );
    }
    await dispatch(command, {
      flags: parsed.flags,
      positional: parsed.positional.slice(1),
      json,
    });
  } catch (error) {
    const asJson = (error instanceof ArgError && error.json) || json;
    writeError(error, asJson);
    process.exitCode = 1;
  }
}

void main();
