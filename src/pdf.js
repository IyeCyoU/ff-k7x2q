'use strict';
/* ============ presentable PDF report ============ */
function makeReportPDF(d) {
  const {jsPDF} = window.jspdf; const doc = new jsPDF({unit: 'mm', format: 'a4'});
  doc.addFileToVFS('Roboto-Regular.ttf', FONT_R); doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFileToVFS('Roboto-Bold.ttf', FONT_B); doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
  const W = 210, PH = 297, mL = 14, cw = 182, mR = W - mL, bottom = PH - 18, tol = S.cfg.tol;
  let y = 0, page = 1;
  const C = {dark: '#0B4536', accent: '#0D5B49', text: '#1B2A24', mute: '#6B7A73', line: '#D9E0DA', soft: '#F1F5F1', zebra: '#F8FAF7', pos: '#1B7A52', posbg: '#DDEFE5', neg: '#B03625', negbg: '#F6DDD8', warn: '#9A6508', warnbg: '#F6EAD0', info: '#2A5A8C', infobg: '#DEE8F3', brass: '#B5822A', grey: '#E7EBE6'};
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const fill = h => doc.setFillColor(...hex(h)), stroke = h => doc.setDrawColor(...hex(h));
  const font = (st = 'normal', size = 9, col = C.text, fam = 'Roboto') => { doc.setFont(fam, st); doc.setFontSize(size); doc.setTextColor(...hex(col)); };
  const T = (t, x, yy, o) => doc.text(Array.isArray(t) ? t : String(t), x, yy, o);
  const BC = b => ['#2A5A8C', '#0F8A69', '#B5822A', '#8A4B7A', '#4A6FA5', '#76837C'][Math.max(0, S.cfg.brothers.indexOf(b))] || '#76837C';
  const rs = (n, dec = 0) => (n < -0.004 ? '−' : '') + '₹' + Math.abs(n).toLocaleString('en-IN', {minimumFractionDigits: dec, maximumFractionDigits: dec});
  const fit = (s, w) => { s = String(s); if (doc.getTextWidth(s) <= w) return s; while (s.length > 1 && doc.getTextWidth(s + '...') > w) s = s.slice(0, -1); return s + '...'; };
  const tone = {pos: [C.pos, C.posbg], neg: [C.neg, C.negbg], warn: [C.warn, C.warnbg], info: [C.info, C.infobg], mute: [C.mute, C.grey]};
  const stTone = s => ({'Paid': 'pos', 'Partially Paid': 'warn', 'Unpaid': 'neg', 'Overpaid': 'info', 'Advance': 'info'}[s] || 'mute');
  const pillDraw = (txt, x, yy, tn, maxW) => {
    font('bold', 7, tone[tn][0]); const w = Math.min(maxW || 40, doc.getTextWidth(txt) + 5);
    fill(tone[tn][1]); doc.roundedRect(x, yy - 3.6, w, 5, 2.5, 2.5, 'F'); T(txt, x + w / 2, yy, {align: 'center'});
  };
  const newPage = () => {
    doc.addPage(); page++;
    font('bold', 8, C.mute); T('Family Fund Report', mL, 11); font('normal', 8, C.mute); T(mLong(d.m), mR, 11, {align: 'right'});
    stroke(C.line); doc.setLineWidth(.3); doc.line(mL, 13.5, mR, 13.5); y = 21;
  };
  const ensure = h => { if (y + h > bottom) newPage(); };
  const secHead = (t, sub) => { ensure(19); y += 2.5; fill(C.accent); doc.rect(mL, y, 1.6, 5.4, 'F'); font('bold', 11.5, C.dark); T(t, mL + 4.5, y + 4.3); if (sub) { font('normal', 8, C.mute); T(sub, mR, y + 4.3, {align: 'right'}); } y += 9.5; };

  /* ---- header band ---- */
  fill(C.dark); doc.rect(0, 0, W, 36, 'F'); fill(C.brass); doc.rect(0, 36, W, 1.3, 'F');
  font('bold', 23, '#FFFFFF', 'times'); T('Family Fund Report', mL, 16);
  font('normal', 13, '#BFE3D3'); T(mLong(d.m), mL, 25.5);
  font('normal', 8.5, '#CFE6DB'); T('Yaseer  |  Nasir  |  Shakir  |  Zakir', mR, 16, {align: 'right'}); T('Data through ' + dFull(R.led[R.led.length - 1].date), mR, 22, {align: 'right'});
  y = 46;

  /* ---- summary tiles ---- */
  const tt = d.con.reduce((a, c) => { a.hr += c.H.req; a.hp += c.H.paid; a.ir += c.I.req; a.ip += c.I.paid; a.out += c.H.out + c.I.out; a.adv += c.H.adv + c.I.adv; return a; }, {hr: 0, hp: 0, ir: 0, ip: 0, out: 0, adv: 0});
  const req = tt.hr + tt.ir, recv = tt.hp + tt.ip, behind = d.con.filter(c => c.H.out + c.I.out > tol).length;
  const tiles = [
    ['RECEIVED THIS MONTH', rs(recv), req > 0 ? 'of ' + rs(req) + ' due (' + pct(recv / req, 0) + ')' : 'no target this month', recv + tol >= req ? 'pos' : 'warn'],
    ['OUTSTANDING TO DATE', rs(tt.out), behind ? behind + ' of 4 brothers behind' : 'nobody behind', tt.out > tol ? 'neg' : 'pos'],
    ['HOUSEHOLD FUND', rs(d.H.close), 'closing balance', d.H.close < -tol ? 'neg' : 'pos'],
    ['FAMILY FUND POSITION', rs(d.fam), 'bank + cash in hand', d.fam < 0 ? 'neg' : 'info']
  ];
  const tw = (cw - 12) / 4;
  tiles.forEach((t, i) => {
    const x = mL + i * (tw + 4); fill(C.soft); doc.roundedRect(x, y, tw, 24, 2, 2, 'F'); fill(tone[t[3]][0]); doc.roundedRect(x, y, 1.8, 24, .9, .9, 'F');
    font('bold', 6.8, C.mute); T(t[0], x + 5, y + 6.2); font('bold', 13.5, tone[t[3]][0] === C.info ? C.text : tone[t[3]][0]); T(t[1], x + 5, y + 14.4); font('normal', 7.4, C.mute); T(fit(t[2], tw - 8), x + 5, y + 20.4);
  });
  y += 32;

  /* ---- generic table ---- */
  const table = (cols, rows, o = {}) => {
    const rh = o.rh || 6.6, hh = 6.8, total = o.total ? rh + 1 : 0;
    ensure(hh + rh * Math.min(rows.length, 4) + total + 2);
    fill(C.soft); doc.rect(mL, y, cw, hh, 'F'); font('bold', 7, C.mute); let x = mL;
    cols.forEach(c => { T(c.h.toUpperCase(), c.al === 'r' ? x + c.w - 2.5 : x + 2.5, y + 4.6, {align: c.al === 'r' ? 'right' : 'left'}); x += c.w; }); y += hh;
    rows.forEach((r, i) => {
      if (y + rh > bottom) { newPage(); }
      if (i % 2) { fill(C.zebra); doc.rect(mL, y, cw, rh, 'F'); }
      x = mL;
      cols.forEach(c => {
        let v = c.f(r, i); if (typeof v !== 'object' || v === null) v = {t: v};
        const tx = c.al === 'r' ? x + c.w - 2.5 : x + 2.5, by = y + rh / 2 + 1.3;
        if (v.pill) pillDraw(v.t, x + 2.2, by, v.pill, c.w - 3);
        else {
          if (v.dot) { fill(v.dot); doc.circle(x + 3.6, y + rh / 2, 1.2, 'F'); }
          font(v.b ? 'bold' : 'normal', 8.4, v.col || C.text); T(fit(v.t, c.w - (v.dot ? 9 : 5)), v.dot ? x + 6.6 : tx, by, {align: c.al === 'r' ? 'right' : 'left'});
        }
        x += c.w;
      });
      stroke(C.line); doc.setLineWidth(.15); doc.line(mL, y + rh, mR, y + rh); y += rh;
    });
    if (o.total) {
      fill(C.soft); doc.rect(mL, y, cw, rh + 1, 'F'); stroke(C.dark); doc.setLineWidth(.4); doc.line(mL, y, mR, y); x = mL;
      cols.forEach((c, i) => { const v = o.total[i]; if (v != null && v !== '') { font('bold', 8.6, C.text); T(v, c.al === 'r' ? x + c.w - 2.5 : x + 2.5, y + rh / 2 + 1.9, {align: c.al === 'r' ? 'right' : 'left'}); } x += c.w; }); y += rh + 1;
    }
    y += 4;
  };

  /* ---- 1. contributions ---- */
  secHead('1. Contributions this month', 'Household and investment tracked separately');
  const pos = (o, a) => o > tol ? {t: rs(-o), col: C.neg, b: true} : a > tol ? {t: '+' + rs(a), col: C.pos, b: true} : {t: 'Settled', col: C.mute};
  table([
    {h: 'Brother', w: 30, f: c => ({t: c.b, b: true, dot: BC(c.b)})}, {h: 'HH due', w: 22, al: 'r', f: c => rs(c.H.req)}, {h: 'HH paid', w: 22, al: 'r', f: c => rs(c.H.paid)},
    {h: 'Inv due', w: 22, al: 'r', f: c => rs(c.I.req)}, {h: 'Inv paid', w: 22, al: 'r', f: c => rs(c.I.paid)}, {h: 'Owed / ahead', w: 32, al: 'r', f: c => pos(c.H.out + c.I.out, c.H.adv + c.I.adv)}, {h: 'Status', w: 32, f: c => ({t: c.status, pill: stTone(c.status)})}
  ], d.con, {total: ['Total', rs(tt.hr), rs(tt.hp), rs(tt.ir), rs(tt.ip), tt.out > tol ? rs(-tt.out) : '', '']});
  font('normal', 8, C.mute);
  const owed = d.con.filter(c => c.H.out + c.I.out > tol), ahead = d.con.filter(c => c.H.adv + c.I.adv > tol);
  const note1 = (owed.length ? 'Outstanding: ' + owed.map(c => c.b + ' ' + rs(c.H.out + c.I.out)).join(', ') + '.  ' : 'Nobody has an outstanding amount.  ') + (ahead.length ? 'Paid ahead: ' + ahead.map(c => c.b + ' ' + rs(c.H.adv + c.I.adv)).join(', ') + '.' : 'Nobody has paid in advance.');
  const nl = doc.splitTextToSize(note1, cw); T(nl, mL, y - 0.5); y += nl.length * 3.6 + 5;

  /* ---- 2 & 3. household fund + where spent ---- */
  ensure(62);
  const lw = 86, rx = mL + 92, rw = 90, y0 = y;
  secHead('2. Household fund'); const yl = y;
  const eq = [['Opening balance', rs(d.H.open)], ['+ Contributions received', rs(d.H.contrib)], ['+ Other receipts', rs(d.H.receipts, 2)], ['− Spent', rs(d.H.spend)], ['± Adjustments', rs(d.H.adj)]];
  eq.forEach((r, i) => { font('normal', 8.8, C.text); T(r[0], mL, y + 4.6); T(r[1], mL + lw, y + 4.6, {align: 'right'}); stroke(C.line); doc.setLineWidth(.15); doc.line(mL, y + 6.6, mL + lw, y + 6.6); y += 6.9; });
  fill(d.H.close < -tol ? C.negbg : C.posbg); doc.roundedRect(mL, y + 1, lw, 8.4, 1.5, 1.5, 'F'); font('bold', 9.6, C.text); T('Closing balance', mL + 3, y + 6.6); font('bold', 10.5, d.H.close < -tol ? C.neg : C.pos); T(rs(d.H.close), mL + lw - 3, y + 6.7, {align: 'right'});
  const yEndL = y + 10;
  y = y0 + 2.5; // right column
  fill(C.accent); doc.rect(rx, y, 1.6, 5.4, 'F'); font('bold', 11.5, C.dark); T('3. Where it was spent', rx + 4.5, y + 4.3); y += 9.5;
  const cats = d.cats.slice(0, 7), cmax = Math.max(1, ...cats.map(c => c.v));
  if (!cats.length) { font('normal', 8.6, C.mute); T('No household spending this month.', rx, y + 4); y += 8; }
  cats.forEach(c => { font('normal', 8.4, C.text); T(fit(c.cat, 33), rx, y + 4.4); fill(C.soft); doc.roundedRect(rx + 35, y + 1.3, 32, 3.6, 1.2, 1.2, 'F'); fill(c.cat === 'Uncategorised' ? '#9AA69F' : C.accent); doc.roundedRect(rx + 35, y + 1.3, Math.max(1.6, 32 * c.v / cmax), 3.6, 1.2, 1.2, 'F'); font('bold', 8.4, C.text); T(rs(c.v), rx + rw, y + 4.4, {align: 'right'}); y += 6.1; });
  if (d.top.length) {
    y += 2; font('bold', 6.8, C.mute); T('LARGEST PAYEES', rx, y + 3); y += 5.5;
    d.top.slice(0, 3).forEach(t => { font('normal', 8, C.text); T(fit(t.p, 62), rx, y + 3.4); font('normal', 8, C.mute); T(rs(t.v), rx + rw, y + 3.4, {align: 'right'}); y += 5.2; });
  }
  y = Math.max(yEndL, y) + 5;

  /* ---- 4. investment ---- */
  ensure(52);
  secHead('4. Investment', 'Ownership follows the money each brother actually put in');
  const own = d.own; let bx = mL;
  own.rows.forEach(r => {
    const w = own.total > 0 ? cw * r.net / own.total : 0; if (w <= 0) return;
    fill(BC(r.b)); doc.rect(bx, y, w, 8, 'F'); if (w > 16) { font('bold', 8.4, '#FFFFFF'); T(pct(r.pct), bx + w / 2, y + 5.3, {align: 'center'}); } bx += w;
  }); y += 12;
  const qw = cw / 4;
  own.rows.forEach((r, i) => {
    const x = mL + i * qw; fill(BC(r.b)); doc.circle(x + 1.6, y + 1.2, 1.3, 'F'); font('bold', 8.6, C.text); T(r.b, x + 4.4, y + 2.2);
    font('normal', 8.2, C.text); T(rs(r.net) + '  (' + pct(r.pct) + ')', x + 4.4, y + 6.6); font('normal', 7.2, C.mute); T('this month ' + rs(d.invIn.find(z => z.b === r.b).v), x + 4.4, y + 10.6);
  }); y += 15;
  fill(C.soft); doc.roundedRect(mL, y, cw, 9, 1.5, 1.5, 'F'); font('normal', 8.4, C.text);
  T('Received this month', mL + 3, y + 5.7); font('bold', 8.6, C.text); T(rs(d.invIn.reduce((a, x) => a + x.v, 0)), mL + 41, y + 5.7);
  font('normal', 8.4, C.text); T('Total net invested', mL + 68, y + 5.7); font('bold', 8.6, C.text); T(rs(own.total), mL + 100, y + 5.7);
  font('normal', 8.4, C.text); T('Awaiting deployment (ledger)', mL + 122, y + 5.7); font('bold', 8.6, C.text); T(rs(d.I.close), mR - 3, y + 5.7, {align: 'right'}); y += 15;

  /* ---- 5. medical & special ---- */
  const ms = d.med.concat(d.spec.filter(e => e.kind !== 'med')), MAXR = 12;
  ensure(30);
  secHead('5. Medical and special items', 'Medical is treated as: ' + d.medTreat);
  if (ms.length) {
    table([{h: 'Date', w: 26, f: e => dFull(e.date)}, {h: 'Payee / description', w: 92, f: e => String(e.src === 'Cash' ? (e.desc || e.cat) : e.payee)}, {h: 'Treatment', w: 38, f: e => e.treat || e.cat || ''}, {h: 'Amount', w: 26, al: 'r', f: e => ({t: rs(Math.abs(e.amt)), b: true})}], ms.slice(0, MAXR), {total: ['Total', '', '', rs(sum(ms, e => Math.abs(e.amt)))]});
    if (ms.length > MAXR) { font('normal', 7.6, C.mute); T('+ ' + (ms.length - MAXR) + ' more payments; see the app for the full list.', mL, y - 1.5); y += 4; }
  } else { font('normal', 8.8, C.mute); T('No medical or special items this month.', mL, y + 3); y += 10; }

  /* ---- 6. cash ---- */
  ensure(24);
  secHead('6. Cash transactions', 'Money that never passed through the bank');
  if (d.cash.length) table([{h: 'Date', w: 26, f: e => dFull(e.date)}, {h: 'Description', w: 92, f: e => (e.desc || '') + (e.memo ? ' (ATM cash)' : '')}, {h: 'Person', w: 38, f: e => e.person || ''}, {h: 'Amount', w: 26, al: 'r', f: e => ({t: rs(e.amt), b: true, col: e.amt < 0 ? C.neg : C.pos})}], d.cash.slice(0, MAXR));
  else { font('normal', 8.8, C.mute); T('No cash transactions recorded this month.', mL, y + 3); y += 10; }

  /* ---- 7. housing goal ---- */
  ensure(52);
  secHead('7. Housing goal', rs(d.goal.target) + ' target, ' + rs(d.goal.perB) + ' per brother');
  const g = d.goal; fill(C.soft); doc.roundedRect(mL, y, cw, 7, 3.5, 3.5, 'F');
  if (g.pct > 0) { fill(C.accent); doc.roundedRect(mL, y, Math.max(7, cw * Math.min(1, g.pct)), 7, 3.5, 3.5, 'F'); }
  const mk = mL + cw * Math.min(1, g.expectedNow / g.target); stroke(C.brass); doc.setLineWidth(.7); doc.line(mk, y - 1.5, mk, y + 8.5);
  font('bold', 8.6, C.text); T(pct(g.pct) + ' complete', mL, y + 13.5); font('normal', 7.8, C.brass); T('Straight-line plan would be at ' + pct(g.expectedNow / g.target) + ' by now', mR, y + 13.5, {align: 'right'}); y += 19;
  const stats = [['Contributed', rs(g.total), C.text], ['Remaining', rs(g.remaining), C.text], ['Needed per month', rs(g.reqMonthly), C.text], ['Current pace', rs(g.pace) + ' / mo', C.text], [g.gap >= 0 ? 'Ahead of plan' : 'Behind plan', rs(Math.abs(g.gap)), g.gap >= 0 ? C.pos : C.neg]];
  const sw = cw / 5;
  stats.forEach((s, i) => { const x = mL + i * sw; font('normal', 7.2, C.mute); T(s[0].toUpperCase(), x, y + 2); font('bold', 9.6, s[2]); T(fit(s[1], sw - 3), x, y + 8); }); y += 16;

  /* ---- 8. last six months ---- */
  const miniBars = (x, y0, w, h, title, labels, series) => {
    font('bold', 8.6, C.text); T(title, x, y0 + 3);
    let lx = x; series.forEach(sr => { fill(sr.c); doc.roundedRect(lx, y0 + 6, 2.6, 2.6, .6, .6, 'F'); font('normal', 7.2, C.mute); T(sr.n, lx + 4, y0 + 8.2); lx += 7 + doc.getTextWidth(sr.n); });
    const px = x + 11, py = y0 + 12, pw = w - 11, ph = h - 12 - 6;
    const mx = Math.max(1, ...series.flatMap(sr => sr.v)), sc = niceScale(0, mx, 3), top = sc.hi || 1;
    sc.t.forEach(t => { const yy = py + ph - t / top * ph; stroke(C.line); doc.setLineWidth(.15); doc.line(px, yy, x + w, yy); font('normal', 6.6, C.mute); T(axisFmt(t), px - 1.5, yy + 1.2, {align: 'right'}); });
    const band = pw / labels.length, gw = band * .72, bw = gw / series.length;
    labels.forEach((lb, i) => {
      const bx = px + i * band + (band - gw) / 2;
      series.forEach((sr, k) => { const v = sr.v[i] || 0, bh = v / top * ph; if (bh > .1) { fill(sr.c); doc.roundedRect(bx + k * bw + .2, py + ph - bh, Math.max(.8, bw - .4), bh, .5, .5, 'F'); } });
      font('normal', 6.8, i === labels.length - 1 ? C.text : C.mute); T(lb, px + i * band + band / 2, py + ph + 4, {align: 'center'});
    });
  };
  {
    const i1 = d.i, i0 = Math.max(0, i1 - 5), idx = []; for (let i = i0; i <= i1; i++) idx.push(i);
    const lab = idx.map(i => MS[+R.months[i].slice(5, 7) - 1]), B = S.cfg.brothers;
    const rq = idx.map(i => B.reduce((a, b) => a + R.C[b].Household[i].req + R.C[b].Investment[i].req, 0)), rc = idx.map(i => B.reduce((a, b) => a + R.C[b].Household[i].paid + R.C[b].Investment[i].paid, 0));
    ensure(64); secHead('8. Last six months', 'Trend up to ' + mLong(d.m));
    miniBars(mL, y, 88, 46, 'Contributions due vs received', lab, [{n: 'Due', c: '#B9C4BD', v: rq}, {n: 'Received', c: C.accent, v: rc}]);
    miniBars(mL + 94, y, 88, 46, 'Household money in vs spent', lab, [{n: 'Contributions', c: C.accent, v: idx.map(i => R.F.H[i].contrib)}, {n: 'Spent', c: '#C9614F', v: idx.map(i => R.F.H[i].spend)}]);
    y += 54;
  }

  /* ---- points for discussion ---- */
  const pts = reportPoints(d);
  if (pts.length) {
    font('normal', 8.4, C.text); const lines = pts.map(p => doc.splitTextToSize(p, cw - 14)), h = 10 + lines.reduce((a, l) => a + l.length * 3.9 + 1.6, 0);
    ensure(h + 2); fill(C.warnbg); doc.roundedRect(mL, y, cw, h, 2, 2, 'F'); fill(C.brass); doc.roundedRect(mL, y, 1.8, h, .9, .9, 'F');
    font('bold', 8.6, C.warn); T('POINTS FOR DISCUSSION', mL + 6, y + 6); let yy = y + 11.5;
    lines.forEach(l => { font('normal', 8.4, C.text); doc.circle(mL + 7, yy - 1, .6, 'F'); T(l, mL + 10, yy); yy += l.length * 3.9 + 1.6; }); y += h + 2;
  }

  /* ---- footer on every page ---- */
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); stroke(C.line); doc.setLineWidth(.3); doc.line(mL, PH - 13, mR, PH - 13);
    font('normal', 7.6, C.mute); T('Family Fund  |  ' + mLong(d.m), mL, PH - 8.5); T('Page ' + i + ' of ' + n, mR, PH - 8.5, {align: 'right'});
  }
  return doc.output('arraybuffer');
}
