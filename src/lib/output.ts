const useColor = !process.env.NO_COLOR && Boolean(process.stdout.isTTY);

function paint(code: string, text: string): string {
  if (!useColor) return text;
  return `\u001b[${code}m${text}\u001b[0m`;
}

export const color = {
  bold: (text: string) => paint("1", text),
  dim: (text: string) => paint("2", text),
  red: (text: string) => paint("31", text),
  green: (text: string) => paint("32", text),
  yellow: (text: string) => paint("33", text),
};

export function printTable(headers: string[], rows: string[][]): void {
  const all = [headers, ...rows];
  const widths = headers.map((_, index) =>
    Math.max(...all.map((row) => (row[index] ?? "").length), 0),
  );
  const format = (row: string[]) =>
    row.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ");

  console.log(color.bold(format(headers)));
  for (const row of rows) console.log(format(row));
}

export function writeResult(payload: Record<string, unknown>): void {
  process.stdout.write(
    `${JSON.stringify({ ok: true, ...payload }, null, 2)}\n`,
  );
}

export function writeError(error: unknown, json: boolean): void {
  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    process.stdout.write(
      `${JSON.stringify({ ok: false, error: message }, null, 2)}\n`,
    );
    return;
  }
  process.stderr.write(`${color.red("Error:")} ${message}\n`);
}

export function spinner(label: string, silent: boolean): { stop: () => void } {
  if (silent || !process.stderr.isTTY) {
    if (!silent && !process.stderr.isTTY) process.stderr.write(`${label}\n`);
    return { stop() {} };
  }

  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let index = 0;
  const timer = setInterval(() => {
    const frame = frames[index % frames.length] ?? ".";
    index += 1;
    process.stderr.write(`\r${frame} ${label}`);
  }, 80);

  return {
    stop() {
      clearInterval(timer);
      process.stderr.write("\r\u001b[K");
    },
  };
}
