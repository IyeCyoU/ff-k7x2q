'use strict';
/* ============ routing & render ============ */
const TABS = [['overview', 'Overview'], ['contributions', 'Contributions'], ['household', 'Household'], ['investments', 'Investments'], ['goal', 'Housing goal'], ['report', 'Monthly report'], ['review', 'To review'], ['transactions', 'Transactions'], ['cash', 'Cash ledger'], ['controls', 'Controls'], ['setup', 'Setup']];
const VIEWS = {overview: vOverview, contributions: vContrib, household: vHousehold, investments: vInvest, goal: vGoal, report: vReport, review: vReview, transactions: vTx, cash: vCash, controls: vControls, setup: vSetup};

function emptyState() {
  return '<div class="vh"><h1>Family Fund</h1></div><div class="empty" id="drop"><svg class="ill" viewBox="0 0 160 110" aria-hidden="true"><rect x="8" y="88" width="144" height="4" rx="2" fill="var(--line)"/><path d="M34 52 80 16l46 36" fill="none" stroke="var(--accent)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 48v40h72V48" fill="var(--surface2)" stroke="var(--accent)" stroke-width="4" stroke-linejoin="round"/><rect x="70" y="64" width="20" height="24" rx="3" fill="var(--accent)"/><rect x="50" y="58" width="9" height="30" rx="2" fill="var(--c3)"/><rect x="101" y="52" width="9" height="36" rx="2" fill="var(--c2)"/></svg><h2>Import your contribution workbook</h2><p>Choose the Excel file with your Transactions sheet. It is read on this device and never uploaded. Your plan, categories, cash entries and notes are kept separately, so a fresh copy can be imported every month.</p><div class="steps"><span>1. Choose the .xlsx</span><span>2. Review the import</span><span>3. See the dashboard</span></div><button class="btn primary" data-act="pickFile">Choose workbook (.xlsx)</button><p class="small" style="margin-top:16px">or drop the file anywhere on this card</p></div>';
}
const NAVG = [['Dashboard', ['overview', 'contributions', 'household', 'investments', 'goal']], ['Reports and records', ['review', 'report', 'transactions', 'cash']], ['Admin', ['controls', 'setup']]];
const ICONS = {
  overview: '<path d="M3.5 11.5 12 4l8.5 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1v-9"/>',
  contributions: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.2 2.7-5.4 6-5.4s6 2.2 6 5.4"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18.5 14.4c1.6.7 2.5 2.2 2.5 4.6"/>',
  household: '<path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h11.5v3"/><path d="M3.5 7.5v10A2.5 2.5 0 0 0 6 20h13.5a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6a2.5 2.5 0 0 1-2.5-1.5"/><circle cx="16.5" cy="14.5" r="1.2"/>',
  investments: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  goal: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  report: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z"/><path d="M14 3.5v4h4M9 12h6M9 15.5h6"/>',
  transactions: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r=".9"/><circle cx="4" cy="12" r=".9"/><circle cx="4" cy="18" r=".9"/>',
  review: '<path d="M9 11l3 3L21 5"/><path d="M20 12v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19V5.5A1.5 1.5 0 0 1 5.5 4H15"/>',
  cash: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
  controls: '<path d="M12 3.5 19 6v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  setup: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'
};
const TABNAME = Object.fromEntries(TABS);
const BOTTOM_PRIMARY = ['overview', 'contributions', 'report', 'transactions'];
function renderNav() {
  const bn0 = $('#brandNames'); if (bn0) bn0.textContent = S.cfg.brothers.join(' · ');
  const open = R.exceptions.filter(e => !e.ack && e.sev !== 'Low').length, todo = S.stmt.filter(t => !S.review[t.id]).length;
  $('#nav').innerHTML = NAVG.map(([g, ks]) => '<div class="grp">' + g + '</div>' + ks.map(k => '<button data-act="goto" data-arg="' + k + '"' + (UI.tab === k ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[k] + '</svg>' + TABNAME[k] + (k === 'controls' && open ? '<span class="badge">' + open + '</span>' : '') + (k === 'review' && todo ? '<span class="badge">' + todo + '</span>' : '') + '</button>').join('')).join('');
  const bn = $('#bottomnav'); if (!bn) return;
  const more = !BOTTOM_PRIMARY.includes(UI.tab);
  bn.innerHTML = BOTTOM_PRIMARY.map(k => '<button data-act="goto" data-arg="' + k + '"' + (UI.tab === k ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[k] + '</svg>' + TABNAME[k] + '</button>').join('') +
    '<button data-act="moreNav"' + (more ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>More' + (more && open ? '<span class="badge">' + open + '</span>' : '') + '</button>';
}
/* ---- keep your place across redraws ----
   Most edits redraw the page. Without this, the box you were moving to (by Tab or a tap) is destroyed
   and the cursor is lost, and open sections snap shut. Note where you were heading, redraw, then put
   the cursor there and reopen what was open. */
const FOCUSABLE = 'input:not([type=hidden]),select,textarea,button,summary,a[href],[tabindex]:not([tabindex="-1"])';
function placeSig(el) {
  if (!el || el === document.body || !el.isConnected) return null;
  if (el.id) return {id: el.id};
  const attrs = [...el.attributes].filter(a => a.name.startsWith('data-') || a.name === 'name' || a.name === 'aria-label').map(a => [a.name, a.value]);
  const root = el.closest('#view,#filters,#modalRoot,#nav,#bottomnav') || document.body;
  const same = [...root.querySelectorAll(el.tagName)].filter(x => attrs.every(([n, v]) => x.getAttribute(n) === v));
  return {root: root.id, tag: el.tagName, attrs, n: same.indexOf(el)};
}
function findSig(sig) {
  if (!sig) return null;
  if (sig.id) return document.getElementById(sig.id);
  const root = (sig.root && document.getElementById(sig.root)) || document.body;
  return [...root.querySelectorAll(sig.tag)].filter(x => sig.attrs.every(([n, v]) => x.getAttribute(n) === v))[sig.n] || null;
}
const PLACE = {intent: null, at: 0};
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Tab') return;
  const all = [...document.querySelectorAll(FOCUSABLE)].filter(x => !x.disabled && x.offsetParent !== null), i = all.indexOf(document.activeElement);
  if (i > -1) { PLACE.intent = placeSig(all[i + (ev.shiftKey ? -1 : 1)]); PLACE.at = Date.now(); }
}, true);
document.addEventListener('pointerdown', ev => {
  const t = ev.target.closest && (ev.target.closest(FOCUSABLE) || (ev.target.closest('label') || {}).control);
  PLACE.intent = t ? placeSig(t) : null; PLACE.at = Date.now();
}, true);
function keepPlace(draw) {
  const was = placeSig(document.activeElement), tab = UI.tab;
  const open = [...document.querySelectorAll('#view details[open]')].map(placeSig);
  draw();
  if (tab === UI.tab) for (const sig of open) { const d = findSig(sig); if (d && d.tagName === 'DETAILS') d.open = true; }
  const intent = Date.now() - PLACE.at < 1500 ? PLACE.intent : null;
  setTimeout(() => {   // focus moves after the change event that caused this redraw
    const cur = document.activeElement;
    if (cur && cur !== document.body && cur.isConnected) return;
    const el = findSig(intent) || findSig(was);
    if (el && el.isConnected && el.offsetParent !== null) { el.focus({preventScroll: true}); if (el.select && el.tagName === 'INPUT' && /^(text|search|)$/.test(el.type)) try { el.select(); } catch (e) {} }
  }, 0);
}
function renderView() { keepPlace(drawView); }
function drawView() {
  CHARTS = [];
  const y = window.scrollY, el = $('#view');
  const noData = !S.tx.length;
  $('#filters').style.display = noData || ['setup', 'cash'].includes(UI.tab) && false ? 'none' : '';
  let html;
  try { html = noData && UI.tab !== 'setup' ? emptyState() : VIEWS[UI.tab](); }
  catch (e) { html = '<div class="callout neg"><b>This page could not be drawn.</b> ' + esc(e.message) + '</div>'; console.error(e); }
  el.innerHTML = html;
  drawCharts(); initSortables();
  if (y) window.scrollTo(0, y);
}
function refresh() { keepPlace(refreshAll); }
function refreshAll() {
  derive();
  if (R.months.length) {
    const yrs = years();
    if (UI.f.year !== 'All' && !yrs.includes(UI.f.year)) defaultFilters();
  }
  renderNav(); renderFilters(); renderView();
}
function goto(tab, top = true) { UI.tab = tab; renderNav(); renderView(); if (top) window.scrollTo(0, 0); }

/* ============ column sorting ============ */
UI.sorts = {};
function sortVal(td) {
  if (!td) return null;
  if (td.dataset.v != null) { const n = parseFloat(td.dataset.v); return isNaN(n) ? td.dataset.v : n; }
  const t = td.textContent.trim(); if (!t || t === '—') return null;
  let m = t.match(/^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})/); if (m) return Date.UTC(+m[3], MS.indexOf(m[2]), +m[1]);
  m = t.match(/^([A-Z][a-z]+) (\d{4})/); if (m) { const i = MFULL.indexOf(m[1]); if (i >= 0) return Date.UTC(+m[2], i, 1); }
  m = t.replace(/[,\s]/g, '').match(/^([−-]?)₹?([−-]?)(\d+(?:\.\d+)?)/); if (m) return (m[1] || m[2] ? -1 : 1) * parseFloat(m[3]);
  return t.toLowerCase();
}
function initSortables() {
  $$('#view table.t').forEach((tb, ti) => {
    if (tb.dataset.nosort !== undefined || tb.closest('.report')) return;
    const body = tb.tBodies[0]; if (!body || body.rows.length < 2) return;
    tb.dataset.sid = UI.tab + '#' + ti;
    [...body.rows].forEach((r, i) => r.dataset.i = i);
    [...tb.tHead.rows[0].cells].forEach((th, ci) => { if (!th.textContent.trim()) return; th.classList.add('sortable'); th.tabIndex = 0; th.dataset.ci = ci; });
    applySort(tb);
  });
}
function applySort(tb) {
  const st = UI.sorts[tb.dataset.sid], body = tb.tBodies[0], rows = [...body.rows];
  [...tb.tHead.rows[0].cells].forEach(th => th.removeAttribute('aria-sort'));
  if (!st) rows.sort((a, b) => a.dataset.i - b.dataset.i);
  else {
    const dir = st.dir === 'asc' ? 1 : -1, vals = new Map(rows.map(r => [r, sortVal(r.cells[st.ci])]));
    rows.sort((a, b) => {
      const x = vals.get(a), y = vals.get(b);
      if (x == null && y == null) return a.dataset.i - b.dataset.i;
      if (x == null) return 1; if (y == null) return -1;
      let c;
      if (typeof x === 'number' && typeof y === 'number') c = x - y;
      else if (typeof x === 'number') c = -1; else if (typeof y === 'number') c = 1;
      else c = x.localeCompare(y, undefined, {numeric: true});
      return c ? c * dir : a.dataset.i - b.dataset.i;
    });
    const th = tb.tHead.rows[0].cells[st.ci]; if (th) th.setAttribute('aria-sort', st.dir === 'asc' ? 'ascending' : 'descending');
  }
  rows.forEach(r => body.appendChild(r));
}
function toggleSort(th) {
  const tb = th.closest('table'), sid = tb.dataset.sid, ci = +th.dataset.ci, cur = UI.sorts[sid];
  if (cur && cur.ci === ci) { if (cur.dir === cur.first) UI.sorts[sid] = {ci, dir: cur.first === 'asc' ? 'desc' : 'asc', first: cur.first}; else delete UI.sorts[sid]; }
  else { const probe = [...tb.tBodies[0].rows].map(r => sortVal(r.cells[ci])).find(v => v != null); const first = th.dataset.first || (typeof probe === 'number' ? 'desc' : 'asc'); UI.sorts[sid] = {ci, dir: first, first}; }
  applySort(tb);
}

/* ============ modals ============ */
function openModal(html) { closeModal(); $('#modalRoot').innerHTML = html; const f = $('#modalRoot [data-modal] input,#modalRoot [data-modal] select'); if (f) f.focus(); }
function closeModal() { $('#modalRoot').innerHTML = ''; }
function confirmModal(title, body, okLabel, cb, danger) {
  openModal('<div class="modal-bg" data-modal><div class="modal" role="dialog" aria-modal="true"><h2>' + esc(title) + '</h2><div>' + body + '</div><div class="foot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn ' + (danger ? 'danger' : 'primary') + '" id="confirmOk">' + esc(okLabel) + '</button></div></div></div>');
  $('#confirmOk').onclick = () => { closeModal(); cb(); };
}

/* ============ import / backup ============ */
async function handleFile(file) {
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    if (/\.json$/i.test(file.name)) return restoreBackup(new TextDecoder().decode(buf));
    const st = parseBankStatement(buf, file.name);   // the bank's own statement, or else your workbook
    if (st) return statementImportDialog(st);
    const p = parseWorkbook(buf, file.name);
    const prev = new Set(S.tx.map(t => t.id)), now = new Set(p.tx.map(t => t.id));
    const added = p.tx.filter(t => !prev.has(t.id)).length, removed = S.tx.filter(t => !now.has(t.id)).length, kept = p.tx.length - added;
    const total = r2(p.tx.reduce((a, t) => a + t.amt, 0)), dates = p.tx.map(t => t.date);
    const first = !S.tx.length;
    openModal('<div class="modal-bg" data-modal><div class="modal" role="dialog" aria-modal="true"><h2>Review import</h2><div class="kv"><div class="r"><span>File</span><b>' + esc(file.name) + '</b></div><div class="r"><span>Sheet</span><b>' + esc(p.meta.sheet) + '</b></div><div class="r"><span>Transactions read</span><b>' + p.tx.length + '</b></div><div class="r"><span>Date range</span><b>' + (dates.length ? dFull(dates[0]) + ' to ' + dFull(dates[dates.length - 1]) : '—') + '</b></div><div class="r"><span>Sum of all amounts</span><b>' + inr2(total) + '</b></div><div class="r"><span>Statement balance in file</span><b>' + (p.meta.statementBalance != null ? inr2(p.meta.statementBalance) : 'not found') + '</b></div>' + (p.meta.totalsSkipped ? '<div class="r"><span>Totals row skipped</span><b>' + p.meta.totalsSkipped + '</b></div>' : '') + (first ? '' : '<div class="r"><span>New rows</span><b>' + added + '</b></div><div class="r"><span>Rows no longer in the file</span><b class="' + (removed ? 'tone-neg' : '') + '">' + removed + '</b></div><div class="r"><span>Unchanged</span><b>' + kept + '</b></div>') + (p.bad.length ? '<div class="r"><span>Rows with a bad date or amount</span><b class="tone-neg">' + p.bad.length + '</b></div>' : '') + '</div>' +
      (Math.abs(total - (p.meta.statementBalance ?? total)) > S.cfg.tol ? '<div class="callout warn mt">The rows add up to ' + inr2(total) + ' but the statement says ' + inr2(p.meta.statementBalance) + '. The difference will show as an exception.</div>' : '<div class="callout pos mt">' + (p.meta.statementBalance != null ? 'Rows add up to the statement balance.' : 'Rows read cleanly.') + '</div>') +
      (removed > 0 ? '<div class="callout warn">Importing replaces the bank rows. ' + removed + ' rows in the app are not in this file.</div>' : '') +
      '<div class="foot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" id="applyImp">Import</button></div></div></div>');
    $('#applyImp').onclick = () => {
      S.tx = p.tx; S.bad = p.bad;
      const stmt = p.meta.statementBalance != null ? p.meta.statementBalance : (S.meta ? S.meta.statementBalance : null);
      S.meta = Object.assign(p.meta, {statementBalance: stmt});
      closeModal(); derive(); if (first || !R.months.length || !years().includes(UI.f.year)) defaultFilters();
      persist(); refresh(); goto('overview'); toast('Imported ' + p.tx.length + ' transactions');
    };
  } catch (e) { openModal('<div class="modal-bg" data-modal><div class="modal"><h2>Could not import</h2><p>' + esc(e.message) + '</p><div class="foot"><button class="btn primary" data-act="closeModal">Close</button></div></div></div>'); }
}
/* ---- backups with an optional password ----
   A backup holds every transaction, name and amount. With a password it is encrypted (AES-256-GCM,
   key from PBKDF2-SHA-256, 250,000 rounds); without the password nobody can read it, and it cannot
   be recovered. Backups saved without a password, including older ones, still restore. */
const b64 = u => btoa(String.fromCharCode(...u)), unb64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
async function backupKey(pw, salt) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256'}, km, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
async function encryptBackup(text, pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await backupKey(pw, salt), new TextEncoder().encode(text)));
  let bin = ''; for (let i = 0; i < ct.length; i += 0x8000) bin += String.fromCharCode(...ct.subarray(i, i + 0x8000));
  return JSON.stringify({app: 'family-fund', kind: 'backup', v: 2, enc: true, salt: b64(salt), iv: b64(iv), ct: btoa(bin)});
}
async function decryptBackup(o, pw) {
  const key = await backupKey(pw, unb64(o.salt));
  return new TextDecoder().decode(await crypto.subtle.decrypt({name: 'AES-GCM', iv: unb64(o.iv)}, key, unb64(o.ct)));
}
function backupDialog() {
  openModal('<div class="modal-bg" data-modal><div class="modal" role="dialog" aria-modal="true"><h2>Save backup</h2>' +
    '<p class="small">One file with everything in the app. Keep it somewhere safe, for example your cloud drive.</p>' +
    '<div class="f"><label for="bk-pw">Password (recommended)</label><input id="bk-pw" type="password" autocomplete="new-password"></div>' +
    '<div class="f mt"><label for="bk-pw2">Type it again</label><input id="bk-pw2" type="password" autocomplete="new-password"></div>' +
    '<p class="small mt">With a password, the file cannot be read without it, and the password cannot be recovered. Write it down. Without a password, anyone who gets the file can read every transaction.</p>' +
    '<p class="small" id="bk-msg" role="alert" style="color:var(--neg)"></p>' +
    '<div class="foot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" id="bk-ok">Save backup</button></div></div></div>');
  $('#bk-ok').onclick = async () => {
    const pw = $('#bk-pw').value, msg = $('#bk-msg');
    if (pw && pw.length < 8) { msg.textContent = 'Use at least 8 characters, or leave both boxes empty.'; return; }
    if (pw !== $('#bk-pw2').value) { msg.textContent = 'The two passwords are different.'; return; }
    if (pw && !(window.crypto && crypto.subtle)) { msg.textContent = 'This browser cannot encrypt. Open the app from its web address, or save without a password.'; return; }
    const text = JSON.stringify(S), out = pw ? await encryptBackup(text, pw) : text;
    closeModal();
    saveFile('family-fund-backup-' + todayISO() + '.json', out, 'application/json');
  };
}
function restoreBackup(text) {
  let o; try { o = JSON.parse(text); } catch (e) { toast('That is not a backup from this app.'); return; }
  if (o && o.enc && o.kind === 'backup') {
    openModal('<div class="modal-bg" data-modal><div class="modal" role="dialog" aria-modal="true"><h2>This backup has a password</h2>' +
      '<div class="f"><label for="br-pw">Backup password</label><input id="br-pw" type="password" autocomplete="off"></div><p class="small" id="br-msg" role="alert" style="color:var(--neg)"></p>' +
      '<div class="foot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" id="br-ok">Open</button></div></div></div>');
    $('#br-ok').onclick = async () => {
      let plain; try { plain = await decryptBackup(o, $('#br-pw').value); } catch (e) { $('#br-msg').textContent = 'That password did not open the backup.'; return; }
      restoreBackup(plain);
    };
    return;
  }
  try { if (!o.cfg || !Array.isArray(o.tx)) throw new Error('bad'); } catch (e) { toast('That is not a backup from this app.'); return; }
  confirmModal('Restore backup', '<p>This replaces everything in the app with the backup: ' + o.tx.length + ' bank rows, ' + (o.cash || []).length + ' cash entries and your plan.</p>', 'Restore', () => {
    const d = defaults(); upgradeCfg(o.cfg); S = Object.assign(d, o, {cfg: Object.assign(d.cfg, o.cfg)}); S.cfg.goal = Object.assign(d.cfg.goal, o.cfg.goal || {});
    derive(); defaultFilters(); persist(); refresh(); toast('Backup restored');
  });
}

/* ============ actions ============ */
const ACT = {
  moreFilters: () => { UI.filtersOpen = !UI.filtersOpen; renderFilters(); },
  moreNav: () => {
    const rest = TABS.filter(([k]) => !BOTTOM_PRIMARY.includes(k));
    openModal('<div class="modal-bg" data-modal><div class="modal" role="dialog" aria-modal="true"><h2>More</h2><div class="navsheet">' + rest.map(([k, l]) => '<button class="btn" data-act="gotoClose" data-arg="' + k + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[k] + '</svg>' + esc(l) + '</button>').join('') + '</div><div class="foot"><button class="btn" data-act="closeModal">Close</button></div></div></div>');
  },
  gotoClose: el => { closeModal(); goto(el.dataset.arg); },
  txSort: el => {
    const k = el.dataset.arg, cur = UI.txsort, first = (k === 'amt' || k === 'date') ? 'desc' : 'asc';
    if (cur && cur.k === k) { if (cur.dir === first) UI.txsort = {k, dir: first === 'asc' ? 'desc' : 'asc'}; else UI.txsort = null; } else UI.txsort = {k, dir: first};
    UI.txpage = 0; $('#txBody').innerHTML = txTableHTML();
  },
  goto: el => goto(el.dataset.arg),
  pickFile: () => $('#file').click(),
  resetFilters: () => { defaultFilters(); renderFilters(); renderView(); },
  ctTab: el => { UI.ctTab = el.dataset.arg; renderView(); },
  exf: el => { UI.exf = el.dataset.arg; renderView(); },
  closeModal,
  txPage: el => { UI.txpage += +el.dataset.arg; $('#txBody').innerHTML = txTableHTML(); },
  clearIds: () => { UI.txIds = null; renderView(); },
  showIds: el => { const e = R.exceptions.find(x => x.key === el.dataset.arg); if (!e) return; UI.txIds = e.ids; UI.txpage = 0; UI.txq = ''; UI.txsrc = 'All'; UI.txcls = 'All'; goto(e.tab === 'cash' ? 'transactions' : 'transactions'); },
  ack: el => {
    const k = el.dataset.arg;
    if (S.ack[k]) { delete S.ack[k]; persist(); refresh(); return; }
    openModal('<div class="modal-bg" data-modal><div class="modal"><h2>Mark as reviewed</h2><div class="field"><label for="ack-n">Note (optional)</label><input id="ack-n" placeholder="e.g. Confirmed with the family, genuine double payment"></div><div class="foot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" id="ackOk">Mark reviewed</button></div></div></div>');
    $('#ackOk').onclick = () => { S.ack[k] = {note: $('#ack-n').value.trim(), at: new Date().toISOString()}; closeModal(); persist(); refresh(); };
  },
  spAdd: () => {
    const box = $('#sp-rows'), have = $$('.sp-row').length;
    if (!have) { const e = R.byId[$('#sp-box').dataset.id] ; const cur = $('#tx-cat') && $('#tx-cat').value; box.insertAdjacentHTML('beforeend', spRow(cur || '', +$('#sp-box').dataset.total) + spRow('', null)); $('#sp-add').textContent = 'Add part'; $('#sp-clear').style.display = ''; }
    else box.insertAdjacentHTML('beforeend', spRow('', null));
    splitRem();
  },
  spDel: el => { el.closest('.sp-row').remove(); if (!$$('.sp-row').length) { $('#sp-add').textContent = 'Split this payment'; $('#sp-clear').style.display = 'none'; } splitRem(); },
  spClear: () => { $('#sp-rows').innerHTML = ''; $('#sp-add').textContent = 'Split this payment'; $('#sp-clear').style.display = 'none'; splitRem(); },
  saveTx: el => {
    const id = el.dataset.arg, o = {}, g = s => { const n = $(s); return n ? n.value : ''; };
    const rows = $$('.sp-row');
    if (rows.length) {
      const total = +$('#sp-box').dataset.total, parts = rows.map(r => ({cat: $('.sp-cat', r).value, amt: r2(parseAmount($('.sp-amt', r).value) || 0)}));
      const tot = r2(parts.reduce((a, x) => a + x.amt, 0)), err = [];
      if (parts.length < 2) err.push('Add at least two parts, or remove the split.');
      if (parts.some(x => !x.cat)) err.push('Choose a category for every part.');
      if (parts.some(x => !(x.amt > 0))) err.push('Every part needs an amount above zero.');
      if (Math.abs(tot - total) > 0.005) err.push('The parts add up to ' + inr2(tot) + ' but the payment is ' + inr2(total) + '.');
      if (err.length) { const m = $('#tx-msg'); m.style.display = ''; m.innerHTML = err.map(esc).join('<br>'); return; }
      o.split = parts;
    }
    if (g('#tx-cat')) o.cat = g('#tx-cat'); if (g('#tx-mode')) o.mode = g('#tx-mode'); if (g('#tx-med')) o.med = g('#tx-med');
    if ($('#tx-inv') && g('#tx-inv') !== 'Deployed') o.inv = g('#tx-inv'); if (g('#tx-note').trim()) o.note = g('#tx-note').trim();
    if (Object.keys(o).length) S.overlay[id] = o; else delete S.overlay[id];
    closeModal(); persist(); refresh(); toast('Saved');
  },
  clearOv: el => { delete S.overlay[el.dataset.arg]; closeModal(); persist(); refresh(); },
  exportTx: () => { const rows = txRows(); saveFile('transactions.csv', toCSV([['Date', 'Source', 'Person', 'Original purpose', 'Treated as', 'Category', 'Mode', 'Amount', 'Description']].concat(rows.map(e => [e.date, e.src, e.person, e.purpose, KIND_LABEL[e.kind], e.cat, e.mode, e.amt, e.desc]))), 'text/csv'); },
  addCash: () => { openModal(cashModal()); cashModalSync(); },
  editCash: el => { openModal(cashModal(el.dataset.arg)); const c = S.cash.find(x => x.id === el.dataset.arg); if (c) $('#cf-sub').dataset.cur = c.sub || ''; cashModalSync(); },
  delCash: el => confirmModal('Delete cash entry', '<p>Remove this cash entry? Bank rows are not affected.</p>', 'Delete', () => { S.cash = S.cash.filter(c => c.id !== el.dataset.arg); persist(); refresh(); }, true),
  saveCash: el => {
    const id = el.dataset.arg, g = s => $(s).value, dir = g('#cf-dir'), cls = g('#cf-cls'), amt = parseAmount(g('#cf-amt')) ?? NaN, msg = $('#cf-msg');
    const errs = [], warns = [];
    if (!validISO(g('#cf-date'))) errs.push('Enter a valid date.');
    if (!(amt > 0)) errs.push('Enter an amount greater than zero.');
    if (dir === 'Receipt' && !isBro(g('#cf-person'))) errs.push('Choose which brother the cash came from.');
    if (dir === 'Direct' && !isBro(g('#cf-person'))) errs.push('Choose which brother paid.');
    if ((dir === 'Payment' || dir === 'Direct') && cls !== 'Investment' && !g('#cf-cat')) errs.push('Choose a category.');
    if (!g('#cf-desc').trim()) errs.push('Add a short description so the entry can be explained later.');
    const acct = dir === 'Direct' ? 'Direct' : g('#cf-acct') === 'Cash' ? 'Cash' : ACCOUNTS[1];
    if (errs.length) { msg.style.display = ''; msg.className = 'callout neg'; msg.innerHTML = errs.map(esc).join('<br>'); return; }
    if (acct === 'Cash' && dir !== 'Direct' && g('#cf-mode') !== 'Cash') warns.push('The payment mode is ' + g('#cf-mode') + ', which normally shows in the bank statement. Change the mode to Cash if this was real cash.');
    const entry = {id: id || uid(), date: g('#cf-date'), dir, by: dir === 'Direct' ? g('#cf-person') : g('#cf-by'), person: g('#cf-person'), mode: g('#cf-mode'), acct, cls, cat: dir !== 'Receipt' && cls !== 'Investment' ? g('#cf-cat') : '', sub: g('#cf-sub'), med: cls === 'Medical' ? g('#cf-med') : '', src: dir === 'Payment' ? g('#cf-src') : 'Cash in hand', desc: g('#cf-desc').trim(), amt: r2(amt), ref: g('#cf-ref').trim(), note: g('#cf-note').trim()};
    if (!/^ATM/i.test(entry.src)) { const dup = possibleBankDup(entry); if (dup.length) warns.push('A bank row of the same amount exists on ' + dFull(dup[0].date) + ' (' + dup[0].person + '). If this is the same money, do not add it here.'); }
    if (warns.length && !el.dataset.ok) { msg.style.display = ''; msg.className = 'callout warn'; msg.innerHTML = warns.map(esc).join('<br>') + '<br><b>Click Save again to keep it anyway.</b>'; el.dataset.ok = '1'; return; }
    const i = S.cash.findIndex(c => c.id === entry.id); if (i >= 0) S.cash[i] = entry; else S.cash.push(entry);
    closeModal(); persist(); refresh(); toast('Cash entry saved');
  },
  exportCash: () => saveFile('cash-ledger.csv', toCSV([['Date', 'Direction', 'By', 'Person', 'Mode', 'Account', 'Class', 'Category', 'Subcategory', 'Source of cash', 'Amount', 'Description', 'Reference', 'Notes']].concat(S.cash.map(c => [c.date, c.dir, c.by, c.person, c.mode, c.acct, c.cls, c.cat, c.sub, c.src, c.amt, c.desc, c.ref, c.note]))), 'text/csv'),
  pdfReport: async () => { const P = periodInfo(), d = reportData(P.sel); try { const buf = makeReportPDF(d); await saveFile('family-fund-report-' + d.m + '.pdf', buf, 'application/pdf'); } catch (e) { toast('Could not build the PDF: ' + e.message); } },
  copyReport: async () => { const t = whatsappText(reportData(periodInfo().sel)); try { await navigator.clipboard.writeText(t); toast('Copied. Paste it into WhatsApp.'); } catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copied. Paste it into WhatsApp.'); } catch (e2) { openModal('<div class="modal-bg" data-modal><div class="modal"><h2>Copy this text</h2><div class="field"><textarea rows="14" readonly>' + esc(t) + '</textarea></div><div class="foot"><button class="btn primary" data-act="closeModal">Close</button></div></div></div>'); } ta.remove(); } },
  addMember: () => { let k = S.cfg.brothers.length + 1, name; do { name = 'Brother ' + k++; } while (S.cfg.brothers.includes(name)); S.cfg.brothers.push(name); S.cfg.people.push(name); persist(); refresh(); const el = $('#mb-' + (S.cfg.brothers.length - 1)); if (el) { el.focus(); el.select(); } },
  addPlan: () => { const last = R.months.length ? R.months[R.months.length - 1] : todayISO().slice(0, 7); S.cfg.plan.push({id: uid(), from: addMonths(last, 1), brother: 'All', type: 'Household', amount: 10000, status: 'Active'}); persist(); refresh(); },
  delPlan: el => { S.cfg.plan = S.cfg.plan.filter(p => p.id !== el.dataset.arg); persist(); refresh(); },
  saveCats: () => {
    const cats = {}; $('#cat-t').value.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => { const [k, ...r] = l.split(':'); cats[k.trim()] = r.join(':').split(',').map(s => s.trim()).filter(Boolean); });
    if (!Object.keys(cats).length) { toast('Add at least one category.'); return; }
    S.cfg.categories = cats; persist(); refresh(); toast('Categories saved');
  },
  addRule: () => { const k = $('#rl-k').value.trim(); if (!k) { toast('Enter the text to match.'); return; } S.cfg.rules.push({kw: k, cat: $('#rl-c').value}); persist(); refresh(); },
  delRule: el => { S.cfg.rules.splice(+el.dataset.arg, 1); persist(); refresh(); },
  backup: () => backupDialog(),
  pickBackup: () => $('#file').click(),
  resetAll: () => confirmModal('Erase everything',
    '<p>This removes everything this app has saved in this browser: imported bank rows, cash entries, your contribution plan, goal, categories, rules, splits, notes and reviewed items. It cannot be undone. Save a backup first if you might need any of it.</p>' +
    '<p class="small">The app then restarts as if opened for the first time, so Setup shows its starting values again (the brothers\' names, ₹10,000 plan lines and the default categories) until you change them.</p>',
    'Erase everything', eraseAll, true)
};
Object.assign(ACT, STMT_ACTIONS);
ACT.editTx = el => {
  const e = R.byId[el.dataset.arg]; if (!e) return;
  if (e.src === 'Cash') { ACT.editCash({dataset: {arg: e.cashEntry ? e.cashEntry.id : e.id}}); return; }
  if (e.stmt) { reviewDialog(e.parentId || e.id); return; }
  openModal(txModal(e.parentId || e.id)); splitRem();
};
function splitRem() {
  const box = $('#sp-box'), r = $('#sp-rem'); if (!box || !r) return;
  if (!$$('.sp-row').length) { r.textContent = ''; return; }
  const rem = r2(+box.dataset.total - $$('.sp-amt').reduce((a, i) => a + (parseAmount(i.value) || 0), 0));
  r.innerHTML = Math.abs(rem) < 0.005 ? '<b class="tone-pos">Adds up to ' + inr2(+box.dataset.total) + '</b>' : '<b class="' + (rem < 0 ? 'tone-neg' : '') + '">' + (rem > 0 ? 'Still to allocate ' : 'Over by ') + inr2(Math.abs(rem)) + '</b>';
}

/* ============ delegated events ============ */
document.addEventListener('click', ev => {
  const sth = ev.target.closest('th.sortable'); if (sth && !sth.dataset.act && sth.closest('table').dataset.sid) { toggleSort(sth); return; }
  const bg = ev.target.closest('[data-modal]'); if (bg && ev.target === bg) { closeModal(); return; }
  const insideMore = ev.target.closest('.more-wrap');
  const el = ev.target.closest('select.qedit') ? null : ev.target.closest('[data-act]');
  if (UI.filtersOpen && !insideMore) { UI.filtersOpen = false; renderFilters(); }
  if (!el) return;
  const fn = ACT[el.dataset.act]; if (fn) fn(el, ev);
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { if ($('#modalRoot').firstChild) closeModal(); else if (UI.filtersOpen) { UI.filtersOpen = false; renderFilters(); } }
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches) {
    if (ev.target.matches('tr[data-act],th[data-act]')) { ev.preventDefault(); ACT[ev.target.dataset.act](ev.target); }
    else if (ev.target.matches('th.sortable') && ev.target.closest('table').dataset.sid) { ev.preventDefault(); toggleSort(ev.target); }
  }
});
// Money boxes are text boxes with a decimal keypad, so "10,000", "1,00,000" and "₹1,250" can be typed.
// Before the handlers below read one, turn what was typed into a plain number; leave anything unreadable
// as typed so the handler's own check rejects it.
function normaliseNum(ev) { const el = ev.target; if (!el || !el.matches || !el.matches('input[data-num]')) return; const n = parseAmount(el.value); if (n !== null && String(n) !== el.value) el.value = String(n); }
['change', 'focusout'].forEach(n => document.addEventListener(n, normaliseNum, true));
document.addEventListener('keydown', ev => { if (ev.key === 'Enter') normaliseNum(ev); }, true);
document.addEventListener('change', ev => {
  const t = ev.target;
  if (stmtChange(t)) return;
  if (t.id === 'file') { const f = t.files[0]; t.value = ''; handleFile(f); return; }
  if (t.dataset.qcat !== undefined || t.dataset.qmode !== undefined) {
    const id = t.dataset.qcat !== undefined ? t.dataset.qcat : t.dataset.qmode, key = t.dataset.qcat !== undefined ? 'cat' : 'mode';
    const ov = Object.assign({}, S.overlay[id]);
    if (t.value) ov[key] = t.value; else delete ov[key];
    if (Object.keys(ov).length) S.overlay[id] = ov; else delete S.overlay[id];
    persist(); refresh(); return;
  }
  if (t.dataset.f) {
    const k = t.dataset.f; UI.f[k] = t.value; if (k !== 'year' && k !== 'month') t.classList.toggle('on', t.value !== 'All');
    if (k === 'year') { if (t.value === 'All') UI.f.month = 'All'; else if (UI.f.month === 'All') UI.f.month = String(+R.months[R.months.length - 1].slice(5, 7)); renderFilters(); }
    if (EXTRA_KEYS.includes(k)) { const btn = $('.more-wrap [data-act="moreFilters"]'); if (btn) { const n = activeExtraCount(); btn.innerHTML = 'Filters' + (n ? ' <span class="chipcount">' + n + '</span>' : ''); btn.classList.toggle('on', n > 0); } }
    UI.txpage = 0; renderView(); return;
  }
  if (t.dataset.ruleP !== undefined || t.dataset.rulePayee !== undefined) { if (!t.value) return; S.cfg.rules.unshift({kw: t.dataset.rulePayee.toLowerCase(), cat: t.value}); persist(); refresh(); toast('Rule added for ' + t.dataset.rulePayee); return; }
  if (t.dataset.member !== undefined) {
    const i = +t.dataset.member, old = S.cfg.brothers[i], v = t.value.trim();
    if (v && v !== old && S.cfg.brothers.includes(v)) { toast(v + ' is already in the list.'); renderView(); return; }
    if (!v) { S.cfg.brothers.splice(i, 1); S.cfg.people = S.cfg.people.filter(p => p !== old); }
    else { renameMember(old, v); S.cfg.brothers[i] = v; }
    persist(); refresh(); return;
  }
  if (t.dataset.plan) { const p = S.cfg.plan.find(x => x.id === t.dataset.plan); if (!p) return; let v = t.value; if (t.dataset.k === 'amount') v = Math.max(0, +v || 0); if (t.dataset.k === 'from' && !/^\d{4}-\d{2}$/.test(v)) return; p[t.dataset.k] = v; persist(); refresh(); return; }
  if (t.dataset.goal) { if (t.dataset.goal === 'ret') S.cfg.goal.ret = Math.max(0, +t.value || 0); else S.cfg.goal.basis = t.value; persist(); renderView(); return; }
  if (t.dataset.txf) { UI[t.dataset.txf] = t.value; UI.txpage = 0; $('#txBody').innerHTML = txTableHTML(); return; }
  if (t.dataset.cfg) {
    const k = t.dataset.cfg; if (k === 'cats') return;
    if (k === 'stmt') { if (!S.meta) S.meta = {file: '', sheet: '', importedAt: new Date().toISOString(), statementBalance: null}; S.meta.statementBalance = t.value === '' ? null : +t.value; }
    else if (k === 'tol') S.cfg.tol = Math.max(0, +t.value || 0);
    else if (k === 'gtarget') S.cfg.goal.target = Math.max(1, +t.value || 1);
    else if (k === 'gstart' && /^\d{4}-\d{2}$/.test(t.value)) S.cfg.goal.start = t.value;
    else if (k === 'gyears') S.cfg.goal.years = Math.min(40, Math.max(1, +t.value || 10));
    else if (k === 'meddef') S.cfg.medicalDefault = t.value;
    else if (k === 'spender') { const v = t.value.trim(); if (!v) { renderView(); return; } renameMember(S.cfg.spender, v); S.cfg.spender = v; }
    else if (k === 'banks') S.cfg.banks = t.value.split(',').map(x => x.trim()).filter(Boolean);
    persist(); refresh(); return;
  }
  if (t.id === 'cf-dir' || t.id === 'cf-cls' || t.id === 'cf-cat') { if (t.id === 'cf-cat') $('#cf-sub').dataset.cur = ''; cashModalSync(); }
});
let sT;
document.addEventListener('input', ev => {
  if (ev.target.classList && ev.target.classList.contains('rp-amt')) rpRemaining();
  if (ev.target.classList && ev.target.classList.contains('sp-amt')) { splitRem(); const m = $('#tx-msg'); if (m) m.style.display = 'none'; }
  if (ev.target.id === 'txq') { UI.txq = ev.target.value; UI.txpage = 0; clearTimeout(sT); sT = setTimeout(() => { $('#txBody').innerHTML = txTableHTML(); }, 180); }
});
let rT; window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(drawCharts, 150); });
['dragover', 'dragenter'].forEach(n => document.addEventListener(n, ev => { const d = $('#drop'); if (d) { ev.preventDefault(); d.classList.add('drag'); } }));
document.addEventListener('dragleave', () => { const d = $('#drop'); if (d) d.classList.remove('drag'); });
document.addEventListener('drop', ev => { const d = $('#drop'); if (!d) return; ev.preventDefault(); d.classList.remove('drag'); handleFile(ev.dataTransfer.files[0]); });

/* ============ chart tooltips ============ */
const tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.style.display = 'none'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl);
function placeTip(t, ev) {
  tipEl.textContent = t.dataset.tip; tipEl.style.display = 'block';
  const r = tipEl.getBoundingClientRect(); let x = ev.clientX + 14, y = ev.clientY - r.height - 12;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14; if (y < 8) y = ev.clientY + 18;
  tipEl.style.left = Math.max(8, x) + 'px'; tipEl.style.top = y + 'px';
}
document.addEventListener('mouseover', ev => { const t = ev.target.closest && ev.target.closest('[data-tip]'); if (t) placeTip(t, ev); });
document.addEventListener('mousemove', ev => { if (tipEl.style.display === 'none') return; const t = ev.target.closest && ev.target.closest('[data-tip]'); if (t) placeTip(t, ev); });
document.addEventListener('mouseout', ev => { if (ev.target.closest && ev.target.closest('[data-tip]')) tipEl.style.display = 'none'; });
document.addEventListener('click', ev => { const t = ev.target.closest && ev.target.closest('[data-tip]'); if (t && !ev.target.closest('[data-act]')) { placeTip(t, ev); clearTimeout(placeTip.h); placeTip.h = setTimeout(() => { tipEl.style.display = 'none'; }, 2200); } });

/* ============ family members ============ */
// A new name replaces the old one everywhere this app stored it (bank rows stay as imported).
function renameMember(old, v) {
  if (!old || old === v) return;
  for (const p of S.cfg.plan) if (p.brother === old) p.brother = v;
  for (const c of S.cash) { if (c.by === old) c.by = v; if (c.person === old) c.person = v; }
  S.cfg.people = S.cfg.people.map(p => p === old ? v : p);
  if (!S.cfg.people.includes(v)) S.cfg.people.push(v);
}

/* ============ erase ============ */
function eraseAll() {
  clearTimeout(saveT); saveT = null;              // a pending save must not write the old data back
  try { Object.keys(localStorage).filter(k => k.startsWith('fbfund.')).forEach(k => localStorage.removeItem(k)); } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
  S = defaults();
  location.reload();                              // clears every search, filter, sort and open dialog too
}

/* ============ version and what's new ============ */
const cmpVer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
function whatsNew() {
  let seen = null; try { seen = localStorage.getItem(SEEN_KEY); } catch (e) {}
  try { localStorage.setItem(SEEN_KEY, APP_VERSION); } catch (e) {}
  if (seen === APP_VERSION) return;
  if (seen === null && !S.tx.length && !S.cash.length) return;   // a brand-new user: nothing to compare with
  const vs = Object.keys(WHATS_NEW).filter(v => cmpVer(v, APP_VERSION) <= 0 && (!seen || cmpVer(v, seen) > 0));
  if (!vs.length) return;
  openModal('<div class="modal-bg" data-modal><div class="modal" role="dialog" aria-modal="true" aria-labelledby="wn-h"><h2 id="wn-h">Updated to version ' + esc(APP_VERSION) + '</h2>' +
    vs.map(v => '<h3 style="margin:14px 0 6px;font-size:14px">What\'s new in ' + esc(v) + '</h3><ul style="margin:0;padding-left:18px;line-height:1.55">' + WHATS_NEW[v].map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>').join('') +
    '<div class="foot"><button class="btn primary" data-act="closeModal">OK</button></div></div></div>');
}

/* ============ start ============ */
derive();
if (R.months.length) defaultFilters();
persist();
renderNav(); renderFilters(); renderView();
{ const f = document.querySelector('.side .foot'); if (f) f.insertAdjacentHTML('beforeend', '<div class="small" style="margin-top:8px;opacity:.75">Version ' + esc(APP_VERSION) + '</div>'); }
whatsNew();

