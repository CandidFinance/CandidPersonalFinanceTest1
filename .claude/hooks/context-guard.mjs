// UserPromptSubmit hook: warns (to the user only, nothing added to Claude's
// context) when the session's context is large enough that every turn is
// expensive and quality is dropping. Never blocks the prompt.
import { contextTokens, readStdinJson } from './context-size.mjs';

const WARN_AT = 200_000;

const input = await readStdinJson();
const tokens = contextTokens(input.transcript_path);
if (tokens && tokens >= WARN_AT) {
  const k = Math.round(tokens / 1000);
  console.log(JSON.stringify({
    systemMessage: `Context is at ${k}k tokens, and every turn re-reads all of it. If this is a new task, run /handoff and then /clear.`,
  }));
}
