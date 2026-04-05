import fs from "node:fs/promises";
import path from "node:path";

import { agentDataDir, sanitizeAgentId } from "@/src/lib/agent/agent-store";

export type TaskBoardTask = {
  id: string;
  title: string;
  done: boolean;
};

export type TaskBoardState = {
  tasks: TaskBoardTask[];
};

function taskBoardPath(cwd: string, rawAgentId: string): string {
  return path.join(agentDataDir(cwd, sanitizeAgentId(rawAgentId)), "task-board.json");
}

export function normalizeTaskBoardState(raw: unknown): TaskBoardState {
  if (typeof raw !== "object" || raw === null) return { tasks: [] };
  const o = raw as Record<string, unknown>;
  const tasksRaw = o.tasks;
  if (!Array.isArray(tasksRaw)) return { tasks: [] };
  const tasks: TaskBoardTask[] = [];
  for (const t of tasksRaw) {
    if (typeof t !== "object" || t === null) continue;
    const x = t as Record<string, unknown>;
    const id = typeof x.id === "string" ? x.id : "";
    const title = typeof x.title === "string" ? x.title : "";
    const done = x.done === true;
    if (!id) continue;
    tasks.push({ id, title, done });
  }
  return { tasks };
}

export async function readTaskBoardState(
  cwd: string,
  rawAgentId: string,
): Promise<TaskBoardState> {
  const p = taskBoardPath(cwd, rawAgentId);
  try {
    const raw = await fs.readFile(p, "utf8");
    return normalizeTaskBoardState(JSON.parse(raw) as unknown);
  } catch {
    return { tasks: [] };
  }
}

export async function writeTaskBoardState(
  cwd: string,
  rawAgentId: string,
  state: TaskBoardState,
): Promise<void> {
  const id = sanitizeAgentId(rawAgentId);
  const dir = agentDataDir(cwd, id);
  await fs.mkdir(dir, { recursive: true });
  const normalized = normalizeTaskBoardState(state);
  await fs.writeFile(
    path.join(dir, "task-board.json"),
    JSON.stringify(normalized, null, 2),
    "utf8",
  );
}
