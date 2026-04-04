import path from "node:path";

import { dataRootDir } from "@/src/lib/data-root";

/** Canonical store under the data root: `skills/` (git + folder imports + loose markdown). */
export function globalSkillsDataDir(cwd: string): string {
  return path.join(dataRootDir(cwd), "skills");
}

/** Legacy repo-root `skills/` (optional merge if present). */
export function legacyRepoSkillsDir(cwd: string): string {
  return path.join(cwd, "skills");
}
