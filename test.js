// test.js — minimal smoke tests for the Hospital Queue Agent.
const assert = require('assert');
const mem = require('./memory');
const { intake, callNext } = require('./agent-core');

function reset() { mem.getState().queue = []; mem.getState().notifications = []; mem.getState().surge = { active: false, lastNotified: 0 }; }

(async () => {
  reset();
  // 1. intake assigns queue number + position
  const r = intake('山田', 'site');
  assert(r.entry.id === 'Q001', 'first id should be Q001');
  assert(r.pos.pos === 1 && r.pos.total === 1, 'position 1/1');
  console.log('✓ intake + position');

  // 2. surge fires when waiting >= threshold (default 8)
  for (let i = 0; i < 9; i++) intake('p' + i, 'whatsapp');
  const s = mem.checkSurge();
  assert(s.waiting >= 8 && s.surge === true, 'surge should be active');
  assert(mem.getState().notifications.length >= 1, 'should have notification(s)');
  console.log('✓ surge detection + notify (' + mem.getState().notifications.length + ' notifications)');

  // 3. call_next advances a patient
  const c = callNext();
  assert(c.steps[0].tool === 'call_patient', 'should call a patient');
  console.log('✓ call_next');

  console.log('\nALL HOSPITAL TESTS PASSED');
  process.exit(0);
})().catch(e => { console.error('TEST FAILED:', e.message); process.exit(1); });
