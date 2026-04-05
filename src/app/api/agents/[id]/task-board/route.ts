import { NextResponse } from "next/server";

import { readAgentConfig } from "@/src/lib/agent/agent-store";
import {
  normalizeTaskBoardState,
  readTaskBoardState,
  writeTaskBoardState,
  type TaskBoardState,
} from "@/src/lib/agent/task-board-store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const cwd = process.cwd();
  const existing = await readAgentConfig(cwd, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const state = await readTaskBoardState(cwd, id);
  return NextResponse.json(state);
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const cwd = process.cwd();
  const existing = await readAgentConfig(cwd, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const state = normalizeTaskBoardState(body) as TaskBoardState;
  await writeTaskBoardState(cwd, id, state);
  return NextResponse.json(state);
}
