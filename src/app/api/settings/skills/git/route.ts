import { NextResponse } from "next/server";

import { addGlobalSkillsFromGit } from "@/src/lib/agent/skills-git";
import { patchGlobalSettings } from "@/src/lib/global-settings";

export async function POST(req: Request) {
  let gitUrl: string;
  let branch: string | undefined;
  let subpath: string | null | undefined;
  try {
    const body = (await req.json()) as {
      gitUrl?: string;
      branch?: string;
      subpath?: string | null;
    };
    gitUrl = typeof body?.gitUrl === "string" ? body.gitUrl.trim() : "";
    branch = typeof body?.branch === "string" ? body.branch.trim() : undefined;
    subpath =
      body?.subpath === null
        ? null
        : typeof body?.subpath === "string"
          ? body.subpath
          : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!gitUrl) {
    return NextResponse.json({ error: "gitUrl required" }, { status: 400 });
  }

  const cwd = process.cwd();

  try {
    await addGlobalSkillsFromGit(cwd, gitUrl, { branch, subpath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const settings = await patchGlobalSettings(cwd, {
    skillsGitUrl: gitUrl,
    skillsGitLastSyncedAt: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    settings,
    note:
      "Repo subfolder top-level items are merged into the data-root skills folder (add/override). Existing skills not present in the repo are unchanged; from-folder/ is preserved.",
  });
}
