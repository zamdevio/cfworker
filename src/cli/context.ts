export interface Context {
  flags: Record<string, string | boolean>;
  positional: string[];
  json: boolean;
}

export function flag(
  flags: Context["flags"],
  name: string,
): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}
