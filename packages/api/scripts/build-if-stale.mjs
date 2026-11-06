#!/usr/bin/env node
// Rebuilds this package's dist when src is newer than the dist output.
//
// Workspace consumers (e.g. `examples/api`) resolve `@tauri-apps/api` to
// `packages/api/dist` — a build artifact. Nothing in the app build chain
// rebuilds it, so a src edit silently keeps serving the old bundle at
// runtime (seen 2026-10: the two `label` routing fixes landed on 10-12,
// but the September dist kept dropping them until a manual rebuild on
// 10-23 — `setBackgroundColor` colored the invoking window instead of the
// target the whole time). Consumers prepend this to their build/dev step:
// it is a no-op when dist is up to date and a full `pnpm build` when stale.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const pkgRoot = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(pkgRoot, 'src');
const distDir = join(pkgRoot, 'dist');

function newestMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const mtime = entry.isDirectory()
      ? newestMtime(path)
      : statSync(path).mtimeMs;
    if (mtime > newest) newest = mtime;
  }
  return newest;
}

let distTime = 0;
if (existsSync(distDir)) {
  for (const entry of readdirSync(distDir, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    const mtime = statSync(join(distDir, entry.name)).mtimeMs;
    if (mtime > distTime) distTime = mtime;
  }
}

if (newestMtime(srcDir) > distTime) {
  console.log(
    '[packages/api] src is newer than dist — rebuilding @tauri-apps/api…'
  );
  execSync('pnpm build', { cwd: pkgRoot, stdio: 'inherit' });
}
