// Stop hook: if engine, script or API files have changed since tests last
// passed, run `npm test` before Claude finishes, and send failures back to it.
// Skips when nothing relevant changed, so most turns cost nothing.
import { execSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readStdinJson } from './context-size.mjs';

const WATCHED = ['src/lib', 'scripts', 'api', 'server'];

const input = await readStdinJson();
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const cacheDir = path.join(root, '.claude', '.cache');
const passFile = path.join(cacheDir, 'tests-passed');
const failFile = path.join(cacheDir, 'tests-failed');
const git = args => execSync(`git ${args}`, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const paths = WATCHED.join(' ');
const status = git(`status --porcelain -- ${paths}`).trim();
if (!status) process.exit(0);

// Fingerprint the working-tree state of the watched paths.
const untracked = git(`ls-files --others --exclude-standard -- ${paths}`).split('\n').filter(Boolean);
const h = crypto.createHash('sha1').update(git(`diff HEAD -- ${paths}`));
for (const f of untracked) { try { h.update(f).update(fs.readFileSync(path.join(root, f))); } catch {} }
const hash = h.digest('hex');

const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
if (read(passFile) === hash) process.exit(0);
// Already reported this exact failure and nothing has changed since: let Claude stop.
if (input.stop_hook_active && read(failFile) === hash) process.exit(0);

const run = spawnSync('npm test', { cwd: root, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
fs.mkdirSync(cacheDir, { recursive: true });
if (run.status === 0) {
  fs.writeFileSync(passFile, hash);
  process.exit(0);
}
fs.writeFileSync(failFile, hash);
const out = `${run.stdout || ''}${run.stderr || ''}`;
const failures = out.split('\n').filter(l => /^\s*✖|AssertionError|Error:|^\s*(expected|actual):/.test(l)).slice(0, 30);
const tail = (failures.length ? failures : out.split('\n').slice(-30)).join('\n');
console.log(JSON.stringify({
  decision: 'block',
  reason: `npm test fails after changes to ${WATCHED.join(', ')}. Fix the cause (or, for a deliberate engine change, rebuild the characterisation snapshot and review its diff) before finishing:\n${tail}`,
}));
