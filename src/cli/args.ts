export class ArgError extends Error {
  readonly json: boolean;

  constructor(message: string, json: boolean) {
    super(message);
    this.name = "ArgError";
    this.json = json;
  }
}

const BOOL_FLAGS = new Set([
  "help",
  "no-split",
  "src-only",
  "prettier",
  "json",
  "force",
]);

export interface ParsedArgs {
  flags: Record<string, string | boolean>;
  positional: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;
    if (arg === "--") {
      for (const rest of argv.slice(index + 1)) {
        if (rest !== undefined) positional.push(rest);
      }
      break;
    }
    if (arg === "-h" || arg === "--help") {
      flags.help = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (!key) throw new ArgError("Expected a flag name", Boolean(flags.json));
      if (BOOL_FLAGS.has(key)) {
        flags[key] = true;
        continue;
      }
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        throw new ArgError(
          `Flag --${key} requires a value`,
          Boolean(flags.json),
        );
      }
      flags[key] = next;
      index += 1;
      continue;
    }
    positional.push(arg);
  }

  return { flags, positional };
}
