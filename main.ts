// VICE FRAME 5 — hand-in program.
//
// What lives in this repository is a static web app under app/ plus a set of
// JPEG renders under screenshots/. The grader does not read the repo directly:
// it runs this file and inspects whatever appears in the output directory.
// So the job here is deliberately boring and explicit:
//
//   1. resolve where the output directory is,
//   2. mirror app/ and screenshots/ into it,
//   3. ask the vendored dossier builder to summarise the result and store
//      that summary as dossier.json.
//
// Node 22, standard library only — nothing to install, nothing to build.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join as joinPath } from 'node:path';
import { fileURLToPath as toFsPath } from 'node:url';

import { buildDossier } from './vendor/makefun-app.ts';

// The folder this file sits in. Everything the entry ships is addressed
// relative to it, so the program works from any working directory.
const repoRoot = toFsPath(new URL('.', import.meta.url));

// The grader mounts its own output location; locally MAKEFUN_OUTPUT_DIR
// points the same code at a scratch folder instead.
function resolveOutputDir(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return fromEnv;
  return '/output';
}

// Copy one shipped folder (app/ or screenshots/) into the output tree.
// A missing screenshots/ folder is tolerated: the dossier builder will
// complain about it later with a clearer message than a raw copy error.
function mirrorFolder(name: string, targetRoot: string): void {
  const sourceDir = joinPath(repoRoot, name);
  const targetDir = joinPath(targetRoot, name);
  mkdirSync(targetDir, { recursive: true });
  if (existsSync(sourceDir)) {
    cpSync(sourceDir, targetDir, { recursive: true });
  }
}

function main(): void {
  const outputRoot = resolveOutputDir();

  mkdirSync(outputRoot, { recursive: true });
  mirrorFolder('app', outputRoot);
  mirrorFolder('screenshots', outputRoot);

  // Caps mirror the competition gate exactly. Only the text budget changes
  // the dossier bytes; the rest make this program refuse an entry the
  // scorer would refuse anyway (too many shots, an oversized shot, too
  // many or too large app files, or an overlong path under app/).
  const dossierCaps = {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  } as const;

  const dossierBytes = buildDossier(outputRoot, dossierCaps);
  if (dossierBytes.length === 0) {
    throw new Error('dossier builder returned no bytes; refusing to hand in an empty summary');
  }
  writeFileSync(joinPath(outputRoot, 'dossier.json'), dossierBytes);
  console.log(`VICE FRAME 5 handed in: app/ + screenshots/ -> ${outputRoot} (dossier ${dossierBytes.length} bytes)`);
}

// A failed hand-in should say so plainly and exit non-zero, rather than
// leaving a half-copied output directory that looks successful.
try {
  main();
} catch (problem) {
  console.error(`VICE FRAME 5 hand-in failed: ${(problem as Error).message}`);
  process.exitCode = 1;
}
