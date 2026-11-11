'use strict';
/* ============ view helpers ============ */
const KIND_LABEL = {hhc: 'Household contribution', invc: 'Investment contribution', spc: 'Special contribution', hhx: 'Household expense', med: 'Medical expense', spx: 'Special expense', invd: 'Investment deployed', invr: 'Investment returned', rcpt: 'Other receipt', ext: 'Outside the family fund', chg: 'Bank charge', xfer: 'Transfer / adjustment', oth: 'Unclassified'};
const FUND_LABEL = {H: 'Household', I: 'Investment', S: 'Special', M: 'Medical (separate)', O: 'Outside the family fund', X: 'Unclassified'};
const pill = (t, tone) => '<span class="pill ' + (tone || '') + '">' + esc(t) + '</span>';
const statusTone = s => ({'Paid': 'pos', 'Partially Paid': 'warn', 'Unpaid': 'neg', 'Overpaid': 'info', 'Advance': 'info'}[s] || '');
const checkTone = s => ({'Reconciled': 'pos', 'Difference': 'neg', 'Review Required': 'warn', 'Missing Classification': 'warn'}[s] || '');
const sevTone = s => ({High: 'neg', Medium: 'warn', Low: 'info'}[s]);
const moneyCls = v => v < -0.005 ? 'neg' : v > 0.005 ? 'pos' : 'mute';
const mcell = (v, d = 0) => '<td class="num ' + moneyCls(v) + '">' + inr(v, d) + '</td>';
function panel(title, body, o = {}) {
  return '<section class="panel ' + (o.cls || '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '><div class="ph"><h3>' + esc(title) + '</h3>' + (o.note ? '<span class="note">' + o.note + '</span>' : '') + (o.right ? '<span class="right">' + o.right + '</span>' : '') + '</div>' + body + '</section>';
}
function tbl(cols, rows, o = {}) {
  const ss = o.sortBy;
  const th = cols.map(c => {
    if (ss && c.k) { const on = ss.cur && ss.cur.k === c.k; return '<th class="sortable ' + (c.cls || '') + '" tabindex="0" data-act="' + ss.act + '" data-arg="' + c.k + '"' + (on ? ' aria-sort="' + (ss.cur.dir === 'asc' ? 'ascending' : 'descending') + '"' : '') + '>' + esc(c.h) + '</th>'; }
    return '<th class="' + (c.cls || '') + '">' + esc(c.h) + '</th>';
  }).join('');
  const tb = rows.map((r, i) => '<tr' + (o.rowAttr ? ' ' + o.rowAttr(r, i) : '') + '>' + cols.map(c => { const v = String(c.f(r, i)); return v.startsWith('<td') ? v : '<td class="' + (c.cls || '') + '">' + v + '</td>'; }).join('') + '</tr>').join('');
  const tf = o.foot ? '<tfoot><tr>' + o.foot + '</tr></tfoot>' : '';
  return '<div class="tw" ' + (o.maxH ? 'style="max-height:' + o.maxH + 'px;overflow:auto"' : '') + '><table class="t"' + (o.nosort || ss ? ' data-nosort' : '') + '><thead><tr>' + th + '</tr></thead><tbody>' + (tb || '<tr><td colspan="' + cols.length + '" class="mute">Nothing to show.</td></tr>') + '</tbody>' + tf + '</table></div>';
}
function kpi(l, v, d, tone) { return '<div class="kpi ' + (tone || '') + '"><div class="l">' + esc(l) + '</div><div class="v">' + v + '</div><div class="d">' + d + '</div></div>'; }
const trendIdx = () => { const y = UI.f.year; return R.months.map((m, i) => i).filter(i => y === 'All' || R.months[i].slice(0, 4) === y); };
const ctMonthSum = (i, fld) => broList().reduce((a, b) => a + ctList().reduce((c, t) => c + R.C[b][t][i][fld], 0), 0);

/* ============ filter bar ============ */
function years() { return [...new Set(R.months.map(m => m.slice(0, 4)))]; }
const EXTRA_KEYS = ['brother', 'ctype', 'cat', 'mode', 'ttype'];
const activeExtraCount = () => EXTRA_KEYS.filter(k => UI.f[k] !== 'All').length;
function renderFilters() {
  const f = UI.f, el = $('#filters'); if (!el) return;
  const opt = (arr, cur, lab) => arr.map(v => '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(lab ? lab(v) : v) + '</option>').join('');
  const cats = ['All', ...Object.keys(S.cfg.categories), 'Cash withdrawn (ATM)', 'Uncategorised'];
  const sl = (id, label, arr, cur, lab, dis) => '<div class="f"><label for="f-' + id + '">' + label + '</label><select id="f-' + id + '" data-f="' + id + '"' + (dis ? ' disabled' : '') + (cur !== 'All' && id !== 'year' && id !== 'month' ? ' class="on"' : '') + '>' + opt(arr, cur, lab) + '</select></div>';
  const n = activeExtraCount(), open = UI.filtersOpen;
  el.innerHTML = sl('year', 'Year', ['All', ...years()], f.year) +
    sl('month', 'Month', ['All', ...Array.from({length: 12}, (_, i) => String(i + 1))], f.month, v => v === 'All' ? 'All' : MFULL[+v - 1], f.year === 'All') +
    '<div class="f more-wrap"><label>&nbsp;</label><button class="btn' + (n ? ' on' : '') + '" type="button" data-act="moreFilters" aria-expanded="' + open + '" aria-controls="f-more-panel">Filters' + (n ? ' <span class="chipcount">' + n + '</span>' : '') + '</button>' +
      '<div class="popover" id="f-more-panel" role="group" aria-label="More filters"' + (open ? '' : ' hidden') + '>' +
        sl('brother', 'Brother', ['All', ...S.cfg.brothers], f.brother) +
        sl('ctype', 'Contribution type', ['All', ...CTYPES], f.ctype) +
        sl('cat', 'Expense category', cats, f.cat) +
        sl('mode', 'Payment mode', ['All', ...MODES], f.mode) +
        sl('ttype', 'Transaction type', ['All', ...TTYPES], f.ttype) +
      '</div></div>' +
    '<div class="f grow"><button class="btn sm" data-act="resetFilters">Reset filters</button></div>';
}
function defaultFilters() {
  if (!R.months.length) return;
  const last = R.months[R.months.length - 1];
  UI.f = {year: last.slice(0, 4), month: String(+last.slice(5, 7)), brother: 'All', ctype: 'All', cat: 'All', mode: 'All', ttype: 'All'};
}

/* ============ OVERVIEW ============ */
function vOverview() {
  const P = periodInfo(), ai = P.end, B = S.cfg.brothers, tol = S.cfg.tol;
  const H = R.F.H[ai], I = R.F.I[ai], Sp = R.F.S[ai], Md = R.F.M[ai], X = R.F.X[ai];
  const fam = R.ownCum[ai], held = R.F.O[ai].close, bank = R.bankCum[ai], cash = R.cashCum[ai] + R.pendCum[ai];
  const isLast = ai === R.N - 1, sbx = bankStatementBalance(), st = sbx ? sbx.bal : null;
  const recOK = isLast && st != null ? Math.abs(R.bankCum[ai] - st) <= tol : null;
  const eq = [['Investment fund', I.close], ['Household fund', H.close]];
  if (Math.abs(Sp.close) > tol) eq.push(['Special / extraordinary fund', Sp.close]);
  if (Math.abs(Md.close) > tol) eq.push(['Separate medical fund', Md.close]);
  if (Math.abs(X.close) > tol) eq.push(['Unclassified / not reviewed', X.close]);
  let msg = '';
  if (H.close < -tol && I.close > 0) msg = 'The household fund is overdrawn by ' + inr(-H.close) + ', so money that was contributed for investment is covering day-to-day and medical spending. See Household and Investments.';
  else if (H.close < -tol) msg = 'The household fund is overdrawn by ' + inr(-H.close) + '.';
  else msg = 'Every fund is at or above zero.';
  const hero = '<div class="hero"><div><div class="lbl">Total family fund position, ' + esc(dFull(R.led.length ? (R.led.filter(e => e.month <= P.asOf).slice(-1)[0] || {date: ''}).date : '')) + '</div><div class="big">' + inr(fam) + '</div><div class="msg">' + esc(msg) + '</div><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><span class="pill">Bank ' + inr2(bank) + '</span>' + (Math.abs(cash) > 0.005 ? '<span class="pill">Cash in hand ' + inr2(cash) + '</span>' : '') + (recOK === true ? '<span class="pill">Matches statement</span>' : recOK === false ? '<button class="pill" style="background:#B03625;border:0;color:#fff;cursor:pointer" data-act="goto" data-arg="controls" title="' + esc(driftText() || 'See Controls') + '">Differs from statement: see why</button>' : '') + '</div><div class="spark">' + sparkSVG(R.ownCum.slice(Math.max(0, ai - 23), ai + 1)) + '</div></div>' +
    '<div class="eq">' + eq.map(([l, v]) => '<div class="r ' + (v < 0 ? 'neg' : '') + '"><span>' + l + '</span><b>' + inr(v) + '</b></div>').join('') + '<div class="r"><span>Total</span><b>' + inr(fam) + '</b></div>' +
    (Math.abs(held) > tol ? '<div class="r held" title="In the bank for someone else until it is paid out. Not counted in the family\'s total."><span>Also in the bank, held for others (not the family\'s)</span><b>' + inr(held) + '</b></div>' : '') + '</div></div>';

  // KPIs
  const si = R.mi[P.sel], req = ctMonthSum(si, 'req'), recv = ctMonthSum(si, 'paid');
  const out = ctMonthSum(ai, 'out'), adv = ctMonthSum(ai, 'adv');
  const spend = sum(sel(['brother', 'ctype', 'ttype'], e => e.fund === 'H' && ['hhx', 'chg', 'med'].includes(e.kind)), e => -e.amt);
  const invc = sum(sel(['ctype', 'cat', 'ttype'], e => e.kind === 'invc'), e => e.amt);
  const invcAll = sum(R.led.filter(e => e.kind === 'invc' && e.month <= P.asOf), e => e.amt);
  const cashE = sel(['ctype', 'cat', 'ttype', 'brother'], e => e.src === 'Cash' && !e.memo);
  const memoN = sel(['ctype', 'cat', 'ttype', 'brother'], e => e.memo).length;
  const medE = sel(['ctype', 'cat', 'brother', 'ttype'], e => e.kind === 'med');
  const gc = goalCalc(ai), ex = R.exceptions.filter(e => !e.ack && e.sev !== 'Low');
  const per = P.single ? mLong(P.sel) : P.label;
  const k = [
    kpi('Required contribution, ' + mLabel(P.sel), inr(req), P.single || true ? 'Household + investment, ' + broList().length + ' brother' + (broList().length > 1 ? 's' : '') : ''),
    kpi('Received, ' + mLabel(P.sel), inr(recv), req > 0 ? pct(recv / req, 0) + ' of what was due that month' : 'No target that month', recv + tol >= req && req > 0 ? 'pos' : ''),
    kpi('Outstanding contribution', inr(out), adv > tol ? 'Advance held: ' + inr(adv) : 'Nobody is ahead', out > tol ? 'neg' : 'pos'),
    kpi('Household fund balance', inr(H.close), 'After medical treated as ' + S.cfg.medicalDefault.toLowerCase(), H.close < -tol ? 'neg' : ''),
    kpi('Investment fund balance', inr(I.close), 'Ledger balance, not cash at bank', ''),
    kpi('Household spending, ' + per, inr(spend), sel(['brother', 'ctype', 'ttype'], e => e.fund === 'H' && ['hhx', 'chg', 'med'].includes(e.kind) && !(e.splitIdx > 1)).length + ' payments'),
    kpi('Investment contributions, ' + per, inr(invc), 'Since start: ' + inr(invcAll)),
    kpi('Cash transactions, ' + per, cashE.length ? inr(sum(cashE, e => Math.abs(e.amt))) : '₹0', cashE.length + ' entries' + (memoN ? ', ' + memoN + ' ATM items' : '')),
    kpi('Medical expenses, ' + per, inr(sum(medE, e => -e.amt)), medE.filter(e => !(e.splitIdx > 1)).length + ' payments'),
    kpi('Housing goal progress', pct(gc.pct), inr(gc.total) + ' of ' + lakh(gc.target), ''),
    kpi('Total family fund position', inr(fam), Math.abs(held) > tol ? 'Bank + cash, less ' + inr(held) + ' held for others' : 'Bank + cash in hand', fam < 0 ? 'neg' : ''),
    kpi('Items to review', String(ex.length), ex.length ? 'High or medium, not yet reviewed' : 'Nothing pending', ex.length ? 'warn' : 'pos')
  ];
  const grp = (t, ix) => '<div class="kgroup"><h2>' + t + '</h2><div class="kgrid">' + ix.map(i => k[i]).join('') + '</div></div>';
  const kp = grp('Contributions', [0, 1, 2, 6]) + grp('Funds', [10, 3, 4, 9]) + grp('Activity', [5, 8, 7, 11]);

  CHARTS = [];
  const ti = trendIdx(), lbl = ti.map(i => mLabel(R.months[i])), hi = ti.map((x, j) => x >= P.start && x <= P.end ? j : -1).filter(j => j >= 0);
  const reqS = ti.map(i => ctMonthSum(i, 'req')), recS = ti.map(i => ctMonthSum(i, 'paid'));
  const c1 = panel('Contribution required vs received', chartSlot('c1', (el, W) => barChart(el, W, {labels: lbl, hi, series: [{name: 'Required', color: 'var(--mute)', values: reqS}, {name: 'Received', color: 'var(--accent)', values: recS}], aria: 'Monthly contribution required versus received'})), {note: 'Selected period shaded'});

  const pos = B.map(b => { const t = ctList().length ? ctList() : []; const o = t.reduce((a, ty) => a + R.C[b][ty][ai].out, 0), ad = t.reduce((a, ty) => a + R.C[b][ty][ai].adv, 0); return {label: b, v: ad - o, color: (ad - o) < -tol ? 'var(--neg)' : 'var(--pos)', sub: (ad - o) < -tol ? 'owed' : (ad - o) > tol ? 'ahead' : 'settled'}; }).filter(r => UI.f.brother === 'All' || r.label === UI.f.brother);
  const c3 = panel('Outstanding by brother', hbarsHTML(pos.map(r => Object.assign({}, r, {v: r.v})), {stack: true}) + '<div class="small mt">Negative = still owed to the fund. Positive = paid ahead. Household and investment combined as of ' + esc(mLong(P.asOf)) + '.</div>');

  const bcat = B.filter(b => broList().includes(b));
  const pInv = b => sum(R.led.filter(e => e.kind === 'invc' && e.person === b && e.month >= P.startM && e.month <= P.asOf), e => e.amt);
  const pHH = b => sum(R.led.filter(e => e.kind === 'hhc' && e.person === b && e.month >= P.startM && e.month <= P.asOf), e => e.amt);
  const c2 = panel('Brother-wise contribution', chartSlot('c2', (el, W) => barChart(el, W, {labels: bcat, series: [{name: 'Household', color: 'var(--c2)', values: bcat.map(pHH)}, {name: 'Investment', color: 'var(--brass)', values: bcat.map(pInv)}], valueLabels: true, aria: 'Contribution by brother'}), 210), {note: esc(P.label)});

  const c6 = panel('Household vs investment contributions', chartSlot('c6', (el, W) => barChart(el, W, {labels: lbl, hi, stacked: true, series: [{name: 'Household', color: 'var(--c2)', values: ti.map(i => B.filter(b => broList().includes(b)).reduce((a, b) => a + R.C[b].Household[i].paid, 0))}, {name: 'Investment', color: 'var(--brass)', values: ti.map(i => B.filter(b => broList().includes(b)).reduce((a, b) => a + R.C[b].Investment[i].paid, 0))}], aria: 'Household versus investment contributions'})));

  const spendM = ti.map(i => sum(sel(['period', 'brother', 'ctype', 'ttype'], e => e.month === R.months[i] && e.fund === 'H' && ['hhx', 'chg', 'med'].includes(e.kind)), e => -e.amt));
  const hhcM = ti.map(i => R.F.H[i].contrib);
  const c4 = panel('Household spending trend', chartSlot('c4', (el, W) => barChart(el, W, {labels: lbl, hi, series: [{name: 'Spending', color: 'var(--neg)', values: spendM}], lines: [{name: 'Household contributions', color: 'var(--accent)', values: hhcM}], aria: 'Household spending trend'})), {note: 'Follows category, mode and type filters'});

  const cb = categoryBreakdown(sel(['brother', 'ctype', 'ttype'], e => e.fund === 'H' || e.memo));
  const ctot = cb.reduce((a, x) => a + x.v, 0), top = cb.slice(0, 9), rest = cb.slice(9).reduce((a, x) => a + x.v, 0);
  const c5 = panel('Where household money went', hbarsHTML(top.concat(rest > 0 ? [{cat: 'Other categories', v: rest}] : []).map(x => ({label: x.cat, v: x.v, color: x.cat === 'Uncategorised' ? 'var(--mute)' : 'var(--accent)', sub: ctot ? pct(x.v / ctot, 0) : ''}))) + (cb.some(x => x.cat === 'Uncategorised') ? '<div class="small mt">Grey = not categorised yet. Assign payees in Household → Categorise payees.</div>' : ''), {note: esc(P.label)});

  const own = ownership(ai);
  const c7 = panel('Investment ownership', chartSlot('c7', (el, W) => donutChart(el, W, {parts: own.rows.map(r => ({label: r.b, value: r.net, color: broColor(r.b)})), center: lakh(own.total), sub: 'invested', aria: 'Investment ownership by brother'}), 210), {note: 'Based on actual money contributed'});

  const c8 = panel('Housing goal', goalMini(gc));

  const inflow = ti.map(i => sum(sel(['period', 'brother', 'ctype', 'ttype'], e => e.month === R.months[i] && e.fund && ['hhc', 'invc', 'spc', 'rcpt'].includes(e.kind)), e => e.amt));
  const outflow = ti.map(i => -sum(sel(['period', 'brother', 'ctype', 'ttype'], e => e.month === R.months[i] && e.fund && ['hhx', 'chg', 'med', 'spx', 'invd', 'invr'].includes(e.kind)), e => e.amt));
  const c9 = panel('Monthly cash flow', chartSlot('c9', (el, W) => barChart(el, W, {labels: lbl, hi, series: [{name: 'Money in', color: 'var(--pos)', values: inflow}, {name: 'Money out', color: 'var(--neg)', values: outflow}], lines: [{name: 'Family fund position', color: 'var(--info)', values: ti.map(i => R.famCum[i])}], aria: 'Monthly cash flow'})), {note: 'Transfers between family accounts excluded'});

  return '<div class="vh"><h1>Overview</h1><span class="sub">' + esc(P.label) + ' · data through ' + esc(dFull(R.led[R.led.length - 1].date)) + '</span><div class="actions"><button class="btn" data-act="handAdd">Add transaction</button></div></div>' + hero + kp +
    '<div class="grid g21">' + c1 + c3 + '</div><div class="grid g2">' + c2 + c6 + '</div><div class="grid g2">' + c4 + c5 + '</div><div class="grid g2">' + c7 + c8 + '</div><div class="grid">' + c9 + '</div>';
}
function goalMini(gc) {
  return '<div class="prog"><div class="fill" style="width:' + Math.min(100, gc.pct * 100) + '%"></div><div class="mark" style="left:' + Math.min(100, gc.expectedNow / gc.target * 100) + '%" title="Where the straight-line plan would be by now"></div></div>' +
    '<div class="row mt" style="justify-content:space-between"><span><b style="font:600 24px var(--serif)">' + pct(gc.pct) + '</b> <span class="small">of ' + lakh(gc.target) + '</span></span><span class="small">Plan marker at ' + pct(gc.expectedNow / gc.target) + '</span></div>' +
    '<div class="kv mt"><div class="r"><span>Contributed</span><b>' + inr(gc.total) + '</b></div><div class="r"><span>Remaining</span><b>' + inr(gc.remaining) + '</b></div><div class="r"><span>Needed each month from now (all four)</span><b>' + inr(gc.reqMonthly) + '</b></div><div class="r"><span>Current pace</span><b>' + inr(gc.pace) + ' / month</b></div><div class="r"><span>' + (gc.gap >= 0 ? 'Ahead of' : 'Behind') + ' straight-line plan by</span><b class="' + (gc.gap >= 0 ? 'tone-pos' : 'tone-neg') + '">' + inr(Math.abs(gc.gap)) + '</b></div></div>';
}

/* ============ CONTRIBUTIONS ============ */
function comboStatus(xs) {
  const o = {req: 0, paid: 0, out: 0, adv: 0, shortfall: 0, suspended: xs.length > 0 && xs.every(x => x.suspended)};
  xs.forEach(x => { o.req += x.req; o.paid += x.paid; o.out += x.out; o.adv += x.adv; o.shortfall += x.shortfall; });
  return statusOf(o, o.req);
}
function vContrib() {
  const P = periodInfo(), ai = R.mi[P.sel], B = broList(), tol = S.cfg.tol;
  const types = ctList().length ? ctList() : ['Household', 'Investment'];
  const blocks = types.map(t => {
    const rows = B.map(b => Object.assign({b}, R.C[b][t][ai]));
    const T = rows.reduce((a, r) => { ['req', 'paid', 'shortfall', 'excess', 'out', 'adv'].forEach(k => a[k] += r[k]); return a; }, {req: 0, paid: 0, shortfall: 0, excess: 0, out: 0, adv: 0});
    const cols = [
      {h: 'Brother', f: r => '<b>' + esc(r.b) + '</b>'}, {h: 'Required', cls: 'num', f: r => inr(r.req)}, {h: 'Paid', cls: 'num', f: r => inr(r.paid)},
      {h: 'Shortfall', cls: 'num', f: r => mcell(-r.shortfall)}, {h: 'Excess', cls: 'num', f: r => mcell(r.excess)},
      {h: 'Outstanding', cls: 'num', f: r => mcell(-r.out)}, {h: 'Advance', cls: 'num', f: r => mcell(r.adv)},
      {h: 'Status', f: r => pill(r.status, statusTone(r.status))}
    ];
    const foot = '<td>Total</td><td class="num">' + inr(T.req) + '</td><td class="num">' + inr(T.paid) + '</td>' + mcell(-T.shortfall) + mcell(T.excess) + mcell(-T.out) + mcell(T.adv) + '<td></td>';
    const stat = rows.length && rows.every(r => r.status === 'Contribution Suspended') ? 'suspended' : '';
    return panel(t + ' contribution, ' + mLong(P.sel), tbl(cols, rows, {foot}), {note: 'Shortfall and excess are for this month. Outstanding and advance are running balances. Late payments clear the oldest arrears first.'});
  });
  const comb = B.map(b => { const xs = ['Household', 'Investment'].map(t => R.C[b][t][ai]); const o = {b, req: 0, paid: 0, out: 0, adv: 0}; xs.forEach(x => { o.req += x.req; o.paid += x.paid; o.out += x.out; o.adv += x.adv; }); o.status = comboStatus(xs); return o; });
  const ct = comb.reduce((a, r) => { ['req', 'paid', 'out', 'adv'].forEach(k => a[k] += r[k]); return a; }, {req: 0, paid: 0, out: 0, adv: 0});
  const combPanel = panel('Total per brother, ' + mLong(P.sel), tbl([
    {h: 'Brother', f: r => '<b>' + esc(r.b) + '</b>'}, {h: 'Total required', cls: 'num', f: r => inr(r.req)}, {h: 'Total paid', cls: 'num', f: r => inr(r.paid)},
    {h: 'Outstanding', cls: 'num', f: r => mcell(-r.out)}, {h: 'Advance / excess', cls: 'num', f: r => mcell(r.adv)}, {h: 'Status', f: r => pill(r.status, statusTone(r.status))}
  ], comb, {foot: '<td>Total</td><td class="num">' + inr(ct.req) + '</td><td class="num">' + inr(ct.paid) + '</td>' + mcell(-ct.out) + mcell(ct.adv) + '<td></td>'}), {note: 'Household and investment are tracked separately; advance in one does not offset arrears in the other.'});

  const T = UI.ctTab, seg = '<div class="seg" role="group" aria-label="Contribution type">' + ['Household', 'Investment'].map(t => '<button data-act="ctTab" data-arg="' + t + '" aria-pressed="' + (T === t) + '">' + t + '</button>').join('') + '</div>';
  const idxs = R.months.map((m, i) => i);
  const matrix = tbl([{h: 'Month', f: (r) => '<b>' + mLong(R.months[r]) + '</b>'}].concat(S.cfg.brothers.map(b => ({h: b, cls: 'num', f: r => { const x = R.C[b][T][r]; const tone = x.out > tol ? 'neg' : x.adv > tol ? 'pos' : 'mute'; return '<td class="num ' + tone + '" title="' + esc(b + ' · required ' + inr(x.req) + ', paid ' + inr(x.paid) + ', ' + x.status) + '">' + inr(x.paid) + ' <span class="small">/ ' + inr(x.req) + '</span><br><span class="small">' + (x.out > tol ? 'owes ' + inr(x.out) : x.adv > tol ? 'ahead ' + inr(x.adv) : x.req > 0 || x.paid > 0 ? 'settled' : '—') + '</span></td>'; }}))).concat([{h: 'All four', cls: 'num', f: r => { const p = S.cfg.brothers.reduce((a, b) => a + R.C[b][T][r].paid, 0), q = S.cfg.brothers.reduce((a, b) => a + R.C[b][T][r].req, 0); return inr(p) + ' <span class="small">/ ' + inr(q) + '</span>'; }}]), idxs.slice().reverse(), {maxH: 480});
  CHARTS = [];
  const lc = panel('Running balance by brother, ' + T.toLowerCase(), chartSlot('cl', (el, W) => lineChart(el, W, {labels: idxs.map(i => mLabel(R.months[i])), series: S.cfg.brothers.map(b => ({name: b, color: broColor(b), values: idxs.map(i => R.C[b][T][i].closePos)})), aria: 'Running contribution balance'}), 230), {note: 'Below zero = owed to the fund, above = paid ahead'});
  const hist = panel('Month-by-month: paid / required', matrix, {right: seg, note: 'Every month, every brother. Hover a cell for status.'});
  return '<div class="vh"><h1>Contribution tracker</h1><span class="sub">' + esc(mLong(P.sel)) + '</span></div>' + combPanel + '<div class="grid mt">' + blocks.join('') + '</div><div class="grid">' + hist + '</div><div class="grid">' + lc + '</div>';
}
