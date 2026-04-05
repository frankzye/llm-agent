#!/usr/bin/env node
/**
 * Builds a minimal package under `npm-publish/`:
 *   - `bin/llm-agent.js`
 *   - `.next/standalone/**` (server + traced files + `.next/static`; **not** nested `node_modules`)
 *   - `README.md`, `LICENSE` (if present)
 *   - `package.json` with **dependencies** so `npm install -g` installs `next` / `react` / `react-dom`.
 *
 * npm **never includes** `node_modules` in the published tarball, so `require("next")` in
 * `server.js` must resolve via the package root `node_modules` after install.
 *
 * Publish: `npm publish ./npm-publish --access public`
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const out = path.join(root, "npm-publish");

const standaloneServer = path.join(root, ".next", "standalone", "server.js");
const standaloneStatic = path.join(root, ".next", "standalone", ".next", "static");

async function main() {
  try {
    await fs.access(standaloneServer);
  } catch {
    console.error(
      "prepare-npm-publish: missing .next/standalone/server.js — run `npm run build` first.",
    );
    process.exit(1);
  }
  try {
    await fs.access(standaloneStatic);
  } catch {
    console.error(
      "prepare-npm-publish: missing .next/standalone/.next/static — ensure postbuild (copy-standalone-assets) ran.",
    );
    process.exit(1);
  }

  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(path.join(out, "bin"), { recursive: true });

  const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));

  await fs.copyFile(
    path.join(root, "bin", "llm-agent.js"),
    path.join(out, "bin", "llm-agent.js"),
  );

  await fs.mkdir(path.join(out, ".next"), { recursive: true });
  await fs.cp(path.join(root, ".next", "standalone"), path.join(out, ".next", "standalone"), {
    recursive: true,
  });

  const nestedNm = path.join(out, ".next", "standalone", "node_modules");
  await fs.rm(nestedNm, { recursive: true, force: true });

  for (const f of ["README.md", "LICENSE"]) {
    try {
      await fs.copyFile(path.join(root, f), path.join(out, f));
    } catch {
      /* optional */
    }
  }

  /** Merge so `next` resolves if it only appears under `peerDependencies` in root `package.json`. */
  const rootDeps = {
    ...(pkg.peerDependencies && typeof pkg.peerDependencies === "object"
      ? pkg.peerDependencies
      : {}),
    ...(pkg.dependencies && typeof pkg.dependencies === "object" ? pkg.dependencies : {}),
  };
  const pick = (name) => rootDeps[name];
  const publishPkg = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    license: pkg.license,
    author: pkg.author,
    homepage: pkg.homepage,
    bugs: pkg.bugs,
    repository: pkg.repository,
    keywords: Array.isArray(pkg.keywords)
      ? pkg.keywords
      : ["next", "llm", "chat", "standalone"],
    engines: { node: ">=20" },
    bin: { "llm-agent": "./bin/llm-agent.js" },
    dependencies: {
      next: pick("next")
    },
  };

  for (const [name, spec] of Object.entries(publishPkg.dependencies)) {
    if (typeof spec !== "string" || !spec.trim()) {
      console.error(
        `prepare-npm-publish: root package.json must declare a non-empty "${name}" dependency (standalone server requires it).`,
      );
      process.exit(1);
    }
  }

  await fs.writeFile(
    path.join(out, "package.json"),
    `${JSON.stringify(publishPkg, null, 2)}\n`,
  );

  console.log(`prepare-npm-publish: wrote ${out} (${pkg.name}@${pkg.version})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
