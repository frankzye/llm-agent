#!/usr/bin/env node
/**
 * Next.js `output: "standalone"` does not bundle client static assets into
 * `.next/standalone/`. Copy `.next/static` and `public` so `/_next/static/*`
 * resolves when running `.next/standalone/server.js` (e.g. via `bin/llm-agent.js`).
 * @see https://nextjs.org/docs/app/building-your-application/deploying#static-assets
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const serverJs = path.join(standalone, "server.js");

async function main() {
  try {
    await fs.access(serverJs);
  } catch {
    console.error(
      "copy-standalone-assets: .next/standalone/server.js not found; run `next build` first.",
    );
    process.exit(1);
  }

  const staticSrc = path.join(root, ".next", "static");
  const staticDest = path.join(standalone, ".next", "static");
  try {
    await fs.access(staticSrc);
  } catch {
    console.error(
      "copy-standalone-assets: .next/static missing; build may have failed.",
    );
    process.exit(1);
  }

  await fs.mkdir(path.dirname(staticDest), { recursive: true });
  await fs.rm(staticDest, { recursive: true, force: true });
  await fs.cp(staticSrc, staticDest, { recursive: true });
  console.log(
    "copy-standalone-assets: copied .next/static -> .next/standalone/.next/static",
  );

  const publicSrc = path.join(root, "public");
  const publicDest = path.join(standalone, "public");
  try {
    await fs.access(publicSrc);
    await fs.rm(publicDest, { recursive: true, force: true });
    await fs.cp(publicSrc, publicDest, { recursive: true });
    console.log(
      "copy-standalone-assets: copied public -> .next/standalone/public",
    );
  } catch {
    /* no public dir — optional */
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
