'use strict';
/* ============ bank statements (HDFC Excel) ============
   The bank's own statement is imported as it is. Its rows are never edited: who each row belongs to and
   what it was for is your decision, stored separately in S.review, and nothing counts toward a brother or
   a fund until you approve it. */

// What a reviewed part can be. The value is the Purpose the engine already understands.
const REVIEW_PURPOSES = {
  in: [['Family Expenses', 'Household contribution'], ['Investments', 'Investment contribution'], ['Additional Expense', 'Special contribution'],
    ['Internal Transfer', 'Transfer between family accounts'], ['Bank Charges', 'Bank interest or refund'], ['Outside Fund', 'Outside the family fund']],
  out: [['Family Expenses', 'Household expense'], ['Medical Expense', 'Medical expense'], ['Investments', 'Investment payout'], ['Additional Expense', 'Special expense'],
    ['Internal Transfer', 'Transfer between family accounts'], ['Bank Charges', 'Bank charge'], ['Outside Fund', 'Outside the family fund']]
};
const purposeLabel = (p, amt) => ((REVIEW_PURPOSES[amt >= 0 ? 'in' : 'out'].find(x => x[0] === p) || [p, p])[1]);
const whoOptions = () => [...S.cfg.brothers, S.cfg.spender, ...(S.cfg.banks || []), 'Someone else'].filter((x, i, a) => x && a.indexOf(x) === i);

/* ---- reading the file ---- */
function stmtDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v > 20000 && v < 80000 ? serialToISO(v) : null;
  if (v instanceof Date) return parseDateCell(v);
  const m = String(v).trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? '20' + m[3] : m[3], iso = y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return validISO(iso) ? iso : null;
}
/* Returns null when the file is not a bank statement (so it can be read as your own workbook instead). */
function parseBankStatement(buf, fileName) {
  if (typeof XLSX === 'undefined') throw new Error('The spreadsheet reader did not load. Reload the app.');
  const wb = XLSX.read(buf, {type: 'array'});
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {header: 1, raw: true, defval: null});
    let hi = -1, h = null;
    for (let i = 0; i < Math.min(rows.length, 60); i++) {
      const hh = (rows[i] || []).map(normH);
      if (hh.includes('date') && hh.includes('narration') && hh.includes('closingbalance') && (hh.includes('withdrawalamt') || hh.includes('withdrawal'))) { hi = i; h = hh; break; }
    }
    if (hi < 0) continue;
    const col = (...ks) => { for (const k of ks) { const j = h.indexOf(k); if (j >= 0) return j; } return -1; };
    const ci = {date: col('date'), desc: col('narration'), ref: col('chqrefno', 'refno', 'chequeno'), vdate: col('valuedt', 'valuedate'), wd: col('withdrawalamt', 'withdrawal'), dep: col('depositamt', 'deposit'), bal: col('closingbalance')};
    let period = null;
    for (let i = 0; i < hi; i++) {
      const line = (rows[i] || []).filter(x => x != null).join(' ');
      const m = line.match(/statement\s+from\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*to\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (m) { period = {from: stmtDate(m[1]), to: stmtDate(m[2])}; break; }
    }
    const out = [], bad = [];
    let summary = null;
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i] || [], cell = k => (k >= 0 ? r[k] : null);
      const text = r.filter(x => x != null && x !== '').map(String).join(' ').trim();
      if (!text) continue;
      if (/statement\s+summary/i.test(text)) {                         // the bank's own totals, used as a check
        for (let j = i + 1; j < Math.min(rows.length, i + 6) && !summary; j++) {
          const nums = (rows[j] || []).map(parseAmt).filter(x => x != null);
          if (nums.length >= 6) summary = {opening: nums[0], debits: nums[3], credits: nums[4], closing: nums[5]};
        }
        break;
      }
      const raw = cell(ci.date);
      if (typeof raw === 'string' && /^\*+$/.test(raw.trim())) { if (out.length) break; continue; }   // the ***** lines around the table
      const date = stmtDate(raw);
      if (!date) {                                                     // a long narration continued on the next line
        if (out.length && cell(ci.desc) && cell(ci.bal) == null) { out[out.length - 1].desc += String(cell(ci.desc)).trim(); continue; }
        if (out.length) bad.push({row: i + 1, text: text.slice(0, 80)});
        continue;
      }
      const wd = parseAmt(cell(ci.wd)) || 0, dep = parseAmt(cell(ci.dep)) || 0, bal = parseAmt(cell(ci.bal));
      if (bal == null) { bad.push({row: i + 1, text: text.slice(0, 80)}); continue; }
      out.push({date, desc: String(cell(ci.desc) ?? '').trim(), ref: String(cell(ci.ref) ?? '').trim(), vdate: stmtDate(cell(ci.vdate)) || date, wd: r2(wd), dep: r2(dep), amt: r2(dep - wd), bal: r2(bal), row: i + 1});
    }
    if (!out.length) throw new Error('This looks like a bank statement, but no transactions were found in it.');
    // the running balance must hold from row to row; a break means a row is missing or changed
    const breaks = [];
    for (let k = 1; k < out.length; k++) if (Math.abs(r2(out[k - 1].bal + out[k].amt) - out[k].bal) > 0.005) breaks.push({row: out[k].row, date: out[k].date, expected: r2(out[k - 1].bal + out[k].amt), found: out[k].bal});
    const seen = {};
    for (const t of out) { const base = ['B', t.date, t.ref, t.amt, t.bal].join('|'); seen[base] = (seen[base] || 0) + 1; t.id = base + '#' + seen[base]; t.file = fileName; }
    const opening = r2(out[0].bal - out[0].amt), closing = out[out.length - 1].bal;
    const credits = r2(out.reduce((a, t) => a + t.dep, 0)), debits = r2(out.reduce((a, t) => a + t.wd, 0));
    const summaryOK = !summary || (Math.abs(summary.opening - opening) < 0.01 && Math.abs(summary.closing - closing) < 0.01 && Math.abs(summary.credits - credits) < 0.01 && Math.abs(summary.debits - debits) < 0.01);
    return {rows: out, bad, breaks, period: period || {from: out[0].date, to: out[out.length - 1].date}, opening, closing, credits, debits, summary, summaryOK, file: fileName, sheet: name};
  }
  return null;
}

/* ---- deciding what is new ---- */
/* the smallest group of 2 to 6 items whose amounts add up to the target, or null */
function subsetSum(items, target) {
  const n = items.length;
  for (let k = 2; k <= Math.min(6, n); k++) {
    const idx = Array.from({length: k}, (_, i) => i);
    for (;;) {
      if (Math.abs(idx.reduce((a, i) => a + items[i].amt, 0) - target) < 0.005) return idx.map(i => items[i]);
      let i = k - 1; while (i >= 0 && idx[i] === n - k + i) i--;
      if (i < 0) break;
      idx[i]++; for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
    }
  }
  return null;
}
function planStatementImport(p) {
  const have = new Set(S.stmt.map(t => t.id));
  const dupes = p.rows.filter(t => have.has(t.id));
  // rows your Excel history already has (same date and amount) are not added twice
  const wbLast = S.tx.reduce((m, t) => t.date > m ? t.date : m, '');
  const byDate = {}; for (const t of S.tx) (byDate[t.date] = byDate[t.date] || []).push({amt: r2(t.amt), used: false});
  const inWb = [], maybe = [];
  for (const t of p.rows) {
    if (have.has(t.id)) continue;
    const m = wbLast && t.date <= wbLast ? (byDate[t.date] || []).find(x => !x.used && x.amt === t.amt) : null;
    if (m) { m.used = true; inWb.push(t); } else maybe.push(t);
  }
  // one bank row that the Excel history recorded as several lines (a deposit split between household and
  // investment, say): the lines of that day that add up to it are the same money
  const fresh = [];
  for (const t of maybe) {
    const left = wbLast && t.date <= wbLast ? (byDate[t.date] || []).filter(x => !x.used) : [];
    const combo = left.length >= 2 && left.length <= 12 ? subsetSum(left, t.amt) : null;
    if (combo) { combo.forEach(x => { x.used = true; }); inWb.push(t); } else fresh.push(t);
  }
  // hand entries this statement now confirms: same amount, within 5 days; your who/what for them is kept
  const hand = S.stmt.filter(t => t.manual), used = new Set(), matched = [];
  for (const t of fresh) {
    const m = hand.find(h => !used.has(h.id) && h.amt === t.amt && Math.abs(Date.parse(h.date) - Date.parse(t.date)) <= 5 * 864e5);
    if (m) { used.add(m.id); matched.push([m, t]); }
  }
  const missingHand = hand.filter(h => !used.has(h.id) && h.date >= p.period.from && h.date <= p.period.to);
  // does the statement continue from the balance the app already has?
  let gap = null, appBefore = null, stmtBefore = null;
  const existing = S.tx.length + S.stmt.length;
  if (fresh.length && existing) {
    const first = fresh[0], idx = p.rows.indexOf(first);
    stmtBefore = r2(first.bal - first.amt);
    appBefore = r2([...S.tx, ...S.stmt.filter(t => !used.has(t.id))].filter(t => t.date < first.date).reduce((a, t) => a + t.amt, 0) + p.rows.slice(0, idx).filter(t => t.date === first.date).reduce((a, t) => a + t.amt, 0));
    gap = r2(stmtBefore - appBefore);
  }
  const lastKnown = [...S.tx, ...S.stmt].reduce((m, t) => t.date > m ? t.date : m, '');
  return {fresh, dupes, inWb, gap, appBefore, stmtBefore, lastKnown, opening: !existing ? p.opening : null, matched, missingHand};
}
function applyStatementImport(p, plan) {
  const add = plan.fresh.map(t => Object.assign({}, t));
  for (const [h, t] of plan.matched || []) {          // the bank row replaces your hand entry and keeps your choices
    if (S.review[h.id]) { S.review[t.id] = S.review[h.id]; delete S.review[h.id]; }
    if (S.overlay[h.id]) { S.overlay[t.id] = S.overlay[h.id]; delete S.overlay[h.id]; }
  }
  const gone = new Set((plan.matched || []).map(([h]) => h.id));
  S.stmt = S.stmt.filter(t => !gone.has(t.id));
  if (plan.opening) add.unshift({id: 'B|opening|' + p.rows[0].date, date: p.rows[0].date, desc: 'Opening balance of the first statement imported', ref: '', vdate: p.rows[0].date, wd: 0, dep: plan.opening > 0 ? plan.opening : 0, amt: plan.opening, bal: plan.opening, row: 0, file: p.file, opening: true});
  S.stmt = S.stmt.concat(add);
  const order = new Map(S.stmt.map((t, i) => [t.id, i]));
  S.stmt.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : order.get(a.id) - order.get(b.id));
  S.stmtFiles.push({file: p.file, from: p.period.from, to: p.period.to, added: add.length, skipped: plan.dupes.length + plan.inWb.length, closing: p.closing, at: new Date().toISOString()});
}
/* Where do the app and the bank first disagree? Compare the app's bank balance with the bank's own closing
   balance at the end of every day a statement covers. */
function bankDrift() {
  if (!S.stmt.some(t => !t.manual)) return null;
  const all = [...S.tx.map(t => ({date: t.date, amt: t.amt})), ...S.stmt.map(t => ({date: t.date, amt: t.amt}))].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const dayEnd = {}; for (const t of S.stmt) if (!t.manual) dayEnd[t.date] = t.bal;   // statement rows are in bank order, so the last one wins
  let cum = 0, k = 0;
  const days = Object.keys(dayEnd).sort();
  for (const d of days) {
    while (k < all.length && all[k].date <= d) cum = r2(cum + all[k++].amt);
    const diff = r2(cum - dayEnd[d]);
    if (Math.abs(diff) > S.cfg.tol) return {date: d, diff, first: d === days[0], app: cum, bank: dayEnd[d], wbLast: S.tx.reduce((m, t) => t.date > m ? t.date : m, '')};
  }
  return null;
}
function driftText() {
  const d = bankDrift(); if (!d) return '';
  if (d.first) return 'The difference is already there on ' + dFull(d.date) + ', the first day your statements cover: the app has ' + inr2(d.app) + ', the bank ' + inr2(d.bank) + '. So it comes from your Excel history before that day' + (d.wbLast ? ' (which runs to ' + dFull(d.wbLast) + ')' : '') + ': a missing month, a row that is wrong, or rows of the statement period that are also in the Excel file.';
  return 'The app and the bank agree until ' + dFull(d.date) + ', when they start to differ by ' + inr2(d.diff) + '. Check the rows of that day and the statement covering it.';
}
function bankStatementBalance() {
  const real = (S.stmt || []).filter(t => !t.manual);
  if (real.length) {
    const t = real[real.length - 1], later = S.stmt.filter(x => x.manual && x.date > t.date);
    return {bal: r2(t.bal + later.reduce((a, x) => a + x.amt, 0)), date: t.date, src: 'statement', handAfter: later.length};
  }
  return S.meta && S.meta.statementBalance != null ? {bal: S.meta.statementBalance, src: 'workbook'} : null;
}

/* ---- suggestions (you still approve every row) ---- */
const payeeKey = desc => payeeOf(desc).toLowerCase().replace(/[^a-z0-9]/g, '');
// what the remark at the end of a UPI narration says, e.g. "...-MONTHLY EXPENSES" or "...-INVESTMENT"
function remarkPurpose(d, inflow) {
  if (/invest|plot|land|property/i.test(d)) return 'Investments';
  if (/donat|charity|zakat|sadaqa|dargah|temple|mosque/i.test(d)) return 'Outside Fund';
  if (/loan|repay|emi\b|debt/i.test(d)) return 'Outside Fund';
  if (/medic|hospital|clinic|pharma|doctor|lab\b|diagnos|consult/i.test(d)) return inflow ? null : 'Medical Expense';
  if (/monthly|expense|household|grocer|provision/i.test(d)) return 'Family Expenses';
  return null;
}
const remarkReason = d => /donat|charity|zakat|sadaqa|dargah|temple|mosque/i.test(d) ? 'Donation / charity' : /loan|repay|emi\b|debt/i.test(d) ? 'Other debt' : '';
function learnedChoices() {
  const tally = {}, put = (t, c, w) => { const k = payeeKey(t.desc) + (t.amt >= 0 ? '+' : '-'), j = JSON.stringify(c); (tally[k] ??= {})[j] = (tally[k][j] || 0) + w; };
  for (const t of S.tx) if (t.dep && t.purpose) put(t, {who: t.dep, purpose: t.purpose}, 1);
  for (const t of S.stmt) { const rv = S.review[t.id]; if (rv && rv.parts.length === 1) put(t, {who: rv.parts[0].who, purpose: rv.parts[0].purpose, reason: rv.parts[0].reason || ''}, 3); }   // your own approvals count more
  const m = {};
  for (const [k, o] of Object.entries(tally)) m[k] = JSON.parse(Object.entries(o).sort((a, b) => b[1] - a[1])[0][0]);
  return m;
}
function suggestFor(t, learned) {
  const inflow = t.amt >= 0, d = t.desc || '', flat = d.toLowerCase().replace(/[^a-z]/g, '');
  const hit = (learned || learnedChoices())[payeeKey(d) + (inflow ? '+' : '-')], rp = remarkPurpose(d, inflow);
  const bro = S.cfg.brothers.find(b => b.length >= 4 ? flat.includes(b.toLowerCase().replace(/[^a-z]/g, '')) : new RegExp('\\b' + b + '\\b', 'i').test(d));
  const who = hit ? hit.who : bro || null, said = '"' + d.split('-').pop().trim().slice(0, 30) + '"';
  // the narration's own remark says what it was for; the history says who it usually is
  if (who && rp) return {who, purpose: rp, reason: rp === 'Outside Fund' ? remarkReason(d) : '', why: (hit ? 'Same payee as before' : who + '\'s name is in the narration') + '; the narration says ' + said};
  if (hit) return Object.assign({why: 'Same payee as before'}, hit);
  if (bro) return {who: bro, purpose: 'Family Expenses', why: bro + '\'s name is in the narration'};
  if (rp && !inflow) return {who: S.cfg.spender, purpose: rp, reason: rp === 'Outside Fund' ? remarkReason(d) : '', why: 'The narration says ' + said};
  const bank = (S.cfg.banks || [])[0] || 'Bank';
  if (/interest|int\.?\s*pd|int\.coll/i.test(d)) return {who: bank, purpose: 'Bank Charges', why: 'Bank interest'};
  if (!inflow && /charge|fee|gst|sms alert|annual|amc/i.test(d)) return {who: bank, purpose: 'Bank Charges', why: 'Bank charge'};
  if (!inflow && /^atw|\batm\b|nwd/i.test(d)) return {who: S.cfg.spender, purpose: 'Family Expenses', why: 'ATM withdrawal'};
  return inflow ? {who: '', purpose: 'Family Expenses', why: ''} : {who: S.cfg.spender, purpose: 'Family Expenses', why: ''};
}

/* ---- into the ledger ---- */
function stmtEntries(t, n) {
  const rv = S.review[t.id], base = {id: t.id, date: t.date, desc: t.desc, amt: t.amt, row: 1e6 + n};
  if (!rv) {
    const e = classifyBank(Object.assign({}, base, {dep: '', purpose: '', type: t.amt >= 0 ? 'Deposit' : 'Withdrawal'}));
    return [Object.assign(e, {flags: ['Not reviewed'], stmt: true, reviewed: false, ref: t.ref, bal: t.bal, manual: !!t.manual})];
  }
  const sign = t.amt >= 0 ? 1 : -1, N = rv.parts.length;
  return rv.parts.map((p, k) => {
    const e = classifyBank(Object.assign({}, base, {id: N > 1 ? t.id + '~' + (k + 1) : t.id, dep: p.who, purpose: p.purpose, reason: p.reason, cat: p.cat, sub: p.sub, med: p.med,
      type: p.purpose === 'Internal Transfer' ? 'Internal Transfer' : sign > 0 ? 'Deposit' : 'Withdrawal', amt: N > 1 ? r2(sign * p.amt) : t.amt}));
    return Object.assign(e, {stmt: true, reviewed: true, ref: t.ref, bal: t.bal, manual: !!t.manual, note: rv.note || e.note}, N > 1 ? {parentId: t.id, splitIdx: k + 1, splitN: N, splitKind: 'review'} : {});
  });
}
/* A brother paid for something himself (cash, his own card, his own account): it is his contribution and
   the family's expense at the same time, so the family's cash and bank are not touched. */
function directEntries(c) {
  const pair = ({Household: ['hhc', 'hhx'], Medical: ['hhc', 'med'], Investment: ['invc', 'invd'], Other: ['spc', 'spx']}[c.cls] || ['hhc', 'hhx']).slice();
  if (c.credit === 'Investment') pair[0] = 'invc'; else if (c.credit === 'Household') pair[0] = 'hhc';   // e.g. he paid a family bill and it counts towards his investment share
  const base = {src: 'Cash', date: c.date, month: c.date.slice(0, 7), by: c.person, type: 'Paid directly', ttype: 'Cash Payment', purpose: c.cls, desc: c.desc, mode: c.mode,
    atm: false, memo: false, direct: true, flags: [], note: c.note || '', ref: c.ref || '', acct: 'Direct', inv: '', cashEntry: c};
  const treat = pair[1] === 'med' ? (c.med || S.cfg.medicalDefault) : null;
  return [
    Object.assign({}, base, {id: c.id + '~in', person: c.person, amt: c.amt, kind: pair[0], fund: fundOf(pair[0]), treat: null, cat: '', payee: c.person}),
    Object.assign({}, base, {id: c.id, person: c.person, amt: -c.amt, kind: pair[1], fund: fundOf(pair[1], treat), treat, cat: pair[1] === 'invd' ? '' : (c.cat || 'Uncategorised'), sub: c.sub, payee: c.desc})
  ];
}

/* ============ TO REVIEW page ============ */
function reviewSelects(t, s, pfx) {
  const dir = t.amt >= 0 ? 'in' : 'out', O = (arr, cur) => arr.map(v => '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
  return '<select data-' + pfx + '-who="' + esc(t.id) + '" aria-label="Who"><option value="">Who…</option>' + O(whoOptions(), s.who) + '</select>' +
    '<select data-' + pfx + '-purpose="' + esc(t.id) + '" aria-label="What for">' + REVIEW_PURPOSES[dir].map(([v, l]) => '<option value="' + esc(v) + '"' + (v === s.purpose ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>' +
    '<select data-' + pfx + '-reason="' + esc(t.id) + '" aria-label="Reason"' + (s.purpose === 'Outside Fund' ? '' : ' hidden') + '>' + O(OUTSIDE_REASONS, s.reason || OUTSIDE_REASONS[3]) + '</select>';
}
function vReview() {
  const todo = S.stmt.filter(t => !S.review[t.id]), learned = learnedChoices(), pg = 25;
  UI.rvpage = Math.min(UI.rvpage || 0, Math.max(0, Math.ceil(todo.length / pg) - 1));
  const vis = todo.slice(UI.rvpage * pg, UI.rvpage * pg + pg);
  const files = S.stmtFiles.slice(-6).reverse();
  const head = '<div class="vh"><h1>To review</h1><span class="sub">' + (todo.length ? todo.length + ' bank row' + (todo.length === 1 ? '' : 's') + ' waiting for you' : 'Nothing waiting') + '</span><div class="actions"><button class="btn" data-act="handAdd">Add transaction by hand</button><button class="btn primary" data-act="pickFile">Import bank statement</button></div></div>';
  const how = '<div class="callout">Each row from the bank needs your approval: <b>who</b> it belongs to and <b>what it was for</b>. The app suggests both from your history; nothing counts toward a brother or a fund until you approve it. Use <b>Split</b> when one payment covers several people or purposes, for example a deposit that is partly a brother\'s contribution and partly money owed to someone else.</div>';
  const list = vis.length ? '<div class="rv-list">' + vis.map(t => {
    const s = UI.rvDraft && UI.rvDraft[t.id] || suggestFor(t, learned);
    return '<div class="rv-row" data-rv-row="' + esc(t.id) + '"><div class="rv-main"><div class="rv-top"><span class="small">' + dFull(t.date) + '</span><b class="' + moneyCls(t.amt) + '">' + inr2(t.amt) + '</b></div>' +
      '<div class="rv-payee">' + esc(t.opening ? 'Opening balance' : payeeOf(t.desc)) + '</div><div class="small rv-desc" title="' + esc(t.desc) + '">' + esc(t.desc) + '</div>' + (s.why ? '<div class="small mute">Suggested: ' + esc(s.why) + '</div>' : '') + '</div>' +
      '<div class="rv-pick">' + reviewSelects(t, s, 'rv') + '<div class="rv-btns"><button class="btn sm" data-act="rvSplit" data-arg="' + esc(t.id) + '">Split…</button><button class="btn sm primary" data-act="rvApprove" data-arg="' + esc(t.id) + '">Approve</button></div></div></div>';
  }).join('') + '</div>' + (todo.length > pg ? '<div class="row mt"><button class="btn sm" data-act="rvPage" data-arg="-1"' + (UI.rvpage <= 0 ? ' disabled' : '') + '>Previous</button><span class="small">Page ' + (UI.rvpage + 1) + ' of ' + Math.ceil(todo.length / pg) + '</span><button class="btn sm" data-act="rvPage" data-arg="1"' + ((UI.rvpage + 1) * pg >= todo.length ? ' disabled' : '') + '>Next</button></div>' : '')
    : '<div class="empty" style="padding:28px 12px"><p>' + (S.stmt.length ? 'Every bank row is reviewed.' : 'Import your HDFC statement (the Excel file from net banking) to start.') + '</p></div>';
  const done = S.stmt.filter(t => S.review[t.id]).sort((a, b) => (S.review[b.id].at || '').localeCompare(S.review[a.id].at || '')).slice(0, 8);
  const recent = done.length ? panel('Recently approved', '<div class="tw"><table class="t"><thead><tr><th>Date</th><th>Payee</th><th>Who and what</th><th class="num">Amount</th><th></th></tr></thead><tbody>' + done.map(t => {
    const rv = S.review[t.id];
    return '<tr><td>' + dFull(t.date) + '</td><td>' + esc(payeeOf(t.desc)) + '</td><td>' + rv.parts.map(p => esc((p.who || '—') + ': ' + purposeLabel(p.purpose, t.amt) + (rv.parts.length > 1 ? ' ' + inr2(p.amt) : ''))).join('<br>') + '</td><td class="num ' + moneyCls(t.amt) + '">' + inr2(t.amt) + '</td><td><button class="btn sm" data-act="rvSplit" data-arg="' + esc(t.id) + '">Change</button> <button class="btn sm" data-act="rvUndo" data-arg="' + esc(t.id) + '">Undo</button></td></tr>';
  }).join('') + '</tbody></table></div>') : '';
  const hist = files.length ? panel('Statements imported', '<div class="kv">' + files.map(f => '<div class="r"><span>' + esc(f.file) + ' · ' + dFull(f.from) + ' to ' + dFull(f.to) + '</span><b>' + f.added + ' new' + (f.skipped ? ', ' + f.skipped + ' already in the app' : '') + '</b></div>').join('') + '</div>') : '';
  return head + how + panel('Waiting for approval', list) + '<div style="height:14px"></div>' + recent + (recent && hist ? '<div style="height:14px"></div>' : '') + hist;
}
function readRowChoice(id, pfx) {
  const q = k => document.querySelector('[data-' + pfx + '-' + k + '="' + CSS.escape(id) + '"]');
  return {who: q('who') ? q('who').value : '', purpose: q('purpose') ? q('purpose').value : '', reason: q('reason') && !q('reason').hidden ? q('reason').value : ''};
}
function approveRow(id, parts, note) {
  S.review[id] = {parts, at: new Date().toISOString(), note: note || ''};
  if (UI.rvDraft) delete UI.rvDraft[id];
}

/* ---- review / split dialog ---- */
function rvPartRow(t, p) {
  const dir = t.amt >= 0 ? 'in' : 'out', O = (arr, cur) => arr.map(v => '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
  const isExp = dir === 'out' && ['Family Expenses', 'Medical Expense', 'Additional Expense'].includes(p.purpose);
  return '<div class="rv-part"><select class="rp-who" aria-label="Who"><option value="">Who…</option>' + O(whoOptions(), p.who) + '</select>' +
    '<select class="rp-purpose" aria-label="What for">' + REVIEW_PURPOSES[dir].map(([v, l]) => '<option value="' + esc(v) + '"' + (v === p.purpose ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>' +
    '<select class="rp-reason" aria-label="Reason"' + (p.purpose === 'Outside Fund' ? '' : ' hidden') + '>' + O(OUTSIDE_REASONS, p.reason || OUTSIDE_REASONS[3]) + '</select>' +
    '<select class="rp-cat" data-catpair="" aria-label="Category"' + (isExp ? '' : ' hidden') + '><option value="">Category: automatic</option>' + O(Object.keys(S.cfg.categories), p.cat) + '</select>' +
    '<select class="rp-sub subsel" aria-label="Subcategory"' + (isExp ? '' : ' hidden') + (subsOf(p.cat).length ? '' : ' disabled') + '>' + subOptions(p.cat, p.sub) + '</select>' +
    '<input class="rp-amt" type="text" inputmode="decimal" autocomplete="off" data-num aria-label="Amount" value="' + (p.amt == null ? '' : p.amt) + '" placeholder="Amount">' +
    '<button class="btn sm" data-act="rpRemove" aria-label="Remove this part">×</button></div>';
}
function reviewDialog(id) {
  const t = S.stmt.find(x => x.id === id); if (!t) return;
  const rv = S.review[id], total = r2(Math.abs(t.amt));
  const parts = rv ? rv.parts.map(p => Object.assign({}, p, {amt: rv.parts.length > 1 ? p.amt : total})) : [Object.assign({}, UI.rvDraft && UI.rvDraft[id] || suggestFor(t), {amt: total})];
  openModal('<div class="modal-bg" data-modal><div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="rv-t"><h2 id="rv-t">' + (rv ? 'Change' : 'Review') + (t.manual ? ' hand entry' : ' bank row') + '</h2>' +
    '<div class="kv mb"><div class="r"><span>Date</span><b>' + dFull(t.date) + '</b></div><div class="r"><span>Amount</span><b class="' + moneyCls(t.amt) + '">' + inr2(t.amt) + '</b></div><div class="r"><span>Narration</span><b style="word-break:break-all">' + esc(t.desc) + '</b></div>' + (t.ref ? '<div class="r"><span>Reference</span><b>' + esc(t.ref) + '</b></div>' : '') + (t.manual ? '<div class="r"><span>Source</span><b>Entered by hand (not yet in a bank statement)</b></div>' : '<div class="r"><span>Balance after</span><b>' + inr2(t.bal) + '</b></div>') + '</div>' +
    '<div class="small mb">Split into parts when this payment covers more than one person or purpose. The parts must add up to ' + inr2(total) + '.</div>' +
    '<div id="rv-parts" data-id="' + esc(id) + '" data-total="' + total + '">' + parts.map(p => rvPartRow(t, p)).join('') + '</div>' +
    '<div class="row mt"><button class="btn sm" data-act="rpAdd">Add part</button><span class="small" id="rp-rem"></span></div>' +
    '<div class="field mt"><label for="rv-note">Note (optional)</label><input id="rv-note" value="' + esc(rv ? rv.note : '') + '" placeholder="e.g. Bilal deposited Aman\'s share"></div>' +
    '<p class="small" id="rv-msg" role="alert" style="color:var(--neg)"></p>' +
    '<div class="foot">' + (t.manual ? '<button class="btn danger" data-act="handDelete" data-arg="' + esc(id) + '">Delete hand entry</button><button class="btn" data-act="handEdit" data-arg="' + esc(id) + '">Edit date, amount or description</button>' : '') + (rv ? '<button class="btn danger" data-act="rvUndo" data-arg="' + esc(id) + '">Mark as not reviewed</button>' : '') + '<button class="btn" data-act="closeModal">Cancel</button>' + (t.manual && !rv ? '<button class="btn" data-act="rvSave" data-arg="more">Approve and add another</button>' : '') + '<button class="btn primary" data-act="rvSave">Approve</button></div></div></div>');
  rpRemaining();
}
function rpRemaining() {
  const box = $('#rv-parts'); if (!box) return;
  const total = +box.dataset.total, parts = $$('.rv-part', box);
  const got = r2(parts.reduce((a, r) => a + (parseAmount($('.rp-amt', r).value) || 0), 0)), rem = r2(total - got);
  $('#rp-rem').textContent = parts.length > 1 ? (Math.abs(rem) < 0.005 ? 'Parts add up.' : (rem > 0 ? inr2(rem) + ' still to assign' : inr2(-rem) + ' too much')) : '';
  for (const r of parts) {
    const t = S.stmt.find(x => x.id === box.dataset.id), p = $('.rp-purpose', r).value;
    $('.rp-reason', r).hidden = p !== 'Outside Fund';
    $('.rp-cat', r).hidden = !(t && t.amt < 0 && ['Family Expenses', 'Medical Expense', 'Additional Expense'].includes(p));
    $('.rp-sub', r).hidden = $('.rp-cat', r).hidden;
  }
}
/* ---- transactions entered by hand ---- */
function handModal(prev, edit) {   // prev: the entry just saved, when adding several in a row; edit: a hand entry being corrected
  const src = edit || prev, pd = src && src.date || todayISO(), out = !!(src && src.amt < 0);
  openModal('<div class="modal-bg" data-modal><div class="modal" role="dialog" aria-modal="true" aria-labelledby="hd-t"><h2 id="hd-t">' + (edit ? 'Edit this hand entry' : 'Add a bank transaction by hand') + '</h2>' +
    (edit ? '<p class="small mb">Correct the date, amount, direction or description. Who and what for are kept, unless you change the amount of a split entry or the direction: then you choose them again.</p>' : '<p class="small mb">For a transaction that is not in an imported statement yet. When you import the statement that has it, the app recognises it (same amount, within 5 days) and keeps what you choose here instead of adding it twice.</p>') +
    '<div class="formgrid"><div class="field"><label for="hd-date">Date</label>' + dateField('hd-date', pd) + '</div>' +
    '<div class="field"><label for="hd-dir">Money</label><select id="hd-dir"><option value="in">Came in (deposit)</option><option value="out"' + (out ? ' selected' : '') + '>Went out (withdrawal)</option></select></div>' +
    '<div class="field"><label for="hd-amt">Amount (₹)</label><input id="hd-amt" type="text" inputmode="decimal" autocomplete="off" data-num value="' + (edit ? Math.abs(edit.amt) : '') + '"></div>' +
    '<div class="field span3"><label for="hd-desc">Description</label><input id="hd-desc" placeholder="e.g. UPI from Aman, monthly expenses" value="' + esc(edit ? edit.desc : '') + '"></div></div>' +
    '<p class="small" id="hd-msg" role="alert" style="color:var(--neg)"></p>' +
    '<div class="foot">' + (edit ? '' : '<button class="btn" data-act="addCash" title="For money that never went through the bank">It was cash instead</button>') + '<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="handNext"' + (edit ? ' data-arg="' + esc(edit.id) + '"' : '') + '>' + (edit ? 'Save changes' : 'Next: who and what for') + '</button></div></div></div>');
}
const STMT_ACTIONS = {
  handAdd: () => handModal(),
  handEdit: el => { const t = S.stmt.find(x => x.id === el.dataset.arg && x.manual); if (t) handModal(null, t); },
  handNext: el => {
    const date = readDate('#hd-date'), amt = parseAmount($('#hd-amt').value), desc = $('#hd-desc').value.trim(), out = $('#hd-dir').value === 'out', msg = $('#hd-msg');
    if (!date) { msg.textContent = 'Enter the date as day/month/year, for example 05/04/2026.'; return; }
    if (!(amt > 0)) { msg.textContent = 'Enter an amount above zero.'; return; }
    if (!desc) { msg.textContent = 'Add a short description so the entry can be recognised later.'; return; }
    const a = r2(out ? -amt : amt), old = el && el.dataset.arg ? S.stmt.find(x => x.id === el.dataset.arg && x.manual) : null;
    if (old) {   // correcting an entry already posted: same entry, same id
      const rv = S.review[old.id], flipped = (old.amt < 0) !== (a < 0), resized = Math.abs(old.amt - a) > 0.005;
      if (rv && (flipped || (resized && rv.parts.length > 1))) delete S.review[old.id];   // the old choices no longer fit
      else if (rv && resized) rv.parts[0].amt = Math.abs(a);
      Object.assign(old, {date, vdate: date, desc, amt: a, wd: out ? r2(amt) : 0, dep: out ? 0 : r2(amt)});
    }
    const t = old || {id: 'M|' + uid(), date, desc, ref: '', vdate: date, wd: out ? r2(amt) : 0, dep: out ? 0 : r2(amt), amt: a, bal: null, row: 0, file: 'Entered by hand', manual: true};
    if (!old) S.stmt.push(t);
    const order = new Map(S.stmt.map((x, i) => [x.id, i]));
    S.stmt.sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : order.get(x.id) - order.get(y.id));
    persist(); refresh();
    if (old && S.review[t.id]) { closeModal(); toast('Entry updated'); } else reviewDialog(t.id);
  },
  handDelete: el => confirmModal('Delete this hand entry?', '<p>It is removed from the app, with what you chose for it. Bank statement rows are never deleted this way.</p>', 'Delete', () => {
    const id = el.dataset.arg; S.stmt = S.stmt.filter(t => !(t.id === id && t.manual)); delete S.review[id]; delete S.overlay[id]; persist(); refresh(); toast('Hand entry deleted');
  }, true),
  removeHistory: () => confirmModal('Remove your Excel history?', '<p>This removes the ' + S.tx.length + ' rows imported from your Excel workbook, so you can rebuild the history from bank statements and hand entries. Statement rows, hand entries, your approvals, cash ledger, plan, categories and family members stay.</p><p class="small">Save a backup first if you might want them back.</p>', 'Remove Excel history', () => {
    S.tx = []; S.bad = []; S.meta = null; derive(); if (R.months.length) defaultFilters(); persist(); refresh(); toast('Excel history removed');
  }, true),
  rvApprove: el => {
    const id = el.dataset.arg, c = readRowChoice(id, 'rv'), t = S.stmt.find(x => x.id === id);
    if (!c.who) { toast('Choose who this row belongs to.'); const w = document.querySelector('[data-rv-who="' + CSS.escape(id) + '"]'); if (w) w.focus(); return; }
    approveRow(id, [Object.assign({amt: r2(Math.abs(t.amt))}, c)]);
    persist(); refresh(); toast('Approved');
  },
  rvSplit: el => { if (UI.rvDraft === undefined) UI.rvDraft = {}; const c = readRowChoice(el.dataset.arg, 'rv'); if (c.who || c.purpose) UI.rvDraft[el.dataset.arg] = c; reviewDialog(el.dataset.arg); },
  rvUndo: el => { delete S.review[el.dataset.arg]; closeModal(); persist(); refresh(); toast('Marked as not reviewed'); },
  rvPage: el => { UI.rvpage = Math.max(0, (UI.rvpage || 0) + (+el.dataset.arg)); renderView(); jumpTo(0); },
  rpAdd: () => {
    const box = $('#rv-parts'), t = S.stmt.find(x => x.id === box.dataset.id);
    const rem = r2(+box.dataset.total - $$('.rp-amt', box).reduce((a, i) => a + (parseAmount(i.value) || 0), 0));
    box.insertAdjacentHTML('beforeend', rvPartRow(t, {who: '', purpose: t.amt >= 0 ? 'Family Expenses' : 'Family Expenses', amt: rem > 0 ? rem : null}));
    rpRemaining(); const last = $$('.rv-part', box).slice(-1)[0]; if (last) $('.rp-who', last).focus();
  },
  rpRemove: el => { const box = $('#rv-parts'); if ($$('.rv-part', box).length > 1) el.closest('.rv-part').remove(); rpRemaining(); },
  rvSave: el => {
    const box = $('#rv-parts'), id = box.dataset.id, total = +box.dataset.total, msg = $('#rv-msg');
    const parts = $$('.rv-part', box).map(r => ({who: $('.rp-who', r).value, purpose: $('.rp-purpose', r).value, reason: $('.rp-reason', r).hidden ? '' : $('.rp-reason', r).value,
      cat: $('.rp-cat', r).hidden ? '' : $('.rp-cat', r).value, sub: $('.rp-cat', r).hidden || !subsOf($('.rp-cat', r).value).includes($('.rp-sub', r).value) ? '' : $('.rp-sub', r).value, amt: parseAmount($('.rp-amt', r).value)}));
    if (parts.some(p => !p.who)) { msg.textContent = 'Choose who each part belongs to.'; return; }
    if (parts.some(p => !(p.amt > 0))) { msg.textContent = 'Every part needs an amount above zero.'; return; }
    const got = r2(parts.reduce((a, p) => a + p.amt, 0));
    if (Math.abs(got - total) > 0.005) { msg.textContent = 'The parts add up to ' + inr2(got) + ', not ' + inr2(total) + '.'; return; }
    approveRow(id, parts.map(p => Object.assign(p, {amt: r2(p.amt)})), $('#rv-note').value.trim());
    closeModal(); persist(); refresh(); toast(parts.length > 1 ? 'Approved in ' + parts.length + ' parts' : 'Approved');
    if (el && el.dataset.arg === 'more') handModal(S.stmt.find(x => x.id === id));   // next one starts on the same date and direction
  }
};
/* change events from the To review page and the dialog; returns true when handled */
function stmtChange(t) {
  if (t.dataset && (t.dataset.rvPurpose !== undefined || t.dataset.rvWho !== undefined || t.dataset.rvReason !== undefined)) {
    const id = t.dataset.rvPurpose ?? t.dataset.rvWho ?? t.dataset.rvReason;
    UI.rvDraft = UI.rvDraft || {}; UI.rvDraft[id] = readRowChoice(id, 'rv');
    const r = document.querySelector('[data-rv-reason="' + CSS.escape(id) + '"]'); if (r) r.hidden = UI.rvDraft[id].purpose !== 'Outside Fund';
    UI.rvDraft[id] = readRowChoice(id, 'rv');
    return true;
  }
  if (t.closest && t.closest('#rv-parts')) { rpRemaining(); return true; }
  return false;
}

/* ---- import dialog ---- */
function statementImportDialog(p) {
  const plan = planStatementImport(p), tol = S.cfg.tol;
  const warn = [];
  if (p.breaks.length) warn.push('The running balance does not add up at ' + p.breaks.length + ' place(s), first on ' + dFull(p.breaks[0].date) + ' (expected ' + inr2(p.breaks[0].expected) + ', the statement says ' + inr2(p.breaks[0].found) + '). A row may be missing from this file.');
  if (!p.summaryOK) warn.push('The rows do not match the bank\'s own summary at the end of the statement. The file may be incomplete.');
  if (p.bad.length) warn.push(p.bad.length + ' line(s) could not be read and were left out, first on sheet row ' + p.bad[0].row + '.');
  if (plan.missingHand.length) warn.push(plan.missingHand.length + ' hand entr' + (plan.missingHand.length === 1 ? 'y is' : 'ies are') + ' dated inside this statement\'s period but not in it (first: ' + dFull(plan.missingHand[0].date) + ', ' + inr2(plan.missingHand[0].amt) + '). Check the date and amount, or delete it if it never happened.');
  if (plan.gap != null && Math.abs(plan.gap) > tol) warn.push('This statement starts from a balance of ' + inr2(plan.stmtBefore) + ', but the app has ' + inr2(plan.appBefore) + ' up to that day: a difference of ' + inr2(plan.gap) + '. A statement for an earlier period may be missing' + (plan.lastKnown ? ' (the app\'s last row is ' + dFull(plan.lastKnown) + ')' : '') + '.');
  const ok = !warn.length;
  openModal('<div class="modal-bg" data-modal><div class="modal" role="dialog" aria-modal="true"><h2>Import bank statement</h2><div class="kv">' +
    '<div class="r"><span>File</span><b>' + esc(p.file) + '</b></div><div class="r"><span>Period</span><b>' + dFull(p.period.from) + ' to ' + dFull(p.period.to) + '</b></div>' +
    '<div class="r"><span>Rows in the statement</span><b>' + p.rows.length + '</b></div><div class="r"><span>New rows to add</span><b>' + plan.fresh.length + '</b></div>' +
    (plan.dupes.length ? '<div class="r"><span>Already imported before</span><b>' + plan.dupes.length + ' (skipped)</b></div>' : '') +
    (plan.inWb.length ? '<div class="r"><span>Already in your Excel history</span><b>' + plan.inWb.length + ' (skipped)</b></div>' : '') +
    (plan.matched.length ? '<div class="r"><span>Your hand entries found in it</span><b>' + plan.matched.length + ' (your who and what are kept)</b></div>' : '') +
    '<div class="r"><span>Opening → closing balance</span><b>' + inr2(p.opening) + ' → ' + inr2(p.closing) + '</b></div></div>' +
    (plan.opening ? '<div class="callout mt">This is the first statement in the app, so its opening balance (' + inr2(plan.opening) + ') is added as a row for you to review too.</div>' : '') +
    (ok ? '<div class="callout pos mt">The running balance checks out' + (p.summary ? ', the rows match the bank\'s summary' : '') + (plan.gap != null ? ', and it continues from the balance already in the app' : '') + '.</div>' : '<div class="callout warn mt">' + warn.map(esc).join('<br>') + '</div>') +
    '<p class="small mt">New rows go to <b>To review</b>. They count in the bank balance straight away, but toward no brother or fund until you approve them.</p>' +
    '<div class="foot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" id="applyStmt"' + (plan.fresh.length || plan.opening ? '' : ' disabled') + '>' + (plan.fresh.length || plan.opening ? 'Add ' + (plan.fresh.length + (plan.opening ? 1 : 0)) + ' row(s)' : 'Nothing new') + '</button></div></div></div>');
  const b = $('#applyStmt'); if (b) b.onclick = () => {
    applyStatementImport(p, plan); closeModal(); derive();
    defaultFilters();   // show the newest month: the one this statement just added
    persist(); refresh(); goto('review'); toast((plan.fresh.length + (plan.opening ? 1 : 0)) + ' row(s) added for review');
  };
}
