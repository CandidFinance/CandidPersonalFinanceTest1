// Reads the tail of a session transcript and returns the main thread's current
// context size in tokens (input + cache read + cache write of the last reply).
// Only the tail is read: transcripts here reach 100MB+.
import fs from 'node:fs';

export function contextTokens(transcriptPath, tailBytes = 4 * 1024 * 1024) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
  const size = fs.statSync(transcriptPath).size;
  const start = Math.max(0, size - tailBytes);
  const fd = fs.openSync(transcriptPath, 'r');
  const buf = Buffer.alloc(size - start);
  fs.readSync(fd, buf, 0, buf.length, start);
  fs.closeSync(fd);
  const lines = buf.toString('utf8').split('\n');
  if (start > 0) lines.shift(); // first line is probably partial
  for (let i = lines.length - 1; i >= 0; i--) {
    let o;
    try { o = JSON.parse(lines[i]); } catch { continue; }
    if (o.type !== 'assistant' || o.isSidechain) continue;
    const u = o.message?.usage;
    if (!u) continue;
    return (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  }
  return null;
}

export async function readStdinJson() {
  let s = '';
  for await (const chunk of process.stdin) s += chunk;
  try { return JSON.parse(s); } catch { return {}; }
}
