import { spawnSync } from "node:child_process";

export function maybePrettier(bundlePath: string, enabled: boolean): void {
  if (!enabled) return;
  const result = spawnSync(
    "npx",
    ["--yes", "prettier", "--write", bundlePath],
    {
      stdio: "inherit",
      shell: false,
    },
  );
  if (result.status !== 0) {
    process.stderr.write("prettier failed; raw bundle was still saved\n");
  }
}
