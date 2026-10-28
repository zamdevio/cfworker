import fs from "node:fs";
import path from "node:path";

/**
 * Split an esbuild/wrangler bundle using `// path/to/file.ext` markers.
 *
 * @param {string} source
 * @param {{
 *   outDir: string,
 *   srcOnly?: boolean,
 *   includePreamble?: boolean,
 * }} opts
 * @returns {{ files: string[], skipped: number, preamble?: string }}
 */
export function splitBundle(source, opts) {
  const { outDir, srcOnly = false, includePreamble = true } = opts;
  const lines = source.split("\n");

  /** @type {{ path: string, start: number }[]} */
  const markers = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^\/\/ ((?:src|app|packages|workers|lib|\.\.\/)*[^\s]+\.[a-zA-Z0-9]+)$/.exec(
      line,
    );
    // Broader: any // relative path with an extension (esbuild style)
    const m2 =
      m ||
      /^\/\/ ((?:\.\.\/)*(?:src|node_modules|app|packages|workers|lib|dist)\/[^\s]+)$/.exec(
        line,
      ) ||
      /^\/\/ ((?:src|node_modules)\/[^\s]+)$/.exec(line);

    if (m2) {
      markers.push({ path: m2[1], start: i });
    }
  }

  // Fallback broader matcher if nothing found with the above
  if (markers.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const m = /^\/\/ ([^\s]+?\.[a-zA-Z0-9]+)(?:\s|$)/.exec(lines[i]);
      if (!m) continue;
      const p = m[1];
      if (
        p.includes("/") &&
        !p.startsWith("http") &&
        !p.includes("====") &&
        p.length < 400
      ) {
        markers.push({ path: p, start: i });
      }
    }
  }

  fs.mkdirSync(outDir, { recursive: true });

  /** @type {string[]} */
  const written = [];
  let skipped = 0;

  const preambleEnd = markers.length ? markers[0].start : lines.length;
  if (includePreamble && preambleEnd > 0) {
    const preamble = lines.slice(0, preambleEnd).join("\n").trimEnd();
    if (preamble) {
      const preamblePath = path.join(outDir, "_preamble.js");
      fs.writeFileSync(preamblePath, preamble + "\n", "utf8");
      written.push(preamblePath);
    }
  }

  for (let i = 0; i < markers.length; i++) {
    const { path: rel, start } = markers[i];
    const end = i + 1 < markers.length ? markers[i + 1].start : lines.length;

    if (srcOnly && (rel.includes("node_modules/") || rel.startsWith("../../node_modules"))) {
      skipped++;
      continue;
    }

    const safeRel = sanitizeRelPath(rel);
    if (!safeRel) {
      skipped++;
      continue;
    }

    // Drop the marker line itself; keep file body
    const body = lines.slice(start + 1, end).join("\n").replace(/\n+$/, "") + "\n";
    const header = `// ${rel}\n`;
    const abs = path.join(outDir, safeRel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, header + body, "utf8");
    written.push(abs);
  }

  return { files: written, skipped };
}

/** @param {string} rel */
function sanitizeRelPath(rel) {
  let p = rel.replace(/\\/g, "/");

  // Collapse pnpm store paths: ../../node_modules/.pnpm/pkg@ver/.../node_modules/pkg/file
  // Keep a readable node_modules/<pkg>/... when possible
  const pnpmMatch = p.match(
    /node_modules\/\.pnpm\/[^/]+\/node_modules\/(.+)$/,
  );
  if (pnpmMatch) {
    p = `node_modules/${pnpmMatch[1]}`;
  } else {
    p = p.replace(/^(\.\.\/)+/, "");
  }

  if (p.includes("\0") || path.isAbsolute(p)) return null;

  const normalized = path.posix.normalize(p);
  if (normalized.startsWith("..") || normalized.includes("/../")) return null;

  return normalized;
}
