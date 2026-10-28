import os from "node:os";
import path from "node:path";

export function expandUserPath(input: string, cwd = process.cwd()): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Path is empty");

  if (trimmed === "~") return os.homedir();
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return path.resolve(path.join(os.homedir(), trimmed.slice(2)));
  }
  if (trimmed.startsWith("~")) {
    throw new Error("Only the current user's ~ is supported");
  }

  if (/^[A-Za-z]:[\\/]/.test(trimmed)) {
    return path.win32.normalize(trimmed);
  }

  return path.resolve(cwd, trimmed);
}

export function assertFinalDestination(dest: string): string {
  const resolved = path.resolve(dest);
  const tmp = path.resolve(os.tmpdir());
  const rel = path.relative(tmp, resolved);
  const insideTmp =
    rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  if (insideTmp) {
    throw new Error(
      `Refusing to use a temp directory as the destination: ${resolved}`,
    );
  }
  return resolved;
}

export function safeName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "_");
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new Error(`Unsafe name: ${name}`);
  }
  return cleaned;
}

export function assertProfileName(name: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name === "." || name === "..") {
    throw new Error(
      `Invalid profile name '${name}'. Use letters, numbers, dots, dashes, or underscores.`,
    );
  }
  if (name === "env")
    throw new Error("Profile name 'env' is reserved for environment tokens.");
  return name;
}
