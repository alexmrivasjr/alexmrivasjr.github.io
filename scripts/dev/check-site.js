// Static checks for the site and scripts. No dependencies, so CI runs it
// without `npm ci`. Exits non-zero on any failure.
//
//   1. Every root-relative or relative href/src in our HTML resolves to a file.
//   2. Every JSON config/data file (and the web manifest) parses.
//   3. Every JS file passes `node --check` (syntax only, no execution).
//
// Usage: npm run check

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKIP_DIRS = new Set([".git", "node_modules"]);
const failures = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const rel = (f) => path.relative(ROOT, f);

// 1. Internal links
const ATTR = /\s(?:href|src)="([^"]+)"/g;
for (const file of files.filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(file, "utf8");
  for (const [, raw] of html.matchAll(ATTR)) {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(raw)) continue; // external, mailto:, anchors
    const clean = decodeURI(raw.split(/[?#]/)[0]);
    let target = clean.startsWith("/") ? path.join(ROOT, clean) : path.resolve(path.dirname(file), clean);
    if (clean.endsWith("/") || (existsSync(target) && statSync(target).isDirectory())) {
      target = path.join(target, "index.html");
    }
    if (!existsSync(target)) failures.push(`${rel(file)}: broken link "${raw}"`);
  }
}

// 2. JSON validity
for (const file of files.filter((f) => /\.(json|webmanifest)$/.test(f))) {
  try {
    JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    failures.push(`${rel(file)}: invalid JSON (${err.message})`);
  }
}

// 3. JS syntax
for (const file of files.filter((f) => f.endsWith(".js"))) {
  const res = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (res.status !== 0) failures.push(`${rel(file)}: syntax error\n${res.stderr.trim()}`);
}

if (failures.length) {
  console.error(`✗ ${failures.length} check(s) failed:\n` + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log(`✓ site checks passed (${files.length} files scanned)`);
