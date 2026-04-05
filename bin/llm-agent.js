#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const pkgRoot = path.resolve(__dirname, "..");
const port = process.env.PORT || "3000";
const host = process.env.HOSTNAME || "0.0.0.0";
const standaloneServer = path.join(pkgRoot, ".next", "standalone", "server.js");

const args = process.argv.slice(2);
let command = process.execPath;
let commandArgs;

if (fs.existsSync(standaloneServer)) {
  commandArgs = [standaloneServer, ...args];
} else {
  const nextBin = require.resolve("next/dist/bin/next");
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

