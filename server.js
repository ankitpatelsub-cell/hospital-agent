// server.js — Hospital: public appointment booking site + DB + staff dashboard (gated).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { intake, callNext, queryPosition, getMemory, checkSurge } = require('./agent-core');
const { addNotification } = require('./memory');
const DB = require('./db');

const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
const { limited } = require('./ratelimit');
const dash = require('./dashauth');
try { const ep = path.join(__dirname, '.env'); if (fs.existsSync(ep)) for (const line of fs.readFileSync(ep, 'utf8').split('\n')) { const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
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
  const authed = () => dash.checkToken(req.headers['x-auth-token'] || (req.headers['cookie'] || '').match(/dash=([^;]+)/)?.[1] || '');

  // ---- Public data (open) ----
  if (req.method === 'GET' && url.pathname === '/api/departments') return send(res, 200, DB.departments());
  if (req.method === 'GET' && url.pathname === '/api/doctors') {
    const dept = url.searchParams.get('dept');
    return send(res, 200, dept ? DB.doctorsByDept(dept) : DB.doctors());
  }
  if (req.method === 'GET' && url.pathname === '/api/stats') return send(res, 200, DB.stats());
  if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, DB.stats());
  if (req.method === 'GET' && url.pathname === '/api/overview') return send(res, 200, DB.stats());

  // ---- Public booking (open) ----
  if (req.method === 'POST' && url.pathname === '/api/book') {
    const b = await body();
    if (!b.patient || !b.phone) return send(res, 400, { error: 'name + phone required' });
    const r = DB.book(b);
    // Also push into live queue for surge tracking
    try { intake(b.patient, 'website', b.locale || 'en'); } catch {}
    return send(res, 200, { ok: true, id: r.id, token: r.token, message: `Appointment confirmed. Your token is #${r.token}.` });
  }

  // ---- Legacy queue endpoints ----
  if (req.method === 'POST' && url.pathname === '/api/intake') {
    const b = await body();
    const patient = (b.patient || '').trim(); const channel = (b.channel || 'site'); const locale = (b.locale || 'en');
    if (!patient) return send(res, 400, { error: 'no patient' });
    const r = intake(patient, channel, locale);
    return send(res, 200, { steps: r.steps, entry: r.entry, pos: r.pos });
  }
  if (req.method === 'GET' && url.pathname === '/api/position') return send(res, 200, queryPosition(url.searchParams.get('id') || ''));

  // ---- Auth ----
  if (req.method === 'POST' && url.pathname === '/api/dash-login') {
    const b = await body();
    if (dash.checkPass(b.password)) return send(res, 200, { token: dash.makeToken() });
    return send(res, 401, { error: 'unauthorized' });
  }

  // ---- Staff-only (gated) ----
  if (req.method === 'GET' && url.pathname === '/api/appointments') {
    if (!authed()) return send(res, 401, { error: 'unauthorized' });
    return send(res, 200, DB.appointments());
  }
  if (req.method === 'POST' && url.pathname === '/api/call_next') {
    if (!authed()) return send(res, 401, { error: 'unauthorized' });
    return send(res, 200, callNext());
  }
  if (req.method === 'POST' && url.pathname === '/api/appointment/status') {
    if (!authed()) return send(res, 401, { error: 'unauthorized' });
    const b = await body(); DB.setStatus(b.id, b.status); return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && url.pathname === '/api/state') {
    if (!authed()) return send(res, 401, { error: 'unauthorized' });
    return send(res, 200, getMemory());
  }

  // ---- Pages: / public, /admin gated ----
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  if (p === '/admin' || p === '/admin.html') {
    if (!authed()) return send(res, 200, dash.LOGIN_HTML, 'text/html');
    p = '/admin.html';
  }
  const fp = path.join(PUBLIC, p);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) return send(res, 200, fs.readFileSync(fp), MIME[path.extname(fp)] || 'text/plain');
  return send(res, 404, { error: 'not found' });
});
const PORT = 8094;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Hospital Agent on ' + PORT);
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
