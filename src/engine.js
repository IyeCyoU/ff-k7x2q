'use strict';
/* ============ classification ============ */
let R = null; // derived results

const isBro = n => S.cfg.brothers.includes(n);
function payeeOf(desc) {
  const d = desc || '';
  let m = d.match(/^upi-([^-]+?)\s*-/i); if (m) return m[1].trim();
  if (/^atw/i.test(d)) return 'ATM withdrawal';
  m = d.match(/^(?:imps|neft)[^-]*-[^-]*-([^-]+)-/i); if (m) return m[1].trim();
  return d.slice(0, 32);
}
function modeOf(desc, type) {
  const d = (desc || '').trim();
  if (/^atw/i.test(d)) return 'Cash';
  if (/^upi/i.test(d)) return 'UPI';
  if (/^(imps|neft|rtgs)|bank transfer|\btpt\b/i.test(d)) return 'Transfer';
  if (/debit card|pos |ecom/i.test(d)) return 'Card';
  if (/interest|instaalert|billpay|charge|fee/i.test(d)) return 'Bank';
  if (/^(mom|household|spent|initial)/i.test(d)) return 'Bank';
  return 'Other';
}
function ruleCat(desc) {
  const d = (desc || '').toLowerCase();
  for (const r of S.cfg.rules) if (r.kw && d.includes(r.kw.toLowerCase())) return r.cat;
  return null;
}
function fundOf(kind, treat) {
  switch (kind) {
    case 'hhc': case 'hhx': case 'rcpt': case 'chg': case 'xfer': return 'H';
    case 'invc': case 'invd': case 'invr': return 'I';
    case 'spc': case 'spx': return 'S';
    case 'ext': return 'O';
    case 'med': return treat === 'Separate Family Medical' ? 'M' : treat === 'Special / Extraordinary' ? 'S' : 'H';
    default: return 'X';
  }
}
function classifyBank(t) {
  const ov = S.overlay[t.id] || {};
  const bro = isBro(t.dep), P = t.purpose, a = t.amt;
  let kind, flags = [];
  if (t.type === 'Internal Transfer' || P === 'Internal Transfer') kind = 'xfer';
  else if (P === 'Family Expenses') { if (a > 0) { kind = bro ? 'hhc' : 'rcpt'; if (!bro && ![S.cfg.spender, ...(S.cfg.banks || [])].includes(t.dep)) flags.push('Missing brother'); } else kind = 'hhx'; }
  else if (P === 'Investments') { if (a > 0) { kind = 'invc'; if (!bro) flags.push('Missing brother'); } else kind = (ov.inv === 'Returned to brother' && bro) ? 'invr' : 'invd'; }
  else if (P === 'Additional Expense') kind = a > 0 ? 'spc' : 'spx';
  else if (P === 'Medical Expense') kind = 'med';
  else if (P === 'Bank Charges') kind = a > 0 ? 'rcpt' : 'chg';
  else if (P === 'Outside Fund') kind = 'ext';
  else { kind = 'oth'; flags.push('Missing classification'); }
  const treat = kind === 'med' ? (t.med || ov.med || S.cfg.medicalDefault) : kind === 'ext' ? (t.reason || OUTSIDE_REASONS[3]) : null;
  const atm = /^atw/i.test(t.desc);
  let cat = '';
  if (kind === 'hhx' || kind === 'chg' || kind === 'med' || kind === 'spx') {
    cat = ov.cat || t.cat || (kind === 'med' ? 'Medical' : kind === 'chg' ? 'Bank Charges' : atm ? 'Cash withdrawn (ATM)' : ruleCat(t.desc) || 'Uncategorised');
  }
  const ttype = t.type === 'Internal Transfer' ? 'Internal Transfer' : a >= 0 ? 'Deposit' : 'Withdrawal';
  return {
    id: t.id, src: 'Bank', date: t.date, month: t.date.slice(0, 7), person: t.dep, type: t.type, ttype, purpose: P, desc: t.desc, amt: a,
    kind, fund: fundOf(kind, treat), treat, cat, mode: ov.mode || modeOf(t.desc, t.type), payee: payeeOf(t.desc), atm, memo: false,
    flags, note: ov.note || '', inv: ov.inv || (kind === 'invd' || kind === 'invr' ? 'Deployed' : ''), ov: !!S.overlay[t.id], row: t.row
  };
}
function classifyCash(c) {
  const rec = c.dir === 'Receipt', amt = rec ? c.amt : -c.amt;
  let kind;
  if (rec) kind = c.cls === 'Household' ? 'hhc' : c.cls === 'Investment' ? 'invc' : 'spc';
  else kind = c.cls === 'Household' ? 'hhx' : c.cls === 'Medical' ? 'med' : c.cls === 'Investment' ? 'invd' : 'spx';
  const memo = !rec && /^ATM/i.test(c.src || '');
  const treat = kind === 'med' ? (c.med || S.cfg.medicalDefault) : null;
  const person = rec ? c.person : (c.person || c.by);
  let cat = '';
  if (kind === 'hhx' || kind === 'med' || kind === 'spx') cat = c.cat || (kind === 'med' ? 'Medical' : 'Uncategorised');
  return {
    id: c.id, src: 'Cash', date: c.date, month: (c.date || '').slice(0, 7), person, by: c.by, type: rec ? 'Cash Receipt' : 'Cash Payment', ttype: rec ? 'Cash Receipt' : 'Cash Payment',
    purpose: c.cls, desc: c.desc, amt, kind, fund: memo ? null : fundOf(kind, treat), treat, cat, sub: c.sub, mode: c.mode, payee: c.person || '', atm: false, memo,
    flags: [], note: c.note || '', ref: c.ref || '', acct: c.acct, inv: '', cashEntry: c
  };
}

/* ============ contribution plan ============ */
function planFor(b, t, m) {
  let best = null;
  for (const r of S.cfg.plan) {
    if (r.type !== t || r.from > m) continue;
    if (r.brother !== 'All' && r.brother !== b) continue;
    if (!best || r.from > best.from || (r.from === best.from && r.brother !== 'All' && best.brother === 'All')) best = r;
  }
  if (!best) return {amount: 0, suspended: false, none: true};
  return best.status === 'Suspended' ? {amount: 0, suspended: true} : {amount: +best.amount || 0, suspended: false};
}
function statusOf(x, nextReq) {
  const tol = S.cfg.tol;
  if (x.suspended && x.out <= tol && x.paid <= tol) return 'Contribution Suspended';
  if (x.req <= tol && x.out <= tol && x.paid <= tol && x.adv <= tol) return 'Not Required';
  if (x.out > tol) return (x.paid > tol || x.req - x.shortfall > tol) ? 'Partially Paid' : 'Unpaid';
  if (x.adv > tol) return (x.req <= tol || x.adv >= nextReq - tol) ? 'Advance' : 'Overpaid';
  return 'Paid';
}

/* ============ derive everything ============ */
function derive() {
  const cfg = S.cfg, tol = cfg.tol, B = cfg.brothers;
  const led = [], broken = [];
  for (const t of S.tx) {
    const e = classifyBank(t), ov = S.overlay[t.id];
    if (ov && ov.split) {
      const parts = ov.split, tot = r2(parts.reduce((a, x) => a + x.amt, 0));
      const ok = ['hhx', 'med', 'spx'].includes(e.kind) && !e.atm && e.amt < 0 && parts.length >= 2 && Math.abs(tot - r2(-e.amt)) < 0.005;
      if (ok) { parts.forEach((x, k) => led.push(Object.assign({}, e, {id: t.id + '~' + (k + 1), parentId: t.id, splitIdx: k + 1, splitN: parts.length, amt: -x.amt, cat: x.cat}))); continue; }
      broken.push(t);
    }
    led.push(e);
  }
  S.stmt.forEach((t, n) => { for (const e of stmtEntries(t, n)) led.push(e); });
  for (const c of S.cash) if (validISO(c.date)) { if (c.dir === 'Direct') led.push(...directEntries(c)); else led.push(classifyCash(c)); }
  led.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.src === b.src ? (a.row || 0) - (b.row || 0) : a.src < b.src ? -1 : 1));
  const months = [];
  if (led.length) { let m = led[0].month; const last = led[led.length - 1].month; while (m <= last) { months.push(m); m = addMonths(m, 1); } }
  const mi = {}; months.forEach((m, i) => mi[m] = i);
  const N = months.length;
  R = {led, months, mi, N, byId: {}, splitBroken: broken};
  led.forEach(e => R.byId[e.id] = e);

  // flows per fund per month per kind
  const F = {};
  FUNDS.forEach(f => F[f] = months.map(() => ({})));
  const bankM = months.map(() => 0), cashM = months.map(() => 0), pendM = months.map(() => 0);
  const bankBy = months.map(() => ({add: 0, exp: 0, xfer: 0, inv: 0, dep: 0, oth: 0, ext: 0, unclassified: 0}));
  for (const e of led) {
    const i = mi[e.month];
    if (e.fund) { const o = F[e.fund][i]; o[e.kind] = (o[e.kind] || 0) + e.amt; }
    if (e.src === 'Bank') {
      bankM[i] += e.amt;
      const bb = bankBy[i];
      if (['hhc', 'invc', 'spc', 'rcpt'].includes(e.kind)) bb.add += e.amt;
      else if (['hhx', 'chg', 'med', 'spx'].includes(e.kind)) bb.exp += e.amt;
      else if (e.kind === 'xfer') bb.xfer += e.amt;
      else if (['invd', 'invr'].includes(e.kind)) bb.inv += e.amt;
      else if (e.kind === 'ext') bb.ext += e.amt;
      else { bb.oth += e.amt; bb.unclassified++; }
    } else if (!e.memo && !e.direct) { if (e.acct === 'Cash') cashM[i] += e.amt; else pendM[i] += e.amt; }
  }
  R.F = {};
  const line = (o, k) => o[k] || 0;
  for (const f of FUNDS) {
    let bal = 0; R.F[f] = months.map((m, i) => {
      const o = F[f][i], open = bal;
      let x;
      if (f === 'H') x = {contrib: line(o, 'hhc'), receipts: line(o, 'rcpt'), spend: -(line(o, 'hhx') + line(o, 'chg') + line(o, 'med')), adj: line(o, 'xfer')};
      else if (f === 'I') x = {contrib: line(o, 'invc'), deployed: -line(o, 'invd'), returned: -line(o, 'invr'), adj: 0};
      else if (f === 'S') x = {contrib: line(o, 'spc'), spend: -(line(o, 'spx') + line(o, 'med')), adj: 0};
      else if (f === 'M') x = {spend: -line(o, 'med')};
      else if (f === 'O') x = {in: line(o, 'ext') > 0 ? line(o, 'ext') : 0, net: line(o, 'ext')};
      else x = {net: line(o, 'oth') + line(o, 'rcpt') * 0};
      const net = Object.values(o).reduce((a, b) => a + b, 0);
      bal = open + net;
      return Object.assign({month: m, open, close: bal, net}, x);
    });
  }
  let cb = 0, cc = 0, cp = 0;
  R.bankCum = bankM.map(v => cb += v); R.cashCum = cashM.map(v => cc += v); R.pendCum = pendM.map(v => cp += v);
  R.bankBy = bankBy; R.bankM = bankM;
  R.famCum = months.map((m, i) => R.bankCum[i] + R.cashCum[i] + R.pendCum[i]);
  // the family's own money: what the bank and cash hold, minus money that is only passing through for others
  R.ownCum = months.map((m, i) => r2(R.famCum[i] - R.F.O[i].close));

  // contributions
  R.C = {};
  const types = ['Household', 'Investment'];
  const paidMap = {};
  for (const e of led) if ((e.kind === 'hhc' || e.kind === 'invc') && isBro(e.person)) {
    const t = e.kind === 'hhc' ? 'Household' : 'Investment', k = e.person + '|' + t + '|' + e.month; paidMap[k] = (paidMap[k] || 0) + e.amt;
  }
  for (const b of B) {
    R.C[b] = {};
    for (const t of types) {
      let cumReq = 0, cumPaid = 0;
      R.C[b][t] = months.map((m, i) => {
        const p = planFor(b, t, m), nxt = i + 1 < N ? planFor(b, t, months[i + 1]).amount : p.amount;
        const req = p.amount, paid = r2(paidMap[b + '|' + t + '|' + m] || 0);
        const openPos = r2(cumPaid - cumReq);
        cumReq += req; cumPaid += paid;
        const closePos = r2(cumPaid - cumReq);
        const arrearsIn = Math.max(0, -openPos), advIn = Math.max(0, openPos);
        const afterArrears = paid + advIn - arrearsIn;
        const cover = Math.min(req, Math.max(0, afterArrears));
        const shortfall = r2(req - cover), excess = r2(Math.max(0, afterArrears - req));
        const x = {month: m, req, paid, openPos, closePos, arrears: r2(arrearsIn), shortfall, excess, out: Math.max(0, -closePos), adv: Math.max(0, closePos), cumReq, cumPaid, suspended: p.suspended};
        x.status = statusOf(x, nxt);
        return x;
      });
    }
  }
  // ownership series
  R.invNet = {};
  const invMonth = {};
  for (const e of led) if ((e.kind === 'invc' || e.kind === 'invr') && isBro(e.person)) { const k = e.person + '|' + e.month; invMonth[k] = (invMonth[k] || 0) + e.amt; }
  for (const b of B) { let c = 0; R.invNet[b] = months.map(m => c += (invMonth[b + '|' + m] || 0)); }
  R.invUnassigned = 0; for (const e of led) if ((e.kind === 'invc' || e.kind === 'invr') && !isBro(e.person) && e.fund) R.invUnassigned += e.amt;
  R.exceptions = buildExceptions();
  R.checks = buildChecks();
}

/* ============ period & filters ============ */
const UI = {tab: 'overview', f: {year: 'All', month: 'All', brother: 'All', ctype: 'All', cat: 'All', mode: 'All', ttype: 'All'}, ctTab: 'Household', txq: '', txsrc: 'All', txcls: 'All', txpage: 0, exf: 'Open', filtersOpen: false};
function periodInfo() {
  const M = R.months;
  if (!M.length) return {start: -1, end: -1, sel: null, label: 'No data', asOf: null};
  const y = UI.f.year, mo = UI.f.month;
  let idxs = M.map((m, i) => i);
  if (y !== 'All') idxs = idxs.filter(i => M[i].slice(0, 4) === y);
  if (y !== 'All' && mo !== 'All') idxs = idxs.filter(i => +M[i].slice(5, 7) === +mo);
  if (!idxs.length) idxs = [M.length - 1];
  const start = idxs[0], end = idxs[idxs.length - 1];
  const sel = (y !== 'All' && mo !== 'All') ? M[end] : M[end];
  const label = (y === 'All') ? 'All time' : (mo === 'All' ? y : mLong(M[end]));
  return {start, end, sel, label, asOf: M[end], startM: M[start], single: y !== 'All' && mo !== 'All'};
}
function passes(e, ig = []) {
  const f = UI.f, P = periodInfo();
  if (!ig.includes('period') && (e.month < P.startM || e.month > P.asOf)) return false;
  if (!ig.includes('brother') && f.brother !== 'All' && e.person !== f.brother) return false;
  if (!ig.includes('ctype') && f.ctype !== 'All') {
    const k = e.kind, t = f.ctype;
    const m = {Household: ['hhc', 'hhx', 'rcpt', 'chg', 'xfer'], Investment: ['invc', 'invd', 'invr'], Special: ['spc', 'spx', 'med']};
    if (!(m[t] || []).includes(k)) return false;
  }
  if (!ig.includes('cat') && f.cat !== 'All' && e.cat !== f.cat) return false;
  if (!ig.includes('mode') && f.mode !== 'All' && e.mode !== f.mode) return false;
  if (!ig.includes('ttype') && f.ttype !== 'All' && e.ttype !== f.ttype) return false;
  return true;
}
const sel = (ig = [], fn) => R.led.filter(e => passes(e, ig) && (!fn || fn(e)));
const sum = (arr, fn) => arr.reduce((a, e) => a + fn(e), 0);
const broList = () => UI.f.brother === 'All' ? S.cfg.brothers : [UI.f.brother];
const ctList = () => UI.f.ctype === 'Household' ? ['Household'] : UI.f.ctype === 'Investment' ? ['Investment'] : UI.f.ctype === 'Special' ? [] : ['Household', 'Investment'];

/* ============ ownership & goal ============ */
function ownership(idx) {
  const B = S.cfg.brothers, i = Math.max(0, idx);
  const rows = B.map(b => {
    const contrib = sum(R.led.filter(e => e.kind === 'invc' && e.person === b && e.month <= R.months[i]), e => e.amt);
    const returned = -sum(R.led.filter(e => e.kind === 'invr' && e.person === b && e.month <= R.months[i]), e => e.amt);
    return {b, contrib, returned, net: contrib - returned};
  });
  const total = rows.reduce((a, r) => a + r.net, 0);
  rows.forEach(r => { r.pct = total > 0 ? r.net / total : 0; });
  return {rows, total};
}
function goalCalc(idx) {
  const g = S.cfg.goal, B = S.cfg.brothers, tol = S.cfg.tol;
  const asOf = R.months[idx] || g.start;
  const own = ownership(idx);
  const total = own.total + R.invUnassigned;
  const totalMonths = Math.max(1, g.years * 12);
  const elapsed = Math.max(0, Math.min(totalMonths, monthDiff(g.start, asOf) + 1));
  const remainingM = Math.max(0, totalMonths - elapsed);
  const target = g.target, remaining = Math.max(0, target - total);
  const perB = target / B.length;
  const reqMonthly = remainingM > 0 ? remaining / remainingM : (remaining > 0 ? Infinity : 0);
  const expectedNow = target * elapsed / totalMonths;
  // paces
  const sumInv = ms => sum(R.led.filter(e => (e.kind === 'invc' || e.kind === 'invr') && e.fund && ms.includes(e.month) && e.month >= g.start), e => e.amt);
  const monthsFrom = R.months.filter(m => m >= g.start && m <= asOf);
  const life = monthsFrom.length ? sumInv(monthsFrom) / Math.max(1, elapsed) : 0;
  const last6 = R.months.filter(m => m <= asOf).slice(-6), l6 = last6.length ? sumInv(last6) / last6.length : 0;
  const planRate = B.reduce((a, b) => a + planFor(b, 'Investment', asOf).amount, 0);
  const pace = g.basis === 'plan' ? planRate : g.basis === 'last6' ? l6 : life;
  // projection
  let n = 0, bal = total; const r = (g.ret || 0) / 100 / 12;
  if (pace > 0 || (r > 0 && bal > 0)) { while (bal < target && n < 1200) { bal = bal * (1 + r) + pace; n++; } }
  else n = Infinity;
  const done = total >= target - tol;
  const compl = done ? asOf : (isFinite(n) && n < 1200 ? addMonths(asOf, n) : null);
  let atHorizon = total; for (let k = 0; k < remainingM; k++) atHorizon = atHorizon * (1 + r) + pace;
  const bro = B.map(b => {
    const c = own.rows.find(x => x.b === b).net, rem = Math.max(0, perB - c);
    return {b, contrib: c, target: perB, pct: perB ? c / perB : 0, remaining: rem, req: remainingM > 0 ? rem / remainingM : 0, expected: perB * elapsed / totalMonths};
  });
  return {asOf, total, target, remaining, pct: target ? total / target : 0, elapsed, totalMonths, remainingM, reqMonthly, expectedNow, gap: total - expectedNow, life, l6, planRate, pace, months: n, compl, atHorizon, done, bro, perB, endMonth: addMonths(g.start, totalMonths - 1), reqPerBro: reqMonthly / B.length};
}

/* ============ category breakdown (ATM itemisation aware) ============ */
function categoryBreakdown(entries) {
  const m = {}; let atm = 0, memo = 0;
  for (const e of entries) {
    if (e.memo) { if (e.kind === 'hhx' || e.kind === 'med') { m[e.cat] = (m[e.cat] || 0) + (-e.amt); memo += -e.amt; } continue; }
    if (!['hhx', 'chg', 'med', 'spx'].includes(e.kind)) continue;
    if (e.atm && e.kind === 'hhx') { atm += -e.amt; continue; }
    m[e.cat] = (m[e.cat] || 0) + (-e.amt);
  }
  const unitem = Math.max(0, atm - memo);
  if (unitem > 0.005) m['Cash withdrawn (ATM), not itemised'] = unitem;
  return Object.entries(m).map(([cat, v]) => ({cat, v})).filter(x => Math.abs(x.v) > 0.004).sort((a, b) => b.v - a.v);
}

/* ============ exceptions ============ */
function possibleBankDup(c) {
  const amt = c.dir === 'Receipt' ? c.amt : -c.amt, d0 = new Date(c.date + 'T00:00:00Z').getTime();
  return R.led.filter(e => e.src === 'Bank' && Math.abs(e.amt - amt) < 0.005 && Math.abs(new Date(e.date + 'T00:00:00Z').getTime() - d0) <= 5 * 864e5);
}
function buildExceptions() {
  const out = [], tol = S.cfg.tol, B = S.cfg.brothers, led = R.led;
  const add = (o) => { o.key = o.code + '|' + (o.sig || o.title); o.ack = S.ack[o.key] || null; out.push(o); };
  // invalid rows
  for (const b of S.bad) add({sev: 'High', code: 'Invalid date/amount', title: 'Row ' + b.row + ': ' + b.reason, detail: (b.desc || '').slice(0, 90) + ' | date "' + b.rawDate + '" amount "' + b.rawAmt + '"', ids: [], amount: b.amt || 0, count: 1, tab: 'transactions', sig: 'row' + b.row});
  // bank statement rows nobody has reviewed yet: they count in the bank balance but in no fund
  const nr = led.filter(e => e.flags.includes('Not reviewed'));
  if (nr.length) add({sev: 'High', code: 'Not reviewed', title: nr.length + ' bank statement row(s) not reviewed yet (' + inr2(sum(nr, e => e.amt)) + ' net)', detail: 'They are in the bank balance but in no brother\'s contribution and no fund until you approve who and what each one is.', ids: nr.map(e => e.id), amount: sum(nr, e => e.amt), count: nr.length, tab: 'review', sig: 'review'});
  // missing brother
  const mb = led.filter(e => e.flags.includes('Missing brother'));
  if (mb.length) add({sev: 'High', code: 'Missing brother', title: mb.length + ' contribution row(s) without a brother', detail: 'Deposits tagged as contributions but depositor is not one of the four brothers.', ids: mb.map(e => e.id), amount: sum(mb, e => e.amt), count: mb.length, tab: 'transactions'});
  // missing classification
  const mc = led.filter(e => e.kind === 'oth');
  if (mc.length) add({sev: 'High', code: 'Missing classification', title: mc.length + ' row(s) with no usable Purpose', detail: 'These amounts sit in the Unclassified fund until a Purpose is set in your workbook.', ids: mc.map(e => e.id), amount: sum(mc, e => e.amt), count: mc.length, tab: 'transactions'});
  // missing category (household expenses)
  const uc = led.filter(e => e.fund === 'H' && ['hhx', 'med'].includes(e.kind) && !e.memo && e.cat === 'Uncategorised');
  if (uc.length) add({sev: 'Low', code: 'Missing category', title: uc.length + ' household expense(s) have no category yet', detail: 'Set categories one payee at a time in Household → Categorise payees. Original Purpose is never changed.', ids: uc.map(e => e.id), amount: sum(uc, e => e.amt), count: uc.length, tab: 'household'});
  // missing payment mode
  const mm = led.filter(e => e.src === 'Bank' && !(e.splitIdx > 1) && (!e.mode || e.mode === 'Other'));
  if (mm.length) add({sev: 'Low', code: 'Missing payment mode', title: mm.length + ' bank row(s) whose payment mode could not be read', detail: 'Shown as "Other". Set the mode in the row editor if you want them counted elsewhere.', ids: mm.map(e => e.id), amount: sum(mm, e => e.amt), count: mm.length, tab: 'transactions'});
  // duplicates
  const grp = {};
  for (const e of led) if (e.src === 'Bank' && !e.parentId) {
    const refs = e.desc.match(/(?<![\d])\d{12}(?![\d])/g);
    const ref = refs && refs[refs.length - 1];
    if (!ref) continue;
    const k = [ref, e.person, e.purpose, e.type, e.amt].join('|'); (grp[k] = grp[k] || []).push(e);
  }
  for (const k in grp) if (grp[k].length > 1) {
    const g = grp[k];
    const sp = g.map(e => (e.desc.match(/split\s+(\d+)\s*\/\s*\d+/i) || [])[1]);
    if (sp.every(Boolean) && new Set(sp).size === g.length) continue; add({sev: 'Medium', code: 'Duplicate possibility', title: g.length + ' identical rows on ' + dFull(g[0].date) + ' (' + g[0].person + ', ' + inr(g[0].amt) + ')', detail: 'Same bank reference, person, purpose and amount. May be a genuine double payment, or one row may belong to another purpose. Not changed.', ids: g.map(e => e.id), amount: sum(g, e => e.amt), count: g.length, tab: 'transactions', sig: k});
  }
  // medical wording under other purposes
  const mw = led.filter(e => e.src === 'Bank' && e.purpose !== 'Medical Expense' && /medical|pharma|diagnos|hospital|\bdr\b/i.test(e.desc));
  const mwi = mw.filter(e => e.kind === 'invc' || e.kind === 'hhc');
  if (mwi.length) add({sev: 'Medium', code: 'Investment allocation inconsistency', title: mwi.length + ' contribution row(s) mention medical expenses', detail: 'Wording says medical, but the money was booked as ' + [...new Set(mwi.map(e => e.purpose))].join(' / ') + '. These count toward the housing goal and ownership. Decide if that is intended.', ids: mwi.map(e => e.id), amount: sum(mwi, e => e.amt), count: mwi.length, tab: 'transactions'});
  const mwh = mw.filter(e => e.kind === 'hhx');
  if (mwh.length) add({sev: 'Low', code: 'Missing classification', title: mwh.length + ' household expense(s) look medical by payee name', detail: 'Booked as Family Expenses, so they are outside the medical reports. Reclassify in your workbook if they should be medical.', ids: mwh.map(e => e.id), amount: sum(mwh, e => e.amt), count: mwh.length, tab: 'transactions', sig: 'medlook'});
  const broRe = new RegExp('\\b(' + S.cfg.brothers.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i');
  const toBro = led.filter(e => e.src === 'Bank' && e.kind === 'hhx' && S.cfg.brothers.length && broRe.test(e.payee));
  if (toBro.length) add({sev: 'Low', code: 'Missing classification', title: toBro.length + ' household payment(s) went to a brother\'s name (' + inr(-sum(toBro, e => e.amt)) + ')', detail: 'Could be reimbursements for something a brother paid. If so, confirm they should reduce the household fund and are not returns of contribution.', ids: toBro.map(e => e.id), amount: sum(toBro, e => e.amt), count: toBro.length, tab: 'transactions', sig: 'tobro'});
  // contribution mismatch (current outstanding)
  const last = R.N - 1;
  if (last >= 0) for (const b of B) for (const t of ['Household', 'Investment']) {
    const x = R.C[b][t][last];
    if (x.out > tol) add({sev: t === 'Household' ? 'High' : 'Medium', code: 'Contribution mismatch', title: b + ' ' + t.toLowerCase() + ' contribution is short by ' + inr(x.out), detail: 'Required to date ' + inr(x.cumReq) + ', paid to date ' + inr(x.cumPaid) + '.', ids: [], amount: -x.out, count: 1, tab: 'contributions', sig: b + t});
  }
  // negative fund balances
  for (const f of [['H', 'Household fund'], ['I', 'Investment fund'], ['S', 'Special fund'], ['M', 'Medical fund']]) {
    if (!R.N) break; const ser = R.F[f[0]]; const neg = ser.filter(r => r.close < -tol);
    const nowNeg = ser[last].close < -tol;
    if (neg.length) add({sev: nowNeg ? (f[0] === 'H' ? 'High' : 'Medium') : 'Low', code: 'Negative fund balance', title: nowNeg ? f[1] + ' is below zero (' + inr(ser[last].close) + ' now)' : f[1] + ' dipped below zero at some month-ends (now ' + inr(ser[last].close) + ')', detail: neg.length + ' of ' + ser.length + ' month-ends were negative; lowest ' + inr(Math.min(...neg.map(r => r.close))) + '.', ids: [], amount: ser[last].close, count: neg.length, tab: 'household', sig: f[0]});
  }
  if (R.N && R.cashCum[last] < -tol) add({sev: 'High', code: 'Negative fund balance', title: 'Cash in hand is negative (' + inr(R.cashCum[last]) + ')', detail: 'Cash payments recorded exceed cash received.', ids: [], amount: R.cashCum[last], count: 1, tab: 'cash', sig: 'cash'});
  // reconciliation
  const sbx = bankStatementBalance(), st = sbx ? sbx.bal : null;
  if (R.N && st != null) { const diff = r2(R.bankCum[last] - st); if (Math.abs(diff) > tol) add({sev: 'High', code: 'Unreconciled amount', title: 'Ledger differs from statement balance by ' + inr2(diff), detail: driftText() || ('Ledger ' + inr2(R.bankCum[last]) + ' vs statement ' + inr2(st) + '.'), ids: [], amount: diff, count: 1, tab: 'controls', sig: 'stmt'}); }
  if (R.N && st == null) add({sev: 'Medium', code: 'Unreconciled amount', title: 'No statement balance to compare with', detail: 'Enter it under Setup so the ledger can be reconciled.', ids: [], amount: 0, count: 1, tab: 'setup', sig: 'nostmt'});
  for (const t of R.splitBroken) add({sev: 'Medium', code: 'Split mismatch', title: 'The category split on ' + dFull(t.date) + ' (' + inr(t.amt) + ') no longer adds up', detail: 'The payment or its kind changed since you split it, so the split is ignored and the whole amount keeps one category. Open the row and split again.', ids: [t.id], amount: t.amt, count: 1, tab: 'transactions', sig: 'split' + t.id});
  // cash ledger checks
  for (const c of S.cash) {
    const e = R.byId[c.id];
    if (!validISO(c.date)) { add({sev: 'High', code: 'Invalid date', title: 'Cash entry has an invalid date', detail: c.desc, ids: [c.id], amount: c.amt, count: 1, tab: 'cash', sig: c.id}); continue; }
    if (!(c.desc || '').trim() && !(c.ref || '').trim() && !(c.note || '').trim()) add({sev: 'Medium', code: 'Cash without explanation', title: 'Cash entry on ' + dFull(c.date) + ' for ' + inr(c.amt) + ' has no description, reference or note', detail: '', ids: [c.id], amount: c.amt, count: 1, tab: 'cash', sig: c.id});
    if (c.acct === 'Cash' && c.mode !== 'Cash') add({sev: 'Medium', code: 'Duplicate possibility', title: 'Cash-ledger entry paid by ' + c.mode + ' on ' + dFull(c.date) + ' (' + inr(c.amt) + ')', detail: 'Non-cash payments normally appear in the bank statement already. Check it is not double counted.', ids: [c.id], amount: c.amt, count: 1, tab: 'cash', sig: 'mode' + c.id});
    const dup = possibleBankDup(c);
    if (dup.length && !/^ATM/i.test(c.src || '')) add({sev: 'Medium', code: 'Duplicate possibility', title: 'Cash entry of ' + inr(c.amt) + ' on ' + dFull(c.date) + ' matches a bank row', detail: 'Bank row: ' + dFull(dup[0].date) + ', ' + inr(dup[0].amt) + ', ' + dup[0].person + '. Remove the cash entry if it is the same money.', ids: [c.id, dup[0].id], amount: c.amt, count: 1, tab: 'cash', sig: 'dup' + c.id});
    if (c.acct !== 'Cash') add({sev: 'Low', code: 'Unreconciled amount', title: 'Manual bank entry of ' + inr(c.amt) + ' on ' + dFull(c.date) + ' is not yet in the statement', detail: 'Remove it after the statement is imported so it is not counted twice.', ids: [c.id], amount: c.amt, count: 1, tab: 'cash', sig: 'pend' + c.id});
    if (c.dir === 'Payment' && c.cls !== 'Investment' && (!c.cat || c.cat === 'Uncategorised')) add({sev: 'Low', code: 'Missing category', title: 'Cash payment on ' + dFull(c.date) + ' has no category', detail: c.desc, ids: [c.id], amount: -c.amt, count: 1, tab: 'cash', sig: 'cat' + c.id});
  }
  // ATM cash explained?
  const atmTot = -sum(led.filter(e => e.src === 'Bank' && e.atm && e.kind === 'hhx'), e => e.amt);
  const atmMemo = -sum(led.filter(e => e.memo && e.kind === 'hhx'), e => e.amt);
  if (atmTot > 0.005) {
    if (atmMemo > atmTot + tol) add({sev: 'Medium', code: 'Cash without explanation', title: 'ATM cash itemised (' + inr(atmMemo) + ') is more than withdrawn (' + inr(atmTot) + ')', detail: '', ids: [], amount: atmMemo - atmTot, count: 1, tab: 'cash', sig: 'atmover'});
    else if (atmTot - atmMemo > tol) add({sev: 'Low', code: 'Cash without explanation', title: inr(atmTot - atmMemo) + ' of ATM cash is not itemised yet', detail: 'ATM withdrawals total ' + inr(atmTot) + '; ' + inr(atmMemo) + ' has been itemised in the Cash ledger. Itemise the rest as "ATM cash (already booked)" entries.', ids: [], amount: atmTot - atmMemo, count: 1, tab: 'cash', sig: 'atmleft'});
  }
  // ownership consistency
  if (Math.abs(R.invUnassigned) > tol) add({sev: 'High', code: 'Investment allocation inconsistency', title: inr(R.invUnassigned) + ' of investment money is not assigned to a brother', detail: 'Ownership percentages only cover assigned money.', ids: [], amount: R.invUnassigned, count: 1, tab: 'investments', sig: 'unassigned'});
  // transfers imbalance
  const xf = r2(sum(led.filter(e => e.kind === 'xfer' && e.src === 'Bank'), e => e.amt));
  if (Math.abs(xf) > tol) add({sev: 'Medium', code: 'Unreconciled amount', title: 'Internal transfers do not net to zero (' + inr2(xf) + ')', detail: 'Transfers in and out between family members should cancel.', ids: [], amount: xf, count: 1, tab: 'transactions', sig: 'xfer'});
  // formula/control errors
  for (const c of R.checks || []) { /* filled later */ }
  const sevN = {High: 0, Medium: 1, Low: 2}; out.sort((a, b) => sevN[a.sev] - sevN[b.sev]);
  return out;
}

/* ============ reconciliation checks ============ */
function buildChecks() {
  const tol = S.cfg.tol, ck = [], last = R.N - 1;
  if (last < 0) return ck;
  const B = S.cfg.brothers;
  const add = (name, exp, act, note, forceStatus) => {
    const diff = r2(act - exp);
    ck.push({name, exp, act, diff, note: note || '', status: forceStatus || (Math.abs(diff) <= tol ? 'Reconciled' : 'Difference')});
  };
  const sb = bankStatementBalance(), st = sb ? sb.bal : null;
  if (st == null) ck.push({name: 'Ledger vs bank statement balance', exp: null, act: R.bankCum[last], diff: null, note: 'No statement balance entered.', status: 'Review Required'});
  else add('Ledger vs bank statement balance', st, R.bankCum[last], sb.src === 'statement' ? 'Sum of every bank row against the closing balance on your latest bank statement (' + dFull(sb.date) + ').' : 'Sum of every imported row against the statement balance in your workbook.');
  const funds = FUNDS.reduce((a, f) => a + R.F[f][last].close, 0);
  add('Fund balances add up to ledger total (bank + cash)', R.famCum[last], funds, 'Household + Investment + Special + Medical + Outside the family fund + Unclassified');
  // contributions identity
  for (const t of ['Household', 'Investment']) {
    let req = 0, paid = 0, out = 0, adv = 0;
    for (const b of B) { const x = R.C[b][t][last]; req += x.cumReq; paid += x.cumPaid; out += x.out; adv += x.adv; }
    add(t + ' contributions: required − paid = outstanding − advance', r2(req - paid), r2(out - adv), 'Required ' + inr(req) + ', paid ' + inr(paid));
    const src = sum(R.led.filter(e => e.kind === (t === 'Household' ? 'hhc' : 'invc') && isBro(e.person)), e => e.amt);
    add(t + ' contributions in tracker match source rows', r2(src), r2(paid), 'Tracker total vs transactions tagged ' + (t === 'Household' ? 'Family Expenses' : 'Investments') + ' deposits');
  }
  // household roll-forward
  const H = R.F.H; let o = 0, contrib = 0, rc = 0, sp = 0, adj = 0;
  H.forEach(x => { contrib += x.contrib; rc += x.receipts; sp += x.spend; adj += x.adj; });
  const srcH = sum(R.led.filter(e => e.fund === 'H'), e => e.amt);
  add('Household fund: opening + contributions + other receipts − spending ± adjustments = closing (vs source rows)', r2(srcH), r2(o + contrib + rc - sp + adj), 'Contributions ' + inr(contrib) + ', spending ' + inr(sp));
  const I = R.F.I; let ic = 0, idp = 0, ir = 0;
  I.forEach(x => { ic += x.contrib; idp += x.deployed; ir += x.returned; });
  const srcI = sum(R.led.filter(e => e.fund === 'I'), e => e.amt);
  add('Investment fund: contributions − deployed − withdrawals = closing (vs source rows)', r2(srcI), r2(ic - idp - ir), 'Contributed ' + inr(ic) + ', deployed ' + inr(idp) + ', returned ' + inr(ir));
  const own = ownership(last); const opct = own.rows.reduce((a, r) => a + r.pct, 0);
  add('Ownership percentages add to 100%', own.total > 0 ? 1 : 0, opct, 'Each brother\'s net contribution ÷ total');
  add('Housing goal contributed = net investment contributions', r2(own.total + R.invUnassigned), r2(goalCalc(last).total), '');
  add('Family fund position = fund balances', r2(R.famCum[last]), r2(funds), 'Bank ledger + cash in hand + pending manual bank entries');
  add('Family\'s own money = bank + cash − money held for others', r2(R.famCum[last] - R.F.O[last].close), r2(R.ownCum[last]), 'Money passing through for others is shown separately, not as the family\'s');
  const xf = r2(sum(R.led.filter(e => e.kind === 'xfer' && e.src === 'Bank'), e => e.amt));
  add('Internal transfers net to zero', 0, xf, 'In and out transfers between family accounts');
  const unc = R.led.filter(e => e.kind === 'oth' && !e.flags.includes('Not reviewed'));
  ck.push({name: 'Rows with a usable Purpose', exp: 0, act: unc.length, diff: unc.length, note: unc.length ? unc.length + ' row(s) sit in the Unclassified fund.' : 'Every row is classified.', status: unc.length ? 'Missing Classification' : 'Reconciled'});
  if (S.stmt.length) { const nr = R.led.filter(e => e.flags.includes('Not reviewed')).length;
    ck.push({name: 'Bank statement rows approved', exp: 0, act: nr, diff: nr, note: nr ? nr + ' row(s) wait in To review; until then they count in no fund.' : 'Every statement row is approved.', status: nr ? 'Review Required' : 'Reconciled'}); }
  const held = R.F.O[last].close;
  if (S.stmt.length || Math.abs(held) > tol) ck.push({name: 'Money held for others (outside the family fund)', exp: null, act: held, diff: null, note: Math.abs(held) > tol ? inr2(held) + ' came in for others and has not gone out yet.' : 'Everything that came in for others has gone out again.', status: held < -tol ? 'Review Required' : 'Reconciled'});
  ck.push({name: 'Cash in hand is not negative', exp: 0, act: R.cashCum[last], diff: null, note: '', status: R.cashCum[last] < -tol ? 'Difference' : 'Reconciled'});
  const hn = R.F.H.some(x => x.close < -tol);
  ck.push({name: 'Household fund never below zero', exp: null, act: R.F.H[last].close, diff: null, note: hn ? 'Household fund was overdrawn in ' + R.F.H.filter(x => x.close < -tol).length + ' month-end(s); see Household.' : '', status: hn ? 'Review Required' : 'Reconciled'});
  const atmTot = -sum(R.led.filter(e => e.src === 'Bank' && e.atm && e.kind === 'hhx'), e => e.amt), atmMemo = -sum(R.led.filter(e => e.memo && e.kind === 'hhx'), e => e.amt);
  if (atmTot > 0) ck.push({name: 'ATM cash withdrawn is itemised', exp: atmTot, act: atmMemo, diff: r2(atmMemo - atmTot), note: 'Itemise ATM cash in the Cash ledger so category reports are complete.', status: Math.abs(atmMemo - atmTot) <= tol ? 'Reconciled' : 'Review Required'});
  return ck;
}
