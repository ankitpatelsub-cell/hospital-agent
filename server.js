// server.js — zero-dep server for the Hospital Queue & Check-in Agent.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { intake, callNext, queryPosition, getMemory, checkSurge } = require('./agent-core');

const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
const { limited } = require('./ratelimit');
function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type });
  if (Buffer.isBuffer(body)) return res.end(body);
  if (typeof body === 'string') return res.end(body);
  res.end(JSON.stringify(body));
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && limited(req.socket.remoteAddress)) return send(res, 429, { error: 'rate limit' });
  async function body() { let b = ''; for await (const c of req) b += c; try { return JSON.parse(b || '{}'); } catch { return {}; } }
  if (req.method === 'POST' && url.pathname === '/api/intake') {
    const b = await body();
    const patient = (b.patient || '').trim(); const channel = (b.channel || 'site');
    if (!patient) return send(res, 400, { error: 'no patient' });
    const r = intake(patient, channel);
    return send(res, 200, { steps: r.steps, entry: r.entry, pos: r.pos });
  }
  if (req.method === 'POST' && url.pathname === '/api/call_next') {
    return send(res, 200, callNext());
  }
  if (req.method === 'GET' && url.pathname === '/api/position') {
    const id = url.searchParams.get('id') || '';
    return send(res, 200, queryPosition(id));
  }
  if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, getMemory());
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  const fp = path.join(PUBLIC, p);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) return send(res, 200, fs.readFileSync(fp), MIME[path.extname(fp)] || 'text/plain');
  return send(res, 404, { error: 'not found' });
});
const PORT = 8094;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Hospital Agent on ' + PORT);
  // Surge re-notify loop: if still surging and >5 min since last notify, re-alert.
  setInterval(() => {
    const s = checkSurge();
    if (s.surge) {
      const since = Date.now() - (getMemory().surge.lastNotified || 0);
      if (since > 300000) {
        addNotification({ type: 'surge-reminder', channel: 'voice+sms', waiting: s.waiting });
        getMemory().surge.lastNotified = Date.now();
        console.log('[surge-reminder] still surging:', s.waiting);
      }
    }
  }, 60000);
});
