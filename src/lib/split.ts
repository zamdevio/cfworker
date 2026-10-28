import path from "node:path";
import { writeInside } from "./safe-fs.js";

export interface SplitResult {
  files: string[];
  skipped: number;
}

const MARKERS = [
  /^\/\/ ((?:src|app|packages|workers|lib|\.\.\/)*[^\s]+\.[a-zA-Z0-9]+)$/,
  /^\/\/ ((?:\.\.\/)*(?:src|node_modules|app|packages|workers|lib|dist)\/[^\s]+)$/,
  /^\/\/ ((?:src|node_modules)\/[^\s]+)$/,
];

export function splitBundle(
  source: string,
  opts: { outDir: string; srcOnly?: boolean; includePreamble?: boolean },
): SplitResult {
  const srcOnly = opts.srcOnly ?? false;
  const includePreamble = opts.includePreamble ?? true;
  const lines = source.split("\n");
  const markers = findMarkers(lines);
  const written: string[] = [];
  let skipped = 0;

  const preambleEnd = markers[0]?.start ?? lines.length;
  if (includePreamble && preambleEnd > 0) {
    const preamble = lines.slice(0, preambleEnd).join("\n").trimEnd();
    if (preamble) {
      writeInside(opts.outDir, "_preamble.js", `${preamble}\n`);
      written.push(path.join(opts.outDir, "_preamble.js"));
    }
  }

  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    if (!marker) continue;
    const next = markers[index + 1];
    const end = next ? next.start : lines.length;
    const rel = marker.path.replace(/\\/g, "/");

    if (
      srcOnly &&
      (rel.includes("node_modules/") || rel.startsWith("node_modules/"))
    ) {
      skipped += 1;
      continue;
    }

    const safeRel = sanitizeRelPath(rel);
    if (!safeRel) {
      skipped += 1;
      continue;
    }

    const body = `${lines
      .slice(marker.start + 1, end)
      .join("\n")
      .replace(/\n+$/, "")}\n`;
    writeInside(opts.outDir, safeRel, `// ${rel}\n${body}`);
    written.push(path.join(opts.outDir, ...safeRel.split("/")));
  }

  return { files: written, skipped };
}

function findMarkers(lines: string[]): { path: string; start: number }[] {
  const markers: { path: string; start: number }[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const found = markerPath(lines[index] ?? "");
    if (found) markers.push({ path: found, start: index });
  }
  if (markers.length > 0) return markers;

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^\/\/ ([^\s]+?\.[a-zA-Z0-9]+)(?:\s|$)/.exec(
      lines[index] ?? "",
    );
    const candidate = match?.[1]?.replace(/\\/g, "/");
    if (!candidate) continue;
    if (
      candidate.includes("/") &&
      !candidate.startsWith("http") &&
      !candidate.includes("====") &&
      candidate.length < 400
    ) {
      markers.push({ path: candidate, start: index });
    }
  }
  return markers;
}

function markerPath(line: string): string | null {
  for (const pattern of MARKERS) {
    const captured = pattern.exec(line)?.[1];
    if (captured) return captured.replace(/\\/g, "/");
  }
  return null;
}

export function sanitizeRelPath(rel: string): string | null {
  let normalized = rel.replace(/\\/g, "/");
  if (normalized.includes("\0")) return null;

  const pnpmMatch = normalized.match(
    /node_modules\/\.pnpm\/[^/]+\/node_modules\/(.+)$/,
  );
  if (pnpmMatch?.[1]) normalized = `node_modules/${pnpmMatch[1]}`;
  else normalized = normalized.replace(/^(\.\.\/)+/, "");

  if (path.posix.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized))
    return null;

  const posix = path.posix.normalize(normalized);
  if (!posix || posix === "." || posix.startsWith("../") || posix === "..")
    return null;
  return posix;
}
