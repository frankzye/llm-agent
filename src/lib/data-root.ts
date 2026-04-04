import path from "node:path";

const ENV = "LLM-TASK-DATA-PATH";

/**
 * Root for persisted app data (agents, skills catalog, global-settings, a2a inbox).
 * `LLM-TASK-DATA-PATH` overrides; relative values are resolved against `cwd`.
 * When unset, defaults to `cwd` (use e.g. `.data` to keep data under a `.data` folder).
 */
export function dataRootDir(cwd: string): string {
  const raw = process.env[ENV]?.trim();
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
  }
  return path.join(cwd, ".data");
}
