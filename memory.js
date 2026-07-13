// memory.js — hospital queue + notifications state.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'memory.json');
function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {
    return { queue: [], notifications: [], surge: { active: false, lastNotified: 0 }, cfg: { surgeThreshold: 8 } };
  }
}
let state = load();
function save() { fs.writeFileSync(FILE, JSON.stringify(state, null, 2)); }

function joinQueue(patient, channel) {
  const pos = state.queue.length + 1;
  const entry = { id: 'Q' + String(pos).padStart(3, '0'), patient, channel, joinedAt: Date.now(), status: 'waiting', phone: patient.match(/[\d\-+]{7,}/)?.[0] || '+810000000000' };
  state.queue.push(entry);
  save();
  return entry;
}
function position(id) { const i = state.queue.findIndex(q => q.id === id); return i < 0 ? null : { pos: i + 1, total: state.queue.length, etaMin: (i + 1) * 7 }; }
function complete(id) { const q = state.queue.find(x => x.id === id); if (q) { q.status = 'done'; save(); } return q; }
function nextCall() { const q = state.queue.find(x => x.status === 'waiting'); if (q) { q.status = 'called'; save(); } return q; }

// Surge detection: if waiting count >= threshold, flag + record a notification event.
function checkSurge() {
  const waiting = state.queue.filter(q => q.status === 'waiting').length;
  const surge = waiting >= state.cfg.surgeThreshold;
  if (surge && !state.surge.active) {
    state.surge.active = true;
    state.surge.lastNotified = Date.now();
  }
  if (!surge) state.surge.active = false;
  return { surge, waiting, threshold: state.cfg.surgeThreshold };
}
function addNotification(n) { state.notifications.unshift({ ts: new Date().toISOString(), ...n }); if (state.notifications.length > 100) state.notifications = state.notifications.slice(0, 100); save(); }
function getState() { return state; }
module.exports = { joinQueue, position, complete, nextCall, checkSurge, addNotification, getState };
