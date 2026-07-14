// claude_worker.js — local Claude CLI wrapper for text understanding (free, authenticated).
const { execFileSync } = require('child_process');
function claudeTask(prompt, { timeout = 60 } = {}) {
  try {
    const out = execFileSync('/root/.local/bin/claude', ['--print', '-p', prompt, '--allowedTools', '', '--model', 'sonnet'], { encoding: 'utf8', timeout: timeout * 1000, maxBuffer: 4 * 1024 * 1024 });
    return { ok: true, text: out.trim() };
  } catch (e) { return { ok: false, text: (e.stderr || e.message || '').toString().split('\n')[0] }; }
}
module.exports = { claudeTask };
