'use strict';
/* ============ HOUSEHOLD ============ */
function vHousehold() {
  const P = periodInfo(), tol = S.cfg.tol, ti = trendIdx(), H = R.F.H, ai = P.end;
  const rows = ti.slice().reverse();
  const first = H[ti[0]], last = H[ti[ti.length - 1]];
  const sumk = k => ti.reduce((a, i) => a + H[i][k], 0);
  const mt = tbl([
    {h: 'Month', f: i => '<b>' + mLong(R.months[i]) + '</b>'}, {h: 'Opening', cls: 'num', f: i => inr(H[i].open)}, {h: 'Contributions', cls: 'num', f: i => inr(H[i].contrib)},
    {h: 'Other receipts', cls: 'num', f: i => inr(H[i].receipts, 2)}, {h: 'Spending', cls: 'num', f: i => inr(H[i].spend)}, {h: 'Adjustments', cls: 'num', f: i => inr(H[i].adj)},
    {h: 'Closing', cls: 'num', f: i => '<td class="num ' + moneyCls(H[i].close) + '"><b>' + inr(H[i].close) + '</b></td>'},
    {h: 'Medical fund', cls: 'num', f: i => inr(R.F.M[i].spend)}, {h: 'Special fund', cls: 'num', f: i => inr(R.F.S[i].net)}
  ], rows, {maxH: 520, foot: '<td>Total</td><td class="num">' + inr(first.open) + '</td><td class="num">' + inr(sumk('contrib')) + '</td><td class="num">' + inr(sumk('receipts'), 2) + '</td><td class="num">' + inr(sumk('spend')) + '</td><td class="num">' + inr(sumk('adj')) + '</td><td class="num">' + inr(last.close) + '</td><td class="num">' + inr(ti.reduce((a, i) => a + R.F.M[i].spend, 0)) + '</td><td class="num">' + inr(ti.reduce((a, i) => a + R.F.S[i].net, 0)) + '</td>'});
  const eqn = '<div class="kv"><div class="r"><span>Opening balance</span><b>' + inr(first.open) + '</b></div><div class="r"><span>+ Contributions received</span><b>' + inr(sumk('contrib')) + '</b></div><div class="r"><span>+ Other receipts (interest, refunds)</span><b>' + inr2(sumk('receipts')) + '</b></div><div class="r"><span>− Household expenditure</span><b>' + inr(sumk('spend')) + '</b></div><div class="r"><span>± Adjustments (internal transfers)</span><b>' + inr(sumk('adj')) + '</b></div><div class="r tot"><span>Closing balance</span><b class="' + (last.close < 0 ? 'tone-neg' : '') + '">' + inr(last.close) + '</b></div></div>';
  const cb = categoryBreakdown(sel(['brother', 'ctype', 'ttype'], e => e.fund === 'H' || e.memo)), tot = cb.reduce((a, x) => a + x.v, 0);
  const ct = panel('Spending by category, ' + P.label, tbl([{h: 'Category', f: x => esc(x.cat)}, {h: 'Amount', cls: 'num', f: x => inr(x.v)}, {h: 'Share', cls: 'num', f: x => tot ? pct(x.v / tot) : '—'}], cb, {foot: '<td>Total</td><td class="num">' + inr(tot) + '</td><td></td>'}), {note: 'Original Purpose is never changed. Categories are a separate layer.'});
  // payee categorisation
  const un = {}; R.led.forEach(e => { if (e.fund === 'H' && e.kind === 'hhx' && e.cat === 'Uncategorised') { const k = e.payee; (un[k] = un[k] || {p: k, n: 0, v: 0}).n++; un[k].v += -e.amt; } });
  const ul = Object.values(un).sort((a, b) => b.v - a.v);
  const cats = Object.keys(S.cfg.categories);
  const pc = panel('Categorise payees', ul.length ? '<div class="small mb">Pick a category and every past and future payment to that payee follows. Nothing in your transactions changes; rules live in Setup.</div>' + tbl([{h: 'Payee', f: x => esc(x.p)}, {h: 'Payments', cls: 'num', f: x => x.n}, {h: 'Total', cls: 'num', f: x => inr(x.v)}, {h: 'Category', f: x => '<select data-rule-payee="' + esc(x.p) + '" aria-label="Category for ' + esc(x.p) + '"><option value="">Choose…</option>' + cats.map(c => '<option>' + esc(c) + '</option>').join('') + '</select>'}], ul.slice(0, 25), {maxH: 420}) + (ul.length > 25 ? '<div class="small mt">Showing the 25 largest of ' + ul.length + ' payees.</div>' : '') : '<div class="small">Every household expense has a category.</div>', {note: ul.length + ' payees · ' + inr(ul.reduce((a, x) => a + x.v, 0)) + ' uncategorised'});
  const med = R.led.filter(e => e.kind === 'med'), ms = {};
  MEDTREAT.forEach(t => ms[t] = sum(med.filter(e => e.treat === t), e => -e.amt));
  const medP = panel('Medical treatment', '<div class="kv">' + MEDTREAT.map(t => '<div class="r"><span>' + t + '</span><b>' + inr(ms[t]) + '</b></div>').join('') + '<div class="r tot"><span>All medical expenses</span><b>' + inr(sum(med, e => -e.amt)) + '</b></div></div><div class="small mt">Default treatment: <b>' + esc(S.cfg.medicalDefault) + '</b> (Setup). Change one payment at a time from Transactions. ' + (H[ai].close < 0 && ms.Household > 0 ? 'Treating medical as separate would lift the household fund by ' + inr(ms.Household) + ' to ' + inr(H[ai].close + ms.Household) + ', with a separate medical fund at −' + inr(ms.Household) + '.' : '') + '</div>', {note: 'Changes reports, never the transactions'});
  CHARTS = [];
  const ch = panel('Household balance', chartSlot('hb', (el, W) => lineChart(el, W, {labels: ti.map(i => mLabel(R.months[i])), series: [{name: 'Household closing balance', color: 'var(--accent)', values: ti.map(i => H[i].close), area: true}], area: true, endLabel: true, aria: 'Household closing balance'}), 220));
  return '<div class="vh"><h1>Household fund</h1><span class="sub">Contributions in, spending out</span></div><div class="grid g12"><div>' + panel('Fund movement, ' + (UI.f.year === 'All' ? 'all time' : UI.f.year), eqn) + '</div>' + ch + '</div>' + panel('Month by month', mt) + '<div class="grid g2 mt">' + ct + medP + '</div>' + pc;
}

/* ============ INVESTMENTS ============ */
function vInvest() {
  const P = periodInfo(), ai = P.end, tol = S.cfg.tol, I = R.F.I, own = ownership(ai), n = S.cfg.brothers.length;
  const eqv = own.total / n;
  const ot = panel('Ownership by actual contribution', tbl([
    {h: 'Brother', f: r => '<b>' + esc(r.b) + '</b>'}, {h: 'Contributed', cls: 'num', f: r => inr(r.contrib)}, {h: 'Returned to brother', cls: 'num', f: r => inr(r.returned)}, {h: 'Net invested', cls: 'num', f: r => '<b>' + inr(r.net) + '</b>'},
    {h: 'Ownership', cls: 'num', f: r => '<b>' + pct(r.pct) + '</b>'}, {h: 'Share of pool', cls: 'num', f: r => inr(r.pct * own.total)}, {h: 'Versus equal share', cls: 'num', f: r => mcell(r.net - eqv)}
  ], own.rows, {foot: '<td>Total</td><td class="num">' + inr(own.rows.reduce((a, r) => a + r.contrib, 0)) + '</td><td class="num">' + inr(own.rows.reduce((a, r) => a + r.returned, 0)) + '</td><td class="num">' + inr(own.total) + '</td><td class="num">' + pct(own.rows.reduce((a, r) => a + r.pct, 0)) + '</td><td class="num">' + inr(own.total) + '</td><td></td>'}), {note: 'As of ' + mLong(P.asOf) + '. Ownership = each brother\'s net contribution ÷ total, not a fixed 25%.'});
  const retd = I.reduce((a, r, i) => i <= ai ? a + r.returned : a, 0), contrib = I.reduce((a, r, i) => i <= ai ? a + r.contrib : a, 0);
  const deployed = I.reduce((a, r, i) => i <= ai ? a + r.deployed : a, 0);
  const kvs = '<div class="kv"><div class="r"><span>Opening investment balance</span><b>' + inr(I[0].open) + '</b></div><div class="r"><span>+ Contributions received</span><b>' + inr(contrib) + '</b></div><div class="r"><span>− Investment deployed</span><b>' + inr(deployed) + '</b></div><div class="r"><span>− Withdrawals returned to brothers</span><b>' + inr(retd) + '</b></div><div class="r"><span>± Adjustments</span><b>' + inr(0) + '</b></div><div class="r tot"><span>Closing investment balance (awaiting deployment)</span><b>' + inr(I[ai].close) + '</b></div></div>' +
    '<div class="kv mt"><div class="r"><span>Total contributed, net of returns</span><b>' + inr(own.total) + '</b></div><div class="r"><span>Deployed so far</span><b>' + inr(deployed) + '</b></div><div class="r"><span>Current investment pool (contributed − returned)</span><b>' + inr(own.total) + '</b></div></div>';
  const H = R.F.H[ai], fam = R.ownCum[ai];
  const call = (H.close < -tol && I.close > 0) ? '<div class="callout warn"><b>Where the investment money actually is.</b> The ledger says ' + inr(I.close) + ' is waiting to be deployed, but the bank and cash hold only ' + inr(fam) + '. The household fund is ' + inr(-H.close) + ' overdrawn, so that gap has effectively been funded from investment contributions. Ownership percentages are unaffected. Decide whether the household fund should repay it.</div>' : '';
  const ti = trendIdx();
  const mt = tbl([{h: 'Month', f: i => '<b>' + mLong(R.months[i]) + '</b>'}, {h: 'Opening', cls: 'num', f: i => inr(I[i].open)}, {h: 'Contributions', cls: 'num', f: i => inr(I[i].contrib)}, {h: 'Deployed', cls: 'num', f: i => inr(I[i].deployed)}, {h: 'Withdrawn', cls: 'num', f: i => inr(I[i].returned)}, {h: 'Closing', cls: 'num', f: i => '<b>' + inr(I[i].close) + '</b>'}], ti.slice().reverse(), {maxH: 380});
  const depl = R.led.filter(e => (e.kind === 'invd' || e.kind === 'invr') && e.month <= P.asOf).slice().reverse();
  const dt = tbl([{h: 'Date', f: e => dFull(e.date)}, {h: 'Person', f: e => esc(e.person)}, {h: 'Treatment', f: e => pill(e.kind === 'invr' ? 'Returned to brother' : 'Deployed', e.kind === 'invr' ? 'warn' : '')}, {h: 'Amount', cls: 'num', f: e => inr(-e.amt)}, {h: 'Description', cls: 'desc', f: e => esc(e.desc.slice(0, 90))}, {h: '', f: e => '<button class="btn sm" data-act="editTx" data-arg="' + esc(e.id) + '">Change</button>'}], depl, {});
  CHARTS = [];
  const ch = panel('Ownership', chartSlot('io', (el, W) => donutChart(el, W, {parts: own.rows.map(r => ({label: r.b, value: r.net, color: broColor(r.b)})), center: lakh(own.total), sub: 'net invested', aria: 'Investment ownership'}), 220));
  return '<div class="vh"><h1>Investment tracker</h1><span class="sub">Kept apart from household money</span></div>' + call + '<div class="grid g21">' + ot + ch + '</div><div class="grid g2">' + panel('Investment fund movement', kvs) + panel('By month', mt) + '</div>' + panel('Money paid out of the pool', dt, {note: 'Deployed = spent on the investment (house advance etc.). Returned = capital handed back to a brother, which lowers his ownership.'});
}

/* ============ HOUSING GOAL ============ */
function vGoal() {
  const P = periodInfo(), gc = goalCalc(P.end), g = S.cfg.goal, B = S.cfg.brothers;
  const fmtM = m => m ? mLong(m) : 'Not within 100 years at this pace';
  const yrs = gc.compl && gc.months !== Infinity ? gc.months / 12 : null;
  const planPer = B.reduce((a, b) => a + planFor(b, 'Investment', gc.asOf).amount, 0);
  const atPlanTotal = planPer * gc.remainingM + gc.total;
  const top = '<div class="grid g2"><div class="panel"><div class="ph"><h3>Progress to ' + lakh(gc.target) + '</h3><span class="note">' + gc.elapsed + ' of ' + gc.totalMonths + ' months used · ends ' + mLong(gc.endMonth) + '</span></div>' + goalMini(gc) + '</div>' +
    panel('Are we on pace?', '<div class="kv"><div class="r"><span>Should have by now (straight line)</span><b>' + inr(gc.expectedNow) + '</b></div><div class="r"><span>Actually contributed</span><b>' + inr(gc.total) + '</b></div><div class="r tot"><span>' + (gc.gap >= 0 ? 'Surplus' : 'Shortfall') + ' against plan</span><b class="' + (gc.gap >= 0 ? 'tone-pos' : 'tone-neg') + '">' + inr(Math.abs(gc.gap)) + '</b></div></div>' +
      '<div class="kv mt"><div class="r"><span>Needed per month, remaining ' + gc.remainingM + ' months (all four)</span><b>' + inr(gc.reqMonthly) + '</b></div><div class="r"><span>Needed per brother per month</span><b>' + inr(gc.reqPerBro) + '</b></div><div class="r"><span>Current pace (' + ({lifetime: 'average since start', last6: 'average of last 6 months', plan: 'current contribution plan'}[g.basis]) + ')</span><b>' + inr(gc.pace) + '</b></div><div class="r"><span>Pace as a share of what is needed</span><b>' + (isFinite(gc.reqMonthly) && gc.reqMonthly > 0 ? pct(gc.pace / gc.reqMonthly, 0) : '—') + '</b></div><div class="r tot"><span>Projected completion</span><b>' + esc(gc.done ? 'Reached' : fmtM(gc.compl)) + '</b></div></div>' +
      '<div class="small mt">' + (yrs ? 'About ' + yrs.toFixed(1) + ' years from now. ' : '') + 'By ' + mLong(gc.endMonth) + ' this pace reaches ' + lakh(gc.atHorizon) + '. The current plan rate of ' + inr(planPer) + '/month would reach ' + lakh(atPlanTotal) + ' by then, with no investment returns assumed' + (g.ret ? ' beyond the ' + g.ret + '% you set' : '') + '.</div>') + '</div>';
  const bt = panel('By brother', tbl([{h: 'Brother', f: r => '<b>' + esc(r.b) + '</b>'}, {h: 'Target share', cls: 'num', f: r => inr(r.target)}, {h: 'Contributed', cls: 'num', f: r => inr(r.contrib)}, {h: 'Completed', cls: 'num', f: r => pct(r.pct)}, {h: 'Remaining', cls: 'num', f: r => inr(r.remaining)}, {h: 'Remaining %', cls: 'num', f: r => pct(1 - r.pct)}, {h: 'Needed / month', cls: 'num', f: r => inr(r.req)}, {h: 'Vs plan', cls: 'num', f: r => mcell(r.contrib - r.expected)}], gc.bro, {foot: '<td>Total</td><td class="num">' + inr(gc.target) + '</td><td class="num">' + inr(gc.total) + '</td><td class="num">' + pct(gc.pct) + '</td><td class="num">' + inr(gc.remaining) + '</td><td class="num">' + pct(1 - gc.pct) + '</td><td class="num">' + inr(gc.reqMonthly) + '</td>' + mcell(gc.gap)}));
  const ti = R.months.map((m, i) => i).filter(i => R.months[i] >= g.start && i <= P.end);
  CHARTS = [];
  const cum = ti.map(i => ownership(i).total + R.invUnassigned);
  const ch = panel('Cumulative contributions against the straight-line plan', chartSlot('gl', (el, W) => lineChart(el, W, {labels: ti.map(i => mLabel(R.months[i])), series: [{name: 'Contributed', color: 'var(--accent)', values: cum, area: true}, {name: 'Straight-line plan', color: 'var(--brass)', dash: true, values: ti.map(i => g.target * (monthDiff(g.start, R.months[i]) + 1) / gc.totalMonths)}], area: true, endLabel: true, aria: 'Housing goal progress'}), 250));
  const rates = [10000, 15000, 20000, 20833, 25000].map(v => ({v, total: v * B.length, months: (g.target - gc.total) / (v * B.length), fin: null}));
  rates.forEach(r => { r.fin = r.months > 0 ? addMonths(gc.asOf, Math.ceil(r.months)) : gc.asOf; });
  const sens = panel('What each monthly amount achieves', tbl([{h: 'Per brother / month', cls: 'num', f: r => inr(r.v)}, {h: 'All four / month', cls: 'num', f: r => inr(r.total)}, {h: 'Reaches goal in', cls: 'num', f: r => (r.months / 12).toFixed(1) + ' years'}, {h: 'Around', f: r => mLong(r.fin)}, {h: 'By ' + mLong(gc.endMonth), cls: 'num', f: r => lakh(gc.total + r.total * gc.remainingM)}], rates), {note: 'Straight contributions, no returns. Uses money contributed so far.'});
  const inp = '<div class="row"><div class="field"><label for="g-basis">Pace used for projection</label><select id="g-basis" data-goal="basis"><option value="lifetime"' + (g.basis === 'lifetime' ? ' selected' : '') + '>Average since start</option><option value="last6"' + (g.basis === 'last6' ? ' selected' : '') + '>Average of last 6 months</option><option value="plan"' + (g.basis === 'plan' ? ' selected' : '') + '>Current contribution plan</option></select></div><div class="field"><label for="g-ret">Assumed yearly return %</label><input id="g-ret" type="text" inputmode="decimal" autocomplete="off" data-num step="0.5" min="0" max="30" value="' + (g.ret || 0) + '" data-goal="ret" style="width:110px"></div><div class="small" style="max-width:38ch">Target, start month and horizon are in Setup. Counts investment contributions net of money returned to brothers.</div></div>';
  return '<div class="vh"><h1>Housing goal</h1><span class="sub">' + lakh(gc.target) + ' · ' + lakh(gc.perB) + ' each · from ' + mLong(g.start) + '</span></div>' + panel('Projection settings', inp, {cls: 'mb'}) + '<div style="height:14px"></div>' + top + '<div class="grid">' + ch + '</div><div class="grid">' + sens + '</div>' + bt;
}

/* ============ MONTHLY REPORT ============ */
function reportData(m) {
  const i = R.mi[m]; if (i == null) return null;
  const B = S.cfg.brothers, con = B.map(b => ({b, H: R.C[b].Household[i], I: R.C[b].Investment[i]}));
  con.forEach(c => { c.status = comboStatus([c.H, c.I]); });
  const ents = R.led.filter(e => e.month === m);
  const spentEntries = ents.filter(e => e.fund === 'H' && ['hhx', 'chg', 'med'].includes(e.kind));
  const payeeMap = {}; spentEntries.forEach(e => { const k = e.payee; payeeMap[k] = (payeeMap[k] || 0) + -e.amt; });
  const top = Object.entries(payeeMap).map(([p, v]) => ({p, v})).sort((a, b) => b.v - a.v).slice(0, 5);
  const own = ownership(i);
  return {
    m, i, con, H: R.F.H[i], I: R.F.I[i], Sp: R.F.S[i], Md: R.F.M[i], cats: categoryBreakdown(ents.filter(e => e.fund === 'H' || e.memo)), top,
    med: ents.filter(e => e.kind === 'med'), spec: ents.filter(e => e.fund === 'S' || e.kind === 'spc'), cash: ents.filter(e => e.src === 'Cash'),
    invIn: B.map(b => ({b, v: sum(ents.filter(e => e.kind === 'invc' && e.person === b), x => x.amt)})), own, goal: goalCalc(i), fam: R.ownCum[i], held: R.F.O[i].close,
    open: R.exceptions.filter(e => !e.ack && e.sev !== 'Low').length, medTreat: S.cfg.medicalDefault
  };
}
function reportPoints(d) {
  const tol = S.cfg.tol, out = d.con.reduce((a, c) => a + c.H.out + c.I.out, 0), behind = d.con.filter(c => c.H.out + c.I.out > tol).length, pts = [];
  if (d.H.close < -tol) pts.push('The household fund is overdrawn by ' + inr(-d.H.close) + (d.I.close > 0 ? '. Investment money is covering the gap, so the bank holds less than the investment fund shows.' : '.'));
  if (out > tol) pts.push(behind + ' brother' + (behind > 1 ? 's have' : ' has') + ' unpaid contributions totalling ' + inr(out) + ' to date.');
  if (d.med.length) pts.push('Medical spending this month was ' + inr(sum(d.med, e => -e.amt)) + ', treated as ' + d.medTreat.toLowerCase() + '.');
  if (d.open) pts.push(d.open + ' item' + (d.open > 1 ? 's are' : ' is') + ' flagged for review in the app.');
  return pts;
}
function vReport() {
  const P = periodInfo(), d = reportData(P.sel); if (!d) return '<div class="empty"><h2>No month selected</h2></div>';
  const tol = S.cfg.tol, B = S.cfg.brothers;
  const tt = d.con.reduce((a, c) => { a.hr += c.H.req; a.hp += c.H.paid; a.ir += c.I.req; a.ip += c.I.paid; a.out += c.H.out + c.I.out; return a; }, {hr: 0, hp: 0, ir: 0, ip: 0, out: 0});
  const req = tt.hr + tt.ir, recv = tt.hp + tt.ip, behind = d.con.filter(c => c.H.out + c.I.out > tol).length;
  const tile = (l, v, dd, tn) => '<div class="rp-tile" style="--kc:var(--' + tn + ')"><div class="l">' + l + '</div><div class="v" style="color:' + (tn === 'info' ? 'var(--ink)' : 'var(--' + tn + ')') + '">' + v + '</div><div class="d">' + dd + '</div></div>';
  const tiles = '<div class="rp-tiles">' + tile('Received this month', inr(recv), req > 0 ? 'of ' + inr(req) + ' due (' + pct(recv / req, 0) + ')' : 'no target this month', recv + tol >= req ? 'pos' : 'warn') + tile('Outstanding to date', inr(tt.out), behind ? behind + ' of ' + B.length + ' brothers behind' : 'nobody behind', tt.out > tol ? 'neg' : 'pos') + tile('Household fund', inr(d.H.close), 'closing balance', d.H.close < -tol ? 'neg' : 'pos') + tile('Family fund position', inr(d.fam), 'bank + cash in hand', 'info') + '</div>';
  const dot = b => '<i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + broColor(b) + ';margin-right:8px"></i>';
  const pos = (o, a) => o > tol ? '<b class="tone-neg">' + inr(-o) + '</b>' : a > tol ? '<b class="tone-pos">+' + inr(a) + '</b>' : '<span class="mute">Settled</span>';
  const ctab = tbl([{h: 'Brother', f: c => dot(c.b) + '<b>' + esc(c.b) + '</b>'}, {h: 'Household due', cls: 'num', f: c => inr(c.H.req)}, {h: 'Household paid', cls: 'num', f: c => inr(c.H.paid)}, {h: 'Investment due', cls: 'num', f: c => inr(c.I.req)}, {h: 'Investment paid', cls: 'num', f: c => inr(c.I.paid)}, {h: 'Owed / ahead', cls: 'num', f: c => '<td class="num">' + pos(c.H.out + c.I.out, c.H.adv + c.I.adv) + '</td>'}, {h: 'Status', f: c => pill(c.status, statusTone(c.status))}], d.con, {nosort: true, foot: '<td>Total</td><td class="num">' + inr(tt.hr) + '</td><td class="num">' + inr(tt.hp) + '</td><td class="num">' + inr(tt.ir) + '</td><td class="num">' + inr(tt.ip) + '</td><td class="num">' + (tt.out > tol ? inr(-tt.out) : '') + '</td><td></td>'});
  const owed = d.con.filter(c => c.H.out + c.I.out > tol), ahead = d.con.filter(c => c.H.adv + c.I.adv > tol);
  const cnote = '<div class="rp-note">' + (owed.length ? '<b>Outstanding:</b> ' + owed.map(c => esc(c.b) + ' ' + inr(c.H.out + c.I.out)).join(', ') + '. ' : 'Nobody has an outstanding amount. ') + (ahead.length ? '<b>Paid ahead:</b> ' + ahead.map(c => esc(c.b) + ' ' + inr(c.H.adv + c.I.adv)).join(', ') + '.' : 'Nobody has paid in advance.') + '</div>';
  const eq = '<div class="rp-eq">' + [['Opening balance', inr(d.H.open)], ['+ Contributions received', inr(d.H.contrib)], ['+ Other receipts', inr2(d.H.receipts)], ['− Spent', inr(d.H.spend)], ['± Adjustments', inr(d.H.adj)]].map(r => '<div class="r"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>').join('') + '<div class="close" style="background:' + (d.H.close < -tol ? 'var(--negbg)' : 'var(--posbg)') + '"><span>Closing balance</span><span style="color:' + (d.H.close < -tol ? 'var(--neg)' : 'var(--pos)') + '">' + inr(d.H.close) + '</span></div></div>';
  const cats = d.cats.slice(0, 7).map(c => ({label: c.cat, v: c.v, color: c.cat === 'Uncategorised' ? '#9AA69F' : 'var(--accent)'}));
  const spent = (cats.length ? hbarsHTML(cats) : '<div class="small">No household spending this month.</div>') + (d.top.length ? '<div class="small mt"><b>LARGEST PAYEES</b></div><div class="kv">' + d.top.slice(0, 3).map(t => '<div class="r"><span>' + esc(t.p) + '</span><span class="mute">' + inr(t.v) + '</span></div>').join('') + '</div>' : '');
  const seg = '<div class="rp-own">' + d.own.rows.map(r => '<span style="width:' + (d.own.total > 0 ? r.net / d.own.total * 100 : 0) + '%;background:' + broColor(r.b) + '"' + tip(r.b + ': ' + pct(r.pct)) + '>' + (r.pct > .09 ? pct(r.pct) : '') + '</span>').join('') + '</div>';
  const leg = '<div class="rp-leg">' + d.own.rows.map(r => '<div><div class="b"><i style="background:' + broColor(r.b) + '"></i>' + esc(r.b) + '</div><div class="a">' + inr(r.net) + ' (' + pct(r.pct) + ')</div><div class="m">this month ' + inr(d.invIn.find(z => z.b === r.b).v) + '</div></div>').join('') + '</div>';
  const strip = '<div class="rp-strip"><span>Received this month <b>' + inr(sum(d.invIn, x => x.v)) + '</b></span><span>Total net invested <b>' + inr(d.own.total) + '</b></span><span>Awaiting deployment (ledger) <b>' + inr(d.I.close) + '</b></span></div>';
  const ms = d.med.concat(d.spec.filter(e => e.kind !== 'med'));
  const mtab = ms.length ? tbl([{h: 'Date', f: e => dFull(e.date)}, {h: 'Payee / description', f: e => esc(e.src === 'Cash' ? (e.desc || e.cat) : e.payee)}, {h: 'Treatment', f: e => esc(e.treat || e.cat || '')}, {h: 'Amount', cls: 'num', f: e => '<b>' + inr(Math.abs(e.amt)) + '</b>'}], ms.slice(0, 12), {nosort: true, foot: '<td>Total</td><td></td><td></td><td class="num">' + inr(sum(ms, e => Math.abs(e.amt))) + '</td>'}) + (ms.length > 12 ? '<div class="rp-note">+ ' + (ms.length - 12) + ' more payments in the app.</div>' : '') : '<div class="small">No medical or special items this month.</div>';
  const ctab2 = d.cash.length ? tbl([{h: 'Date', f: e => dFull(e.date)}, {h: 'Description', f: e => esc(e.desc || '') + (e.memo ? ' <span class="small">(ATM cash)</span>' : '')}, {h: 'Person', f: e => esc(e.person || '')}, {h: 'Amount', cls: 'num', f: e => '<td class="num ' + (e.amt < 0 ? 'neg' : 'pos') + '"><b>' + inr(e.amt) + '</b></td>'}], d.cash.slice(0, 12), {nosort: true}) : '<div class="small">No cash transactions recorded this month.</div>';
  const g = d.goal;
  const goal = '<div class="prog"><div class="fill" style="width:' + Math.min(100, g.pct * 100) + '%"></div><div class="mark" style="left:' + Math.min(100, g.expectedNow / g.target * 100) + '%"></div></div><div class="row mt" style="justify-content:space-between"><b>' + pct(g.pct) + ' complete</b><span class="small" style="color:var(--brass)">Straight-line plan would be at ' + pct(g.expectedNow / g.target) + ' by now</span></div><div class="rp-stats"><div><div class="l">Contributed</div><div class="v">' + inr(g.total) + '</div></div><div><div class="l">Remaining</div><div class="v">' + inr(g.remaining) + '</div></div><div><div class="l">Needed per month</div><div class="v">' + inr(g.reqMonthly) + '</div></div><div><div class="l">Current pace</div><div class="v">' + inr(g.pace) + ' / mo</div></div><div><div class="l">' + (g.gap >= 0 ? 'Ahead of plan' : 'Behind plan') + '</div><div class="v ' + (g.gap >= 0 ? 'tone-pos' : 'tone-neg') + '">' + inr(Math.abs(g.gap)) + '</div></div></div>';
  const i1 = d.i, i0 = Math.max(0, i1 - 5), idx = []; for (let i = i0; i <= i1; i++) idx.push(i);
  const lab = idx.map(i => mLabel(R.months[i]).slice(0, 3)), rq = idx.map(i => B.reduce((a, b) => a + R.C[b].Household[i].req + R.C[b].Investment[i].req, 0)), rc = idx.map(i => B.reduce((a, b) => a + R.C[b].Household[i].paid + R.C[b].Investment[i].paid, 0));
  const t1 = chartSlot('rt1', (el, W) => barChart(el, W, {labels: lab, h: 210, hi: [lab.length - 1], series: [{name: 'Due', color: '#B9C4BD', values: rq}, {name: 'Received', color: 'var(--accent)', values: rc}], aria: 'Contributions due versus received'}), 210);
  const t2 = chartSlot('rt2', (el, W) => barChart(el, W, {labels: lab, h: 210, hi: [lab.length - 1], series: [{name: 'Contributions', color: 'var(--accent)', values: idx.map(i => R.F.H[i].contrib)}, {name: 'Spent', color: '#C9614F', values: idx.map(i => R.F.H[i].spend)}], aria: 'Household money in versus spent'}), 210);
  const pts = reportPoints(d);
  const sec = (n, t, s) => '<div class="rp-sec"><h2>' + n + '. ' + t + '</h2>' + (s ? '<span class="s">' + s + '</span>' : '') + '</div>';
  const html = '<div class="report" id="reportBox"><div class="rp-head"><div><h1>Family Fund Report</h1><div class="mo">' + mLong(d.m) + '</div></div><div class="meta">' + B.map(esc).join(' &nbsp;|&nbsp; ') + '<br>Data through ' + dFull(R.led[R.led.length - 1].date) + '</div></div><div class="rp-body">' + tiles +
    sec(1, 'Contributions this month', 'Household and investment tracked separately') + ctab + cnote +
    '<div class="rp-two"><div>' + sec(2, 'Household fund') + eq + '</div><div>' + sec(3, 'Where it was spent') + spent + '</div></div>' +
    sec(4, 'Investment', 'Ownership follows the money each brother actually put in') + seg + leg + strip +
    sec(5, 'Medical and special items', 'Medical is treated as: ' + esc(d.medTreat)) + mtab +
    sec(6, 'Cash transactions', 'Money that never passed through the bank') + ctab2 +
    sec(7, 'Housing goal', inr(g.target) + ' target, ' + inr(g.perB) + ' per brother') + goal +
    sec(8, 'Last six months', 'Trend up to ' + mLong(d.m)) + '<div class="rp-two"><div><div class="small mb"><b>Contributions due vs received</b></div>' + t1 + '</div><div><div class="small mb"><b>Household money in vs spent</b></div>' + t2 + '</div></div>' +
    (pts.length ? '<div class="rp-pts"><h3>Points for discussion</h3><ul>' + pts.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul></div>' : '') +
    '<div class="rp-foot"><span>Family Fund | ' + mLong(d.m) + '</span><span>Prepared ' + dFull(todayISO()) + '</span></div></div></div>';
  return '<div class="vh"><h1>Monthly report</h1><span class="sub">Choose the month in the filters above</span><div class="actions"><button class="btn primary" data-act="pdfReport">Save as PDF</button><button class="btn" data-act="copyReport">Copy for WhatsApp</button></div></div>' + html;
}
function whatsappText(d) {
  const t = [], tol = S.cfg.tol;
  t.push('*Family fund report: ' + mLong(d.m) + '*', '');
  t.push('*Contributions*');
  d.con.forEach(c => t.push(c.b + ': household ' + inr(c.H.paid) + ' of ' + inr(c.H.req) + ', investment ' + inr(c.I.paid) + ' of ' + inr(c.I.req) + ' (' + c.status + (c.H.out + c.I.out > tol ? ', owes ' + inr(c.H.out + c.I.out) : c.H.adv + c.I.adv > tol ? ', ahead ' + inr(c.H.adv + c.I.adv) : '') + ')'));
  t.push('', '*Household fund*', 'Opening ' + inr(d.H.open) + ', received ' + inr(d.H.contrib + d.H.receipts) + ', spent ' + inr(d.H.spend) + ', closing ' + inr(d.H.close));
  if (d.cats.length) t.push('Top spending: ' + d.cats.slice(0, 4).map(c => c.cat + ' ' + inr(c.v)).join(', '));
  t.push('', '*Investment*', 'Received this month ' + inr(d.invIn.reduce((a, x) => a + x.v, 0)) + '. Net invested ' + inr(d.own.total));
  t.push('Ownership: ' + d.own.rows.map(r => r.b + ' ' + pct(r.pct)).join(', '));
  if (d.med.length) t.push('', '*Medical*', d.med.length + ' payments, ' + inr(sum(d.med, e => -e.amt)));
  if (d.cash.length) t.push('', '*Cash*', d.cash.length + ' cash entries');
  t.push('', '*Housing goal*', pct(d.goal.pct) + ' of ' + lakh(d.goal.target) + ' done. Needed ' + inr(d.goal.reqMonthly) + '/month from here; current pace ' + inr(d.goal.pace) + '.');
  t.push('', 'Total family fund position: ' + inr(d.fam));
  if (Math.abs(d.held) > S.cfg.tol) t.push('Held for others (not the family\'s): ' + inr(d.held));
  return t.join('\n');
}

/* ============ TRANSACTIONS ============ */
function txRows() {
  const q = UI.txq.trim().toLowerCase();
  let rows = UI.txIds ? R.led.filter(e => UI.txIds.includes(e.id)) : sel([]);
  if (UI.txsrc !== 'All') rows = rows.filter(e => e.src === UI.txsrc);
  if (UI.txcls === 'Needs review') rows = rows.filter(e => e.flags.length || e.kind === 'oth' || e.cat === 'Uncategorised');
  else if (UI.txcls !== 'All') rows = rows.filter(e => e.kind === UI.txcls);
  if (q) rows = rows.filter(e => (e.desc + ' ' + e.person + ' ' + e.payee + ' ' + e.cat + ' ' + e.purpose + ' ' + e.amt).toLowerCase().includes(q));
  const dflt = (a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : (b.row || 0) - (a.row || 0);
  const st = UI.txsort;
  if (!st) return rows.slice().sort(dflt);
  const key = {date: e => e.date, src: e => e.src, person: e => e.person || '', purpose: e => e.purpose || '', kind: e => KIND_LABEL[e.kind], cat: e => e.cat || '', mode: e => e.mode || '', amt: e => e.amt, desc: e => (e.desc || '').toLowerCase()}[st.k];
  const dir = st.dir === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => { const x = key(a), y = key(b); const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), undefined, {numeric: true}); return c ? c * dir : dflt(a, b); });
}
function qSelect(attr, id, options, curOv, autoLabel) {
  return '<select class="qedit" data-' + attr + '="' + esc(id) + '"><option value=""' + (curOv ? '' : ' selected') + '>Auto: ' + esc(autoLabel || 'none') + '</option>' +
    options.map(o => '<option' + (o === curOv ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
}
function txTableHTML() {
  const rows = txRows(), pg = 40, pages = Math.max(1, Math.ceil(rows.length / pg));
  UI.txpage = Math.min(UI.txpage, pages - 1);
  const vis = rows.slice(UI.txpage * pg, UI.txpage * pg + pg);
  const tin = sum(rows.filter(e => e.amt > 0), e => e.amt), tout = sum(rows.filter(e => e.amt < 0), e => e.amt);
  const t = tbl([
    {h: 'Date', k: 'date', f: e => dFull(e.date)}, {h: 'Source', k: 'src', f: e => pill(e.src, e.src === 'Cash' ? 'warn' : '')}, {h: 'Person', k: 'person', f: e => esc(e.person || '')}, {h: 'Purpose (original)', k: 'purpose', f: e => esc(e.purpose)},
    {h: 'Treated as', k: 'kind', f: e => esc(KIND_LABEL[e.kind]) + (e.treat ? '<br><span class="small">' + esc(e.treat) + '</span>' : '') + (e.memo ? '<br><span class="small">memo only</span>' : '')}, {h: 'Category', k: 'cat', f: e => {
      if (e.src !== 'Bank' || e.atm || e.splitIdx || !['hhx', 'med', 'spx', 'chg'].includes(e.kind)) return e.cat ? (e.cat === 'Uncategorised' ? '<span class="mute">Uncategorised</span>' : esc(e.cat)) : '';
      return qSelect('qcat', e.id, Object.keys(S.cfg.categories), (S.overlay[e.id] || {}).cat || '', e.cat);
    }},
    {h: 'Mode', k: 'mode', f: e => (e.src !== 'Bank' || e.splitIdx) ? esc(e.mode || '') : qSelect('qmode', e.id, MODES, (S.overlay[e.id] || {}).mode || '', e.mode)}, {h: 'Amount', k: 'amt', cls: 'num', f: e => '<td class="num ' + moneyCls(e.amt) + '">' + inr2(e.amt) + '</td>'}, {h: 'Description', k: 'desc', cls: 'desc', f: e => '<td class="desc" title="' + esc(e.desc || '') + '">' + esc((e.desc || '').slice(0, 110)) + (e.flags.length ? ' ' + e.flags.map(f => pill(f, 'warn')).join(' ') : '') + (e.splitIdx ? ' ' + pill('split ' + e.splitIdx + ' of ' + e.splitN, 'info') : (e.ov ? ' ' + pill('edited layer', 'info') : '')) + '</td>'}
  ], vis, {rowAttr: e => 'class="click" tabindex="0" data-act="editTx" data-arg="' + esc(e.id) + '"', sortBy: {cur: UI.txsort, act: 'txSort'}});
  return '<div class="small mb">' + rows.length + ' rows · in ' + inr2(tin) + ' · out ' + inr2(-tout) + ' · net ' + inr2(tin + tout) + '</div>' + t +
    '<div class="row mt"><button class="btn sm" data-act="txPage" data-arg="-1"' + (UI.txpage <= 0 ? ' disabled' : '') + '>Previous</button><span class="small">Page ' + (UI.txpage + 1) + ' of ' + pages + '</span><button class="btn sm" data-act="txPage" data-arg="1"' + (UI.txpage >= pages - 1 ? ' disabled' : '') + '>Next</button></div>';
}
function vTx() {
  const kinds = ['All', 'Needs review', ...Object.keys(KIND_LABEL)];
  const bar = '<div class="row mb"><div class="field" style="min-width:220px;flex:1"><label for="txq">Search</label><input id="txq" type="search" placeholder="Payee, description, amount…" value="' + esc(UI.txq) + '"></div><div class="field"><label for="txsrc">Source</label><select id="txsrc" data-txf="txsrc">' + ['All', 'Bank', 'Cash'].map(v => '<option' + (UI.txsrc === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div><div class="field"><label for="txcls">Treated as</label><select id="txcls" data-txf="txcls">' + kinds.map(v => '<option value="' + v + '"' + (UI.txcls === v ? ' selected' : '') + '>' + (KIND_LABEL[v] || v) + '</option>').join('') + '</select></div><div class="field"><label>&nbsp;</label><button class="btn" data-act="exportTx">Export CSV</button></div></div>';
  const chip = UI.txIds ? '<div class="callout">Showing ' + UI.txIds.length + ' row(s) from a review item. <button class="btn sm" data-act="clearIds">Show all</button></div>' : '';
  return '<div class="vh"><h1>Transactions</h1><span class="sub">Bank rows are read-only. You can add a category, mode, note or treatment on top.</span></div>' + chip + panel('Ledger', bar + '<div id="txBody">' + txTableHTML() + '</div>', {note: 'Follows the filters above'});
}
