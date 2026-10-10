// Runs `node --check` across every .js file to prove there are no syntax errors.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const skip = new Set(['node_modules', 'auth', 'session', '.git']);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = walk(root);
let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    console.log('ok   ' + path.relative(root, f));
  } catch (err) {
    failed += 1;
    console.error('FAIL ' + path.relative(root, f) + '\n' + err.stderr?.toString());
  }
}
console.log(`\n${files.length - failed}/${files.length} files passed syntax check`);
process.exit(failed ? 1 : 0);
