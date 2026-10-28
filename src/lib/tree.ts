import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeInside } from "./safe-fs.js";

export type SyncAction = "overwrite" | "update" | "merge" | "abort";
export type FileStatus = "new" | "same" | "different";

export interface PlannedFile {
  rel: string;
  status: FileStatus;
  sha256: string;
}

export interface PlanSummary {
  same: number;
  different: number;
  added: number;
}

export function makeStage(): { dir: string; remove: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cfworker-"));
  return {
    dir,
    remove() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function planTree(stageDir: string, destDir: string): PlannedFile[] {
  return walkFiles(stageDir)
    .sort()
    .map((rel) => {
      const stageFile = path.join(stageDir, ...rel.split("/"));
      const destFile = path.join(destDir, ...rel.split("/"));
      const sha256 = sha256File(stageFile);
      if (!fs.existsSync(destFile) || fs.lstatSync(destFile).isSymbolicLink()) {
        return { rel, status: "new" as const, sha256 };
      }
      const destHash = sha256File(destFile);
      return {
        rel,
        status:
          destHash === sha256 ? ("same" as const) : ("different" as const),
        sha256,
      };
    });
}

export function summarize(plan: PlannedFile[]): PlanSummary {
  const summary: PlanSummary = { same: 0, different: 0, added: 0 };
  for (const file of plan) {
    if (file.rel === "meta.json") continue;
    if (file.status === "same") summary.same += 1;
    else if (file.status === "different") summary.different += 1;
    else summary.added += 1;
  }
  return summary;
}

export function conflicts(plan: PlannedFile[]): PlannedFile[] {
  return plan.filter(
    (file) => file.rel !== "meta.json" && file.status === "different",
  );
}

export function applyTree(
  stageDir: string,
  destDir: string,
  plan: PlannedFile[],
  action: SyncAction,
): void {
  if (action === "abort") throw new Error("Aborted");
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of plan) {
    if (!shouldWrite(file, action)) continue;
    const from = path.join(stageDir, ...file.rel.split("/"));
    writeInside(destDir, file.rel, fs.readFileSync(from));
  }
}

export function replaceDir(stageDir: string, destDir: string): void {
  fs.mkdirSync(path.dirname(destDir), { recursive: true });
  const backup = `${destDir}.bak-${process.pid}`;
  const hadDest = fs.existsSync(destDir);
  if (hadDest) fs.renameSync(destDir, backup);

  try {
    try {
      fs.renameSync(stageDir, destDir);
    } catch (error) {
      const code =
        error instanceof Error && "code" in error ? String(error.code) : "";
      if (code !== "EXDEV" && code !== "EPERM") throw error;
      fs.cpSync(stageDir, destDir, { recursive: true });
      fs.rmSync(stageDir, { recursive: true, force: true });
    }
    if (hadDest) fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (hadDest && !fs.existsSync(destDir) && fs.existsSync(backup)) {
      fs.renameSync(backup, destDir);
    }
    throw error;
  }
}

function shouldWrite(file: PlannedFile, action: SyncAction): boolean {
  if (file.rel === "meta.json") return true;
  switch (action) {
    case "overwrite":
      return true;
    case "update":
      return file.status !== "same";
    case "merge":
      return file.status === "new";
    case "abort":
      return false;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

function walkFiles(dir: string, base = ""): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Refusing to follow symlink in staged output: ${rel}`);
    if (entry.isDirectory()) files.push(...walkFiles(abs, rel));
    else if (entry.isFile()) files.push(rel);
  }
  return files;
}

function sha256File(file: string): string {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}
