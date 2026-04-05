#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const pkgRoot = path.resolve(__dirname, "..");
const port = process.env.PORT || "3000";
const host = process.env.HOSTNAME || "0.0.0.0";
const standaloneServer = path.join(pkgRoot, ".next", "standalone", "server.js");
/** Standalone server only serves `/_next/static/*` if `.next/static` was copied here (see `postbuild`). */
const standaloneStatic = path.join(
  pkgRoot,
  ".next",
  "standalone",
  ".next",
  "static",
);

const args = process.argv.slice(2);
let command = process.execPath;
let commandArgs;

let useStandalone =
  fs.existsSync(standaloneServer) && fs.existsSync(standaloneStatic);
if (fs.existsSync(standaloneServer) && !fs.existsSync(standaloneStatic)) {
  console.warn(
    "[llm-agent] Standalone server found but `.next/standalone/.next/static` is missing.\n" +
      "  Run `pnpm build` (runs copy-standalone-assets after next build), or:\n" +
      "  `node scripts/copy-standalone-assets.mjs`\n" +
      "  Falling back to `next start` (uses `.next/static` at project root).",
  );
}

if (useStandalone) {
  commandArgs = [standaloneServer, ...args];
} else {
  let nextBin;
  try {
    nextBin = require.resolve("next/dist/bin/next");
  } catch {
    console.error(
      "[llm-agent] No standalone bundle and no `next` package (npm publish build missing?).\n" +
        "  Install from npm: use the published package built with `npm run prepare:npm`.\n" +
        "  From source: run `npm run build` then `./bin/llm-agent.js` again.",
    );
    process.exit(1);
  }
  commandArgs =
    args.length > 0
      ? [nextBin, ...args]
      : [nextBin, "start", "-p", port, "-H", host];
}

const child = spawn(command, commandArgs, {
  cwd: pkgRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

