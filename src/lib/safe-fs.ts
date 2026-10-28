import fs from "node:fs";
import path from "node:path";

export function assertContained(root: string, target: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const rel = path.relative(resolvedRoot, resolvedTarget);
  if (rel === "") return;
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(
      `Refusing to write outside ${resolvedRoot}: ${resolvedTarget}`,
    );
  }
}

export function mkdirInside(root: string, dir: string): void {
  const resolvedRoot = path.resolve(root);
  fs.mkdirSync(resolvedRoot, { recursive: true });
  const rel = path.relative(resolvedRoot, path.resolve(dir));
  if (rel === "") return;
  assertContained(resolvedRoot, dir);

  let current = resolvedRoot;
  for (const part of rel.split(path.sep)) {
    if (!part || part === ".") continue;
    current = path.join(current, part);
    const stat = statOrNull(current);
    if (!stat) {
      fs.mkdirSync(current);
      continue;
    }
    if (stat.isSymbolicLink()) {
      assertContained(resolvedRoot, fs.realpathSync(current));
      continue;
    }
    if (!stat.isDirectory())
      throw new Error(`Expected a directory: ${current}`);
  }
}

export function writeInside(
  root: string,
  relPosix: string,
  data: Buffer | string,
): void {
  const parts = relPosix.split("/").filter((part) => part.length > 0);
  if (
    parts.length === 0 ||
    parts.some((part) => part === "." || part === "..")
  ) {
    throw new Error(`Unsafe relative path: ${relPosix}`);
  }

  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...parts);
  assertContained(resolvedRoot, target);
  mkdirInside(resolvedRoot, path.dirname(target));

  const existing = statOrNull(target);
  if (existing?.isSymbolicLink()) fs.unlinkSync(target);

  const tmp = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.tmp`,
  );
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, target);
}

function statOrNull(target: string): fs.Stats | null {
  try {
    return fs.lstatSync(target);
  } catch {
    return null;
  }
}
