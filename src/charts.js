'use strict';
/* ============ SVG chart kit (measured, re-rendered on resize, hover tooltips) ============ */
const broColor = b => { const i = S.cfg.brothers.indexOf(b); return ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--info)', 'var(--mute)'][i < 0 ? 5 : i % 6]; };
let CHARTS = [], CH_ID = 0;
function chartSlot(id, drawFn, minH = 200) {
  CHARTS.push({id, drawFn});
  return '<div class="chart" id="ch-' + id + '" style="min-height:' + minH + 'px"></div>';
}
function drawCharts() {
  for (const c of CHARTS) {
    const el = document.getElementById('ch-' + c.id); if (!el) continue;
    try { c.drawFn(el, Math.max(260, el.clientWidth || 600)); }
    catch (e) { el.innerHTML = '<div class="small tone-neg">Chart could not be drawn: ' + esc(e.message) + '</div>'; }
  }
}
function niceScale(min, max, ticks = 5) {
  if (max === min) { max = min + 1; }
  const span = max - min, raw = span / ticks, pow = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, t = [];
  for (let v = lo; v <= hi + step / 2; v += step) t.push(+v.toFixed(6));
  return {lo, hi, t};
}
const tip = t => ' data-tip="' + esc(t) + '"';
function legendHTML(items) { return '<div class="legend">' + items.map(i => '<span><i style="background:' + i.color + '"></i>' + esc(i.name) + '</span>').join('') + '</div>'; }
function rrect(x, y, w, h, r, fill, extra) {
  r = Math.min(r, w / 2, h);
  return '<path d="M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h) + 'Z" fill="' + fill + '"' + (extra || '') + '/>';
}
function rrectNeg(x, y, w, h, r, fill, extra) {
  r = Math.min(r, w / 2, h);
  return '<path d="M' + x + ' ' + y + 'V' + (y + h - r) + 'Q' + x + ' ' + (y + h) + ' ' + (x + r) + ' ' + (y + h) + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w) + ' ' + (y + h - r) + 'V' + y + 'Z" fill="' + fill + '"' + (extra || '') + '/>';
}

function barChart(el, W, o) {
  const H = o.h || 240, L = 48, Rr = 10, T = 18, Bm = 28, n = o.labels.length, S_ = o.series;
  let mn = 0, mx = 0;
  for (let i = 0; i < n; i++) {
    if (o.stacked) { let p = 0, q = 0; S_.forEach(s => { const v = s.values[i] || 0; if (v >= 0) p += v; else q += v; }); mx = Math.max(mx, p); mn = Math.min(mn, q); }
    else S_.forEach(s => { const v = s.values[i] || 0; mx = Math.max(mx, v); mn = Math.min(mn, v); });
  }
  if (o.lines) o.lines.forEach(s => s.values.forEach(v => { mx = Math.max(mx, v); mn = Math.min(mn, v); }));
  const sc = niceScale(mn, mx || 1, 4), pw = W - L - Rr, ph = H - T - Bm;
  const y = v => T + ph - (v - sc.lo) / (sc.hi - sc.lo) * ph, band = pw / Math.max(1, n);
  let g = '';
  sc.t.forEach(v => { g += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--grid)" stroke-width="1"' + (v === 0 ? '' : ' stroke-dasharray="2 4"') + '/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="var(--mute)">' + axisFmt(v) + '</text>'; });
  const zero = y(0); g += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + zero + '" y2="' + zero + '" stroke="var(--mute)" stroke-width="1" opacity=".7"/>';
  const every = Math.ceil(n / Math.max(1, Math.floor(pw / 46)));
  for (let i = 0; i < n; i++) {
    const x0 = L + i * band, hl = o.hi && o.hi.includes(i);
    if (hl) g += '<rect x="' + x0 + '" y="' + T + '" width="' + band + '" height="' + ph + '" rx="6" fill="var(--infobg)" opacity=".75"/>';
    const gw = band * (o.stacked ? .62 : .76), ns = o.stacked ? 1 : S_.length, bw = gw / ns, off = x0 + (band - gw) / 2;
    let pos = 0, neg = 0;
    S_.forEach((s, k) => {
      const v = s.values[i] || 0; if (!v) return;
      const t = tip(o.labels[i] + '\n' + s.name + ': ' + inr(v));
      if (o.stacked) {
        const xx = off + .5, ww = Math.max(1, bw - 1);
        if (v >= 0) { const yy = y(pos + v), hh = y(pos) - y(pos + v); const top = !S_.slice(k + 1).some(z => (z.values[i] || 0) > 0); g += top ? rrect(xx, yy, ww, Math.max(.5, hh), 4, s.color, t) : '<rect x="' + xx + '" y="' + yy + '" width="' + ww + '" height="' + Math.max(.5, hh) + '" fill="' + s.color + '"' + t + '/>'; pos += v; }
        else { const yy = y(neg), hh = y(neg + v) - y(neg); g += rrectNeg(xx, yy, ww, Math.max(.5, hh), 4, s.color, t); neg += v; }
      } else {
        const xx = off + k * bw + .75, ww = Math.max(1.5, bw - 1.5), hh = Math.max(.5, Math.abs(y(v) - zero));
        g += v >= 0 ? rrect(xx, y(v), ww, hh, 4, s.color, t) : rrectNeg(xx, zero, ww, hh, 4, s.color, t);
        if (o.valueLabels && ww >= 26 && v > 0) g += '<text x="' + (xx + ww / 2) + '" y="' + (y(v) - 5) + '" text-anchor="middle" font-size="10.5" font-weight="600" fill="var(--ink2)">' + axisFmt(v) + '</text>';
      }
    });
    if (i % every === 0) g += '<text x="' + (x0 + band / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="var(--mute)">' + esc(o.labels[i]) + '</text>';
  }
  (o.lines || []).forEach(s => {
    const pts = s.values.map((v, i) => [L + i * band + band / 2, y(v)]);
    g += '<polyline fill="none" stroke="' + s.color + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" ' + (s.dash ? 'stroke-dasharray="5 4"' : '') + ' points="' + pts.map(p => p.join(',')).join(' ') + '"/>';
    if (n <= 24) pts.forEach((p, i) => { g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.2" fill="var(--surface)" stroke="' + s.color + '" stroke-width="2"' + tip(o.labels[i] + '\n' + s.name + ': ' + inr(s.values[i])) + '/>'; });
  });
  el.innerHTML = (o.legend === false ? '' : legendHTML(S_.concat(o.lines || []))) + '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Bar chart') + '">' + g + '</svg>';
}

function lineChart(el, W, o) {
  const H = o.h || 240, L = 52, Rr = 14, T = 30, Bm = 28, n = o.labels.length, gid = 'lg' + (++CH_ID);
  let mn = Infinity, mx = -Infinity;
  o.series.forEach(s => s.values.forEach(v => { mn = Math.min(mn, v); mx = Math.max(mx, v); }));
  if (o.refs) o.refs.forEach(r => { mn = Math.min(mn, r.value); mx = Math.max(mx, r.value); });
  if (!isFinite(mn)) { mn = 0; mx = 1; } mn = Math.min(mn, 0); mx = Math.max(mx, 0);
  const sc = niceScale(mn, mx, 4), pw = W - L - Rr, ph = H - T - Bm;
  const y = v => T + ph - (v - sc.lo) / (sc.hi - sc.lo) * ph, x = i => L + (n <= 1 ? pw / 2 : i / (n - 1) * pw);
  let g = '<defs>' + o.series.map((s, k) => '<linearGradient id="' + gid + k + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:' + s.color + ';stop-opacity:.28"/><stop offset="1" style="stop-color:' + s.color + ';stop-opacity:0"/></linearGradient>').join('') + '</defs>';
  sc.t.forEach(v => { g += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--grid)"' + (v === 0 ? '' : ' stroke-dasharray="2 4"') + '/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="var(--mute)">' + axisFmt(v) + '</text>'; });
  if (sc.lo < 0) g += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="var(--mute)" opacity=".7"/>';
  (o.refs || []).forEach(r => { g += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(r.value) + '" y2="' + y(r.value) + '" stroke="' + r.color + '" stroke-dasharray="6 4"/><text x="' + (W - Rr) + '" y="' + (y(r.value) - 4) + '" text-anchor="end" font-size="11" fill="' + r.color + '">' + esc(r.label) + '</text>'; });
  const every = Math.ceil(n / Math.max(1, Math.floor(pw / 52)));
  for (let i = 0; i < n; i += 1) if (i % every === 0) g += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="var(--mute)">' + esc(o.labels[i]) + '</text>';
  o.series.forEach((s, k) => {
    const pts = s.values.map((v, i) => [x(i), y(v)]);
    if (o.area && s.area) g += '<polygon fill="url(#' + gid + k + ')" points="' + pts.map(p => p.join(',')).join(' ') + ' ' + x(n - 1) + ',' + y(0) + ' ' + x(0) + ',' + y(0) + '"/>';
    g += '<polyline fill="none" stroke="' + s.color + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" ' + (s.dash ? 'stroke-dasharray="6 4"' : '') + ' points="' + pts.map(p => p.join(',')).join(' ') + '"/>';
    if (n <= 30) pts.forEach((p, i) => { g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i === n - 1 ? 4.4 : 3) + '" fill="' + (i === n - 1 ? s.color : 'var(--surface)') + '" stroke="' + s.color + '" stroke-width="2"' + tip(o.labels[i] + '\n' + s.name + ': ' + inr(s.values[i])) + '/>'; });
    if (o.endLabel && n) { const p = pts[n - 1], lab = lakh(s.values[n - 1]), w = lab.length * 6.6 + 14; g += '<rect x="' + (p[0] - w + 4) + '" y="' + (p[1] - 28) + '" width="' + w + '" height="19" rx="9.5" fill="' + s.color + '"/><text x="' + (p[0] - w / 2 + 4) + '" y="' + (p[1] - 15) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">' + esc(lab) + '</text>'; }
  });
  el.innerHTML = legendHTML(o.series) + '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Line chart') + '">' + g + '</svg>';
}

function donutChart(el, W, o) {
  const size = Math.min(W, o.size || 230), r = size / 2 - 6, cx = size / 2, cy = size / 2, sw = r * .34;
  const tot = o.parts.reduce((a, p) => a + Math.max(0, p.value), 0), gap = o.parts.filter(p => p.value > 0).length > 1 ? .025 : 0;
  let a0 = -Math.PI / 2, g = '';
  if (tot <= 0) g = '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - sw / 2) + '" fill="none" stroke="var(--line)" stroke-width="' + sw + '"/>';
  o.parts.forEach(p => {
    const v = Math.max(0, p.value); if (!v) return;
    const frac = v / tot, a1 = a0 + frac * Math.PI * 2, rr = r - sw / 2, s0 = a0 + gap, s1 = Math.max(s0 + .001, a1 - gap - (frac > .999 ? .001 : 0));
    const x0 = cx + rr * Math.cos(s0), y0 = cy + rr * Math.sin(s0), x1 = cx + rr * Math.cos(s1), y1 = cy + rr * Math.sin(s1);
    g += '<path d="M' + x0 + ' ' + y0 + ' A' + rr + ' ' + rr + ' 0 ' + ((s1 - s0) > Math.PI ? 1 : 0) + ' 1 ' + x1 + ' ' + y1 + '" fill="none" stroke="' + p.color + '" stroke-width="' + sw + '"' + tip(p.label + '\n' + pct(frac) + ' · ' + inr(v)) + '/>';
    a0 = a1;
  });
  g += '<text x="' + cx + '" y="' + (cy - 1) + '" text-anchor="middle" font-family="var(--serif)" font-size="' + (size / 7.6) + '" font-weight="600" fill="var(--ink)">' + esc(o.center || '') + '</text><text x="' + cx + '" y="' + (cy + size / 10) + '" text-anchor="middle" font-size="12" fill="var(--mute)">' + esc(o.sub || '') + '</text>';
  const leg = o.parts.map(p => '<div class="row" style="justify-content:space-between;gap:12px;font-size:13.5px;padding:6px 0;border-bottom:1px solid var(--line2);flex-wrap:nowrap"><span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + p.color + ';margin-right:9px"></i>' + esc(p.label) + '</span><span><b>' + (tot > 0 ? pct(Math.max(0, p.value) / tot) : '—') + '</b> <span class="small">' + lakh(p.value) + '</span></span></div>').join('');
  el.innerHTML = '<div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap"><svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="' + esc(o.aria || 'Donut chart') + '" style="flex:none;width:' + size + 'px;max-width:100%;height:auto">' + g + '</svg><div style="flex:1;min-width:190px">' + leg + '</div></div>';
}

/* horizontal bars (html); supports negatives with a zero line */
function hbarsHTML(rows, o = {}) {
  if (!rows.length) return '<div class="small">Nothing to show for this selection.</div>';
  const mx = Math.max(...rows.map(r => Math.abs(r.v)), 1), hasNeg = rows.some(r => r.v < 0), fmt = o.fmt || (v => inr(v));
  return '<div class="hb' + (o.stack ? ' stack' : '') + '">' + rows.map(r => {
    const w = Math.abs(r.v) / mx * (hasNeg ? 50 : 100), left = hasNeg ? (r.v < 0 ? 50 - w : 50) : 0;
    return '<div class="row"><span title="' + esc(r.label) + '" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.label) + '</span><span class="track">' + (hasNeg ? '<i class="zero" style="left:50%"></i>' : '') + '<i class="fill" style="left:' + left + '%;width:' + Math.max(w, .8) + '%;background:' + (r.color || 'var(--accent)') + '"></i></span><span class="n">' + fmt(r.v) + (r.sub ? ' <span class="small">' + esc(r.sub) + '</span>' : '') + '</span></div>';
  }).join('') + '</div>';
}

/* tiny trend line for the hero (white on dark) */
function sparkSVG(vals, w = 340, h = 54) {
  if (vals.length < 2) return '';
  const mn = Math.min(...vals), mx = Math.max(...vals), rng = (mx - mn) || 1, pad = 5;
  const pts = vals.map((v, i) => [pad + i / (vals.length - 1) * (w - 2 * pad), pad + (1 - (v - mn) / rng) * (h - 2 * pad)]);
  const id = 'sp' + (++CH_ID), last = pts[pts.length - 1];
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><polygon fill="url(#' + id + ')" points="' + pts.map(p => p.join(',')).join(' ') + ' ' + last[0] + ',' + h + ' ' + pts[0][0] + ',' + h + '"/><polyline fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".92" points="' + pts.map(p => p.join(',')).join(' ') + '"/><circle cx="' + last[0] + '" cy="' + last[1] + '" r="3.6" fill="#fff"/></svg>';
}
