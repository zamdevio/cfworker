import { stdin, stdout } from "node:process";
import readline from "node:readline/promises";

export function isTTY(): boolean {
  return Boolean(stdin.isTTY && stdout.isTTY);
}

export async function promptChoice(
  label: string,
  choices: readonly string[],
): Promise<string> {
  if (!isTTY()) {
    throw new Error(`${label}: required (non-interactive; pass a flag)`);
  }
  if (choices.length === 0) throw new Error(`${label}: no choices`);

  console.log(`\n${label}:\n`);
  choices.forEach((choice, index) => {
    console.log(`  [${index + 1}] ${choice}`);
  });

  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = (
      await rl.question(`\nSelect [1-${choices.length}]: `)
    ).trim();
    const selected = Number(answer);
    if (
      !Number.isInteger(selected) ||
      selected < 1 ||
      selected > choices.length
    ) {
      throw new Error("Invalid selection");
    }
    const choice = choices[selected - 1];
    if (choice === undefined) throw new Error("Invalid selection");
    return choice;
  } finally {
    rl.close();
  }
}

export async function promptText(label: string): Promise<string> {
  if (!isTTY())
    throw new Error(`${label}: required (non-interactive; pass a flag)`);
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(`${label}: `)).trim();
  } finally {
    rl.close();
  }
}

export async function promptLine(
  label: string,
  fallback: string,
): Promise<string> {
  if (!isTTY()) return fallback;
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(`${label} [${fallback}]: `)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

export async function promptConfirm(
  label: string,
  fallbackYes: boolean,
): Promise<boolean> {
  if (!isTTY()) return fallbackYes;
  const hint = fallbackYes ? "Y/n" : "y/N";
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(`${label} [${hint}]: `))
      .trim()
      .toLowerCase();
    if (!answer) return fallbackYes;
    if (answer === "y" || answer === "yes") return true;
    if (answer === "n" || answer === "no") return false;
    throw new Error("Expected y or n");
  } finally {
    rl.close();
  }
}
