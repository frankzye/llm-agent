import { NextResponse } from "next/server";

import { deleteSkillsFromCatalog } from "@/src/lib/agent/skills-catalog";
import { globalSkillsDataDir } from "@/src/lib/global-skills-paths";

export async function POST(req: Request) {
  let skillIds: string[];
  try {
    const body = (await req.json()) as { skillIds?: unknown };
    skillIds = Array.isArray(body.skillIds)
      ? body.skillIds.filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        )
      : [];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (skillIds.length === 0) {
    return NextResponse.json(
      { error: "skillIds must be a non-empty array of strings" },
      { status: 400 },
    );
  }

  const cwd = process.cwd();
  const skillsRoot = globalSkillsDataDir(cwd);

  try {
    const { deleted, notFound } = await deleteSkillsFromCatalog(skillsRoot, skillIds);
    return NextResponse.json({
      ok: true,
      deleted,
      notFound,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
