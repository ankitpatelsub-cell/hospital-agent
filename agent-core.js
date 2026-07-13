// agent-core.js — Hospital Queue & Check-in Agent loop.
const mem = require('./memory');

// Channels map to intake methods. Each returns a patient entry + confirmation.
function intake(patient, channel) {
  const entry = mem.joinQueue(patient, channel);
  const steps = [
    { tool: 'think', result: '(思考) ' + channel + 'からの受付: ' + patient },
    { tool: 'join', result: `受付番号 ${entry.id} を発行（${channel}）` },
  ];
  const pos = mem.position(entry.id);
  steps.push({ tool: 'report_position', result: `順番 ${pos.pos}/${pos.total}・推定 ${pos.etaMin}分` });
  // surge check after join
  const s = mem.checkSurge();
  if (s.surge) {
    steps.push({ tool: 'surge_detected', result: `混雑検知: 待ち ${s.waiting}人（閾値${s.threshold}）` });
    steps.push({ tool: 'notify_voice', result: `音声案内: 待ち時間が長いためご自宅でお待ちください（${s.waiting}人）` });
    steps.push({ tool: 'notify_sms', result: `SMS送信: 現在の待ちは${s.waiting}人です。番号${entry.id}の方は少し遅れてご来院ください。` });
    mem.addNotification({ type: 'surge', channel: 'voice+sms', waiting: s.waiting });
  } else {
    steps.push({ tool: 'done', result: '完了' });
  }
  return { steps, entry, pos };
}

// Hospital staff calls the next patient.
function callNext() {
  const q = mem.nextCall();
  if (!q) return { steps: [{ tool: 'done', result: '呼び出し対象なし' }] };
  return { steps: [{ tool: 'call_patient', result: `${q.id} ${q.patient} さん、ご案内します（${q.channel}受付）` }] };
}

// A waiting patient asks their position.
function queryPosition(id) {
  const p = mem.position(id);
  if (!p) return { steps: [{ tool: 'done', result: '該当する番号が見つかりません' }] };
  return { steps: [{ tool: 'report_position', result: `順番 ${p.pos}/${p.total}・推定 ${p.etaMin}分` }] };
}

module.exports = { intake, callNext, queryPosition, getMemory: mem.getState, checkSurge: mem.checkSurge };
