#!/usr/bin/env node
/**
 * Zero-dependency syntax gate: runs `node --check` over every JS/CJS source in
 * src/, test/, and scripts/. Catches syntax errors in CI before the test suite
 * pays for Electron launches, and keeps `renderer.js` honest without adding a
 * linter dependency.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['src', 'test', 'scripts'];
const EXTS = new Set(['.js', '.cjs', '.mjs']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.tmp-electron-userdata']);

/** @returns {string[]} */
function collectJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) out.push(...collectJsFiles(full));
    } else if (EXTS.has(entry.slice(entry.lastIndexOf('.')))) {
      out.push(full);
    }
  }
  return out;
}

const files = ROOTS.flatMap((root) => collectJsFiles(root));
let failed = 0;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed++;
    console.error(`✗ ${relative('.', file)}`);
    console.error(result.stderr.trim());
  } else {
    console.log(`✓ ${relative('.', file)}`);
  }
}

if (failed > 0) {
  console.error(`\nSyntax check failed for ${failed} file(s).`);
  process.exit(1);
}
console.log(`\nAll ${files.length} files pass node --check.`);
