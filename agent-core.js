// agent-core.js — Hospital Queue & Check-in Agent (bilingual EN/HI/JA, India-ready).
const mem = require('./memory');
const I18N = {
  en: { think: 'intake via', joined: 'Queue number', eta: 'est', surge: 'High load', voice: 'Voice alert: long wait, please wait at home', sms: 'SMS: current wait is', come: 'please come a bit later', none: 'No one to call', call: 'please proceed to desk', notfound: 'Number not found', done: 'done' },
  hi: { think: 'इन्टेक', joined: 'कतार संख्या', eta: 'अनुमानित', surge: 'भीड़ अधिक', voice: 'आवाज़ संदेश: इंतज़ार लंबा, घर पर आराम करें', sms: 'SMS: वर्तमान इंतज़ार', come: 'थोड़ी देर बाद आएँ', none: 'कोई नहीं', call: 'डेस्क पर आएँ', notfound: 'संख्या नहीं मिली', done: 'पूर्ण' },
  ja: { think: '受付', joined: '受付番号', eta: '推定', surge: '混雑', voice: '音声案内: 待ち時間が長いためご自宅でお待ちください', sms: 'SMS: 現在の待ちは', come: '少し遅れてご来院ください', none: '呼び出し対象なし', call: 'ご案内します', notfound: '該当なし', done: '完了' },
};
function intake(patient, channel, locale = 'en') {
  const L = I18N[locale] || I18N.en;
  const entry = mem.joinQueue(patient, channel);
  const steps = [
    { tool: 'think', result: '(' + L.think + ') ' + channel + ': ' + patient },
    { tool: 'join', result: L.joined + ' ' + entry.id + ' (' + entry.channel + ')' },
  ];
  const pos = mem.position(entry.id);
  steps.push({ tool: 'report_position', result: pos.pos + '/' + pos.total + ' · ' + pos.etaMin + ' ' + L.eta });
  const s = mem.checkSurge();
  if (s.surge) {
    steps.push({ tool: 'surge_detected', result: L.surge + ': ' + s.waiting });
    steps.push({ tool: 'notify_voice', result: L.voice + ' (' + s.waiting + ')' });
    steps.push({ tool: 'notify_sms', result: L.sms + ' ' + s.waiting + ' — ' + entry.id + ' ' + L.come });
    mem.addNotification({ type: 'surge', channel: 'voice+sms', waiting: s.waiting, locale });
  } else steps.push({ tool: 'done', result: L.done });
  return { steps, entry, pos };
}
function callNext() {
  const q = mem.nextCall();
  const L = I18N.ja; // staff UI is JP/EN; default ja message kept simple
  if (!q) return { steps: [{ tool: 'done', result: '呼び出し対象なし' }] };
  return { steps: [{ tool: 'call_patient', result: q.id + ' ' + q.patient + ' さん、ご案内します（' + q.channel + '受付）' }] };
}
function queryPosition(id) {
  const p = mem.position(id);
  if (!p) return { steps: [{ tool: 'done', result: '該当する番号が見つかりません' }] };
  return { steps: [{ tool: 'report_position', result: '順番 ' + p.pos + '/' + p.total + '・推定 ' + p.etaMin + '分' }] };
}
module.exports = { intake, callNext, queryPosition, getMemory: mem.getState, checkSurge: mem.checkSurge };
