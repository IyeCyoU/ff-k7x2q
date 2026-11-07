'use strict';
/* ============ CASH LEDGER ============ */
function atmStats() {
  const tot = -sum(R.led.filter(e => e.src === 'Bank' && e.atm && e.kind === 'hhx'), e => e.amt);
  const memo = -sum(R.led.filter(e => e.memo && e.kind === 'hhx'), e => e.amt);
  return {tot, memo, left: Math.max(0, tot - memo)};
}
function vCash() {
  const last = R.N - 1, tol = S.cfg.tol;
  const real = R.led.filter(e => e.src === 'Cash' && !e.memo && e.acct === 'Cash');
  const rec = sum(real.filter(e => e.amt > 0), e => e.amt), paid = -sum(real.filter(e => e.amt < 0), e => e.amt);
  const at = atmStats(), pend = S.cash.filter(c => c.acct !== 'Cash');
  const kp = '<div class="kgrid mb">' +
    kpi('Cash in hand', inr2(last >= 0 ? R.cashCum[last] : 0), 'Received − paid, brother cash only', (last >= 0 && R.cashCum[last] < -tol) ? 'neg' : '') +
    kpi('Cash received from brothers', inr(rec), real.filter(e => e.amt > 0).length + ' entries') + kpi('Cash paid out', inr(paid), real.filter(e => e.amt < 0).length + ' entries') +
    kpi('ATM cash itemised', inr(at.memo) + ' <span class="small">of ' + inr(at.tot) + '</span>', at.left > tol ? inr(at.left) + ' still to explain' : 'Fully explained', at.left > tol ? 'warn' : 'pos') + '</div>';
  const sorted = S.cash.slice().sort((a, b) => a.date < b.date ? 1 : -1);
  const list = tbl([
    {h: 'Date', f: c => validISO(c.date) ? dFull(c.date) : '<span class="tone-neg">Invalid</span>'}, {h: 'Direction', f: c => pill(c.dir === 'Receipt' ? 'Cash in' : /^ATM/i.test(c.src || '') ? 'ATM cash spent' : 'Cash out', c.dir === 'Receipt' ? 'pos' : /^ATM/i.test(c.src || '') ? 'info' : 'warn')},
    {h: 'By / person', f: c => esc(c.by) + (c.person ? '<br><span class="small">' + esc(c.person) + '</span>' : '')}, {h: 'Class', f: c => esc(c.cls) + (c.cat ? '<br><span class="small">' + esc(c.cat + (c.sub ? ' / ' + c.sub : '')) + '</span>' : '')},
    {h: 'Mode / account', f: c => esc(c.mode) + '<br><span class="small">' + esc(c.acct) + '</span>'}, {h: 'Amount', cls: 'num', f: c => '<td class="num ' + (c.dir === 'Receipt' ? 'pos' : 'neg') + '">' + inr2(c.dir === 'Receipt' ? c.amt : -c.amt) + '</td>'},
    {h: 'Description', cls: 'desc', f: c => esc(c.desc) + (c.ref ? '<br>Ref: ' + esc(c.ref) : '') + (c.note ? '<br><i>' + esc(c.note) + '</i>' : '')},
    {h: '', f: c => '<button class="btn sm" data-act="editCash" data-arg="' + c.id + '">Edit</button> <button class="btn sm danger" data-act="delCash" data-arg="' + c.id + '">Delete</button>'}
  ], sorted, {maxH: 520});
  const help = '<div class="kv help"><div class="r"><span><b>Cash from a brother</b> (the spender or a brother received it)</span><span>Add as Cash in. Counts toward that brother\'s contribution and raises cash in hand.</span></div><div class="r"><span><b>Cash spent from that money</b></span><span>Add as Cash out. Counts as spending and lowers cash in hand.</span></div><div class="r"><span><b>Cash from an ATM withdrawal</b></span><span>The withdrawal is already in the bank statement as an expense. Add what it was spent on as "ATM cash (already booked)" so it is itemised, not counted twice.</span></div><div class="r"><span><b>Paid by UPI, card or transfer</b></span><span>Do not add it here. It is in the bank statement already.</span></div></div>';
  return '<div class="vh"><h1>Cash ledger</h1><span class="sub">Only money that never touched the bank statement</span><div class="actions"><button class="btn primary" data-act="addCash">Add cash entry</button><button class="btn" data-act="exportCash">Export CSV</button></div></div>' + kp + '<div class="grid">' + panel('Cash entries', list, {note: S.cash.length + ' entries'}) + '</div><div class="grid">' + panel('Avoiding double counting', help) + '</div>';
}
function cashModal(id) {
  const c = id ? S.cash.find(x => x.id === id) : null;
  const d = c || {id: '', date: todayISO(), dir: 'Payment', by: S.cfg.spender, person: '', mode: 'Cash', acct: 'Cash', cls: 'Household', cat: '', sub: '', med: S.cfg.medicalDefault, src: 'Cash in hand', desc: '', amt: '', ref: '', note: ''};
  const O = (arr, cur) => arr.map(v => '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
  const people = S.cfg.people;
  return '<div class="modal-bg" data-modal><div class="modal" role="dialog" aria-modal="true" aria-labelledby="cm-t"><h2 id="cm-t">' + (c ? 'Edit' : 'Add') + ' cash entry</h2><div class="formgrid">' +
    '<div class="field"><label for="cf-date">Transaction date</label><input id="cf-date" type="date" value="' + esc(d.date) + '"></div>' +
    '<div class="field"><label for="cf-dir">What happened</label><select id="cf-dir"><option value="Receipt"' + (d.dir === 'Receipt' ? ' selected' : '') + '>Cash received from a brother</option><option value="Payment"' + (d.dir === 'Payment' ? ' selected' : '') + '>Cash paid out</option></select></div>' +
    '<div class="field"><label for="cf-amt">Amount (₹)</label><input id="cf-amt" type="text" inputmode="decimal" autocomplete="off" data-num step="0.01" min="0" value="' + esc(d.amt) + '"></div>' +
    '<div class="field"><label for="cf-by" id="cf-by-l">Paid / received by</label><select id="cf-by">' + O(people, d.by) + '</select></div>' +
    '<div class="field"><label for="cf-person" id="cf-person-l">Brother / person</label><select id="cf-person"><option value="">—</option>' + O([...S.cfg.brothers, S.cfg.spender, 'Other'], d.person) + '</select></div>' +
    '<div class="field"><label for="cf-cls">Household / Investment / Medical / Other</label><select id="cf-cls">' + O(CLASSES, d.cls) + '</select></div>' +
    '<div class="field"><label for="cf-mode">Payment mode</label><select id="cf-mode">' + O(MODES, d.mode) + '</select></div>' +
    '<div class="field"><label for="cf-acct">Bank / Cash</label><select id="cf-acct">' + O(ACCOUNTS, d.acct === 'Cash' ? 'Cash' : ACCOUNTS[1]) + '</select></div>' +
    '<div class="field" id="cf-src-w"><label for="cf-src">Where the cash came from</label><select id="cf-src">' + O(['Cash in hand', 'ATM cash (already booked)'], d.src) + '</select></div>' +
    '<div class="field" id="cf-cat-w"><label for="cf-cat">Category</label><select id="cf-cat"><option value="">Choose…</option>' + O(Object.keys(S.cfg.categories), d.cat) + '</select></div>' +
    '<div class="field" id="cf-sub-w"><label for="cf-sub">Subcategory</label><select id="cf-sub"><option value="">—</option></select></div>' +
    '<div class="field" id="cf-med-w"><label for="cf-med">Medical treatment</label><select id="cf-med">' + O(MEDTREAT, d.med || S.cfg.medicalDefault) + '</select></div>' +
    '<div class="field span3"><label for="cf-desc">Description</label><input id="cf-desc" value="' + esc(d.desc) + '" placeholder="What was this for?"></div>' +
    '<div class="field span2"><label for="cf-ref">Supporting reference (bill no., photo name…)</label><input id="cf-ref" value="' + esc(d.ref) + '"></div>' +
    '<div class="field span3"><label for="cf-note">Notes</label><input id="cf-note" value="' + esc(d.note) + '"></div></div>' +
    '<div id="cf-msg" class="callout warn" style="display:none;margin-top:12px"></div><div class="foot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="saveCash" data-arg="' + esc(id || '') + '">Save entry</button></div></div></div>';
}
function cashModalSync() {
  const dir = $('#cf-dir').value, cls = $('#cf-cls').value;
  $('#cf-by-l').textContent = dir === 'Receipt' ? 'Received by' : 'Paid by';
  $('#cf-person-l').textContent = dir === 'Receipt' ? 'Received from (brother)' : 'Brother / person concerned';
  $('#cf-src-w').style.display = dir === 'Payment' ? '' : 'none';
  const showCat = dir === 'Payment' && cls !== 'Investment';
  $('#cf-cat-w').style.display = showCat ? '' : 'none'; $('#cf-sub-w').style.display = showCat ? '' : 'none';
  $('#cf-med-w').style.display = dir === 'Payment' && cls === 'Medical' ? '' : 'none';
  if (dir === 'Payment' && cls === 'Medical' && !$('#cf-cat').value) $('#cf-cat').value = 'Medical';
  const cat = $('#cf-cat').value, subs = (S.cfg.categories[cat] || []), cur = $('#cf-sub').dataset.cur || $('#cf-sub').value;
  $('#cf-sub').innerHTML = '<option value="">—</option>' + subs.map(s => '<option' + (s === cur ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
}

/* ============ CONTROLS ============ */
function vControls() {
  const tol = S.cfg.tol, last = R.N - 1, st = S.meta && S.meta.statementBalance;
  const ck = R.checks;
  const ct = tbl([{h: 'Control', f: c => esc(c.name)}, {h: 'Expected', cls: 'num', f: c => c.exp == null ? '—' : (Math.abs(c.exp) <= 1 && c.name.includes('%') ? pct(c.exp) : inr2(c.exp))}, {h: 'Found', cls: 'num', f: c => c.act == null ? '—' : (c.name.includes('100%') ? pct(c.act) : inr2(c.act))}, {h: 'Difference', cls: 'num', f: c => c.diff == null ? '—' : mcell(c.diff, 2)}, {h: 'Status', f: c => pill(c.status, checkTone(c.status))}, {h: 'Note', cls: 'desc', f: c => esc(c.note)}], ck);
  const ok = ck.filter(c => c.status === 'Reconciled').length;
  const rows = R.months.map((m, i) => {
    const b = R.bankBy[i], open = i ? R.bankCum[i - 1] : 0, comp = r2(open + b.add + b.exp + b.xfer + b.inv + b.oth), act = r2(R.bankCum[i]);
    const funds = ['H', 'I', 'S', 'M', 'X'].reduce((a, f) => a + R.F[f][i].close, 0), diff = r2(funds - R.famCum[i]);
    let status = Math.abs(diff) > tol || Math.abs(comp - act) > tol ? 'Difference' : b.unclassified ? 'Missing Classification' : 'Reconciled';
    if (i === last && st != null && Math.abs(R.bankCum[i] - st) > tol) status = 'Difference';
    return {m, open, b, close: act, diff, status, stdiff: i === last && st != null ? r2(R.bankCum[i] - st) : null};
  });
  const mt = tbl([{h: 'Month', f: r => '<b>' + mLong(r.m) + '</b>'}, {h: 'Opening', cls: 'num', f: r => inr2(r.open)}, {h: 'Additions', cls: 'num', f: r => inr2(r.b.add)}, {h: 'Expenses', cls: 'num', f: r => inr2(r.b.exp)}, {h: 'Transfers', cls: 'num', f: r => inr2(r.b.xfer)}, {h: 'Investments', cls: 'num', f: r => inr2(r.b.inv)}, {h: 'Closing', cls: 'num', f: r => '<b>' + inr2(r.close) + '</b>'}, {h: 'Difference', cls: 'num', f: r => (r.stdiff != null ? 'vs statement ' + inr2(r.stdiff) : inr2(r.diff))}, {h: 'Status', f: r => pill(r.status, checkTone(r.status))}], rows.slice().reverse(), {maxH: 420});
  const ex = R.exceptions.filter(e => UI.exf === 'All' ? true : UI.exf === 'Reviewed' ? e.ack : !e.ack);
  const seg = '<div class="seg">' + ['Open', 'Reviewed', 'All'].map(v => '<button data-act="exf" data-arg="' + v + '" aria-pressed="' + (UI.exf === v) + '">' + v + '</button>').join('') + '</div>';
  const exl = ex.length ? '<div class="tw"><table class="t"><thead><tr><th data-first="asc">Severity</th><th>Type</th><th>What we found</th><th class="num">Amount</th><th></th></tr></thead><tbody>' + ex.map(e => '<tr><td data-v="' + ({High: 0, Medium: 1, Low: 2}[e.sev]) + '">' + pill(e.sev, sevTone(e.sev)) + '</td><td>' + esc(e.code) + '</td><td><b>' + esc(e.title) + '</b><div class="small">' + esc(e.detail) + '</div>' + (e.ack ? '<div class="small">Reviewed ' + esc(e.ack.at.slice(0, 10)) + (e.ack.note ? ': ' + esc(e.ack.note) : '') + '</div>' : '') + '</td><td class="num ' + moneyCls(e.amount) + '">' + (e.amount ? inr(e.amount) : '') + '</td><td style="white-space:nowrap">' + (e.ids.length ? '<button class="btn sm" data-act="showIds" data-arg="' + esc(e.key) + '">Show rows</button> ' : '<button class="btn sm" data-act="goto" data-arg="' + e.tab + '">Open</button> ') + '<button class="btn sm" data-act="ack" data-arg="' + esc(e.key) + '">' + (e.ack ? 'Reopen' : 'Mark reviewed') + '</button></td></tr>').join('') + '</tbody></table></div>' : '<div class="small">Nothing in this list.</div>';
  return '<div class="vh"><h1>Controls and review</h1><span class="sub">' + ok + ' of ' + ck.length + ' controls reconcile · tolerance ' + inr2(tol) + '</span></div>' +
    panel('Controls', ct, {note: 'Every dashboard total is re-derived from the source rows here.'}) + '<div style="height:14px"></div>' + panel('Exceptions for review', exl, {right: seg, note: 'Flagged, never changed. Marking reviewed only hides it from the badge.'}) + '<div style="height:14px"></div>' + panel('Bank reconciliation by month', mt, {note: 'Opening + additions + expenses + transfers + investments = closing; fund balances must equal the ledger.'});
}

/* ============ SETUP ============ */
function vSetup() {
  const c = S.cfg, m = S.meta, tol = c.tol;
  const O = (arr, cur) => arr.map(v => '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
  const data = panel('Data', '<div class="row mb"><button class="btn primary" data-act="pickFile">Import workbook</button><button class="btn" data-act="backup">Save backup</button><button class="btn" data-act="pickBackup">Restore backup</button><button class="btn danger" data-act="resetAll">Erase everything</button></div>' +
    '<div class="small">' + (m ? esc(m.file) + ', sheet "' + esc(m.sheet) + '", imported ' + esc(m.importedAt.slice(0, 16).replace('T', ' ')) + '. ' + S.tx.length + ' rows read' + (S.bad.length ? ', ' + S.bad.length + ' rejected' : '') + (m.totalsSkipped ? ', ' + m.totalsSkipped + ' totals row skipped' : '') + '.' : 'No workbook imported yet.') + ' Everything stays in this browser on this device. Importing again replaces bank rows but keeps your plan, categories, cash entries and notes.</div>' +
    '<div class="small mt">Family Fund version ' + esc(APP_VERSION) + '</div>' +
    '<div class="row mt"><div class="field"><label for="st-bal">Bank statement balance (₹)</label><input id="st-bal" type="text" inputmode="decimal" autocomplete="off" data-num step="0.01" value="' + (m && m.statementBalance != null ? m.statementBalance : '') + '" data-cfg="stmt" style="width:180px"></div><div class="field"><label for="st-tol">Rounding tolerance (₹)</label><input id="st-tol" type="text" inputmode="decimal" autocomplete="off" data-num step="0.01" min="0" value="' + tol + '" data-cfg="tol" style="width:120px"></div></div>');
  const plan = panel('Contribution plan', '<div class="small mb">Each line applies from its month onward and replaces the earlier line for the same brother and type. A brother-specific line beats "All". Past months keep the target that applied then. To stop a contribution, add a Suspended line from that month; to restart, add an Active line.</div>' +
    tbl([{h: 'From month', f: r => '<input type="month" value="' + esc(r.from) + '" data-plan="' + r.id + '" data-k="from" aria-label="From month">'}, {h: 'Brother', f: r => '<select data-plan="' + r.id + '" data-k="brother" aria-label="Brother">' + O(['All', ...c.brothers], r.brother) + '</select>'}, {h: 'Type', f: r => '<select data-plan="' + r.id + '" data-k="type" aria-label="Type">' + O(['Household', 'Investment'], r.type) + '</select>'}, {h: 'Monthly amount (₹)', f: r => '<input type="text" inputmode="decimal" autocomplete="off" data-num min="0" step="100" value="' + r.amount + '" data-plan="' + r.id + '" data-k="amount" style="width:130px" aria-label="Amount">'}, {h: 'Status', f: r => '<select data-plan="' + r.id + '" data-k="status" aria-label="Status">' + O(['Active', 'Suspended'], r.status) + '</select>'}, {h: '', f: r => '<button class="btn sm danger" data-act="delPlan" data-arg="' + r.id + '">Remove</button>'}], c.plan.slice().sort((a, b) => a.from < b.from ? -1 : 1), {nosort: true}) +
    '<div class="row mt"><button class="btn" data-act="addPlan">Add plan line</button><span class="small">Special one-off contributions are tracked as received under Special, not as a monthly target.</span></div>');
  const goal = panel('Housing goal and medical', '<div class="formgrid"><div class="field"><label for="g-t">Target amount (₹)</label><input id="g-t" type="text" inputmode="decimal" autocomplete="off" data-num min="0" step="100000" value="' + c.goal.target + '" data-cfg="gtarget"></div><div class="field"><label for="g-s">Goal clock starts</label><input id="g-s" type="month" value="' + esc(c.goal.start) + '" data-cfg="gstart"></div><div class="field"><label for="g-y">Horizon (years)</label><input id="g-y" type="text" inputmode="decimal" autocomplete="off" data-num min="1" max="40" value="' + c.goal.years + '" data-cfg="gyears"></div><div class="field span3"><label for="med-d">Medical expenses are treated as, unless changed per payment</label><select id="med-d" data-cfg="meddef">' + O(MEDTREAT, c.medicalDefault) + '</select><span class="hint">Household: inside the household fund. Separate: own medical fund. Special: paid from an extraordinary fund. Reports change; transactions do not.</span></div></div>');
  const catText = Object.entries(c.categories).map(([k, v]) => k + (v.length ? ': ' + v.join(', ') : '')).join('\n');
  const cats = panel('Categories and subcategories', '<div class="field"><label for="cat-t">One category per line. Subcategories after a colon, separated by commas.</label><textarea id="cat-t" rows="10" >' + esc(catText) + '</textarea></div><div class="row mt"><button class="btn" data-act="saveCats">Save categories</button></div>');
  const rules = panel('Payee rules', '<div class="small mb">If a description contains the text, the category is applied. First match wins. A category you set on a single transaction beats a rule.</div>' + tbl([{h: 'Description contains', f: (r, i) => esc(r.kw)}, {h: 'Category', f: r => esc(r.cat)}, {h: '', f: (r, i) => '<button class="btn sm danger" data-act="delRule" data-arg="' + i + '">Remove</button>'}], c.rules, {maxH: 300, nosort: true}) + '<div class="row mt"><div class="field"><label for="rl-k">Text</label><input id="rl-k" placeholder="e.g. medical store"></div><div class="field"><label for="rl-c">Category</label><select id="rl-c">' + O(Object.keys(c.categories), '') + '</select></div><div class="field"><label>&nbsp;</label><button class="btn" data-act="addRule">Add rule</button></div></div>');
  const masters = panel('Lists used in dropdowns', '<div class="kv"><div class="r"><span>Brothers</span><span>' + esc(c.brothers.join(', ')) + '</span></div><div class="r"><span>Payment modes</span><span>' + MODES.join(', ') + '</span></div><div class="r"><span>Contribution types</span><span>' + CTYPES.join(', ') + '</span></div><div class="r"><span>Transaction types</span><span>' + TTYPES.join(', ') + '</span></div><div class="r"><span>Medical treatment</span><span>' + MEDTREAT.join(', ') + '</span></div><div class="r"><span>Contribution status</span><span>' + STATUSES.join(', ') + '</span></div><div class="r"><span>Accounts</span><span>' + ACCOUNTS.join(', ') + '</span></div><div class="r"><span>Sources</span><span>Bank (imported), Cash (ledger)</span></div></div>');
  const members = panel('Family members', '<div class="small mb">Write each name exactly as it appears in the Depositor column of your bank workbook. Names are saved in this browser only. Changing a name here also updates your plan lines and cash entries. Clear a box to remove that brother.</div>' +
    '<div class="row">' + c.brothers.map((b, i) => '<div class="field"><label for="mb-' + i + '">Brother ' + (i + 1) + '</label><input id="mb-' + i + '" type="text" value="' + esc(b) + '" data-member="' + i + '" style="width:150px" autocomplete="off"></div>').join('') +
    '<div class="field"><label>&nbsp;</label><button class="btn" data-act="addMember">Add brother</button></div></div>' +
    '<div class="row mt"><div class="field"><label for="mb-sp">Person who spends (household account)</label><input id="mb-sp" type="text" value="' + esc(c.spender || '') + '" data-cfg="spender" style="width:180px" autocomplete="off"></div>' +
    '<div class="field"><label for="mb-bk">Bank labels in the Depositor column (comma-separated)</label><input id="mb-bk" type="text" value="' + esc((c.banks || []).join(', ')) + '" data-cfg="banks" style="width:240px" autocomplete="off"></div></div>');
  return '<div class="vh"><h1>Setup</h1><span class="sub">Plan, categories and data</span></div>' + data + '<div style="height:14px"></div>' + members + '<div style="height:14px"></div>' + plan + '<div class="grid g2 mt">' + goal + cats + '</div><div class="grid g2">' + rules + masters + '</div>';
}

/* ============ TRANSACTION EDIT MODAL ============ */
function spRow(cat, amt) {
  return '<div class="row sp-row" style="margin-bottom:6px"><select class="sp-cat" aria-label="Category for this part"><option value="">Choose category…</option>' + Object.keys(S.cfg.categories).map(c => '<option' + (c === cat ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select><input class="sp-amt" type="text" inputmode="decimal" autocomplete="off" data-num step="0.01" min="0" style="width:130px" aria-label="Amount for this part" value="' + (amt == null ? '' : amt) + '"><button class="btn sm danger" data-act="spDel" aria-label="Remove this part">×</button></div>';
}
function txModal(id) {
  const e = R.byId[id] || R.byId[id + '~1']; if (!e) return '';
  const orig = S.tx.find(t => t.id === id) || {amt: e.amt};
  if (e.src === 'Cash') return cashModal(id);
  const ov = S.overlay[id] || {}, O = (arr, cur) => arr.map(v => '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
  const isExp = ['hhx', 'chg', 'med', 'spx'].includes(e.kind), isMed = e.kind === 'med', isInv = e.kind === 'invd' || e.kind === 'invr';
  return '<div class="modal-bg" data-modal><div class="modal" role="dialog" aria-modal="true" aria-labelledby="tm-t"><h2 id="tm-t">Bank transaction</h2><div class="kv mb"><div class="r"><span>Date</span><b>' + dFull(e.date) + '</b></div><div class="r"><span>Person</span><b>' + esc(e.person) + '</b></div><div class="r"><span>Original purpose and type</span><b>' + esc(e.purpose + ' · ' + e.type) + '</b></div><div class="r"><span>Amount</span><b>' + inr2(orig.amt) + '</b></div><div class="r"><span>Treated as</span><b>' + esc(KIND_LABEL[e.kind]) + '</b></div></div><div class="small mb">' + esc(e.desc) + '</div>' +
    '<div class="callout">The imported row is never edited. What you choose below is stored on top of it and survives future imports.</div><div class="formgrid">' +
    (isExp ? '<div class="field"><label for="tx-cat">Category</label><select id="tx-cat"><option value="">Automatic (' + esc(e.ov && ov.cat ? '…' : e.cat) + ')</option>' + O(Object.keys(S.cfg.categories), ov.cat) + '</select></div>' : '') +
    '<div class="field"><label for="tx-mode">Payment mode</label><select id="tx-mode"><option value="">Automatic (' + esc(modeOf(e.desc, e.type)) + ')</option>' + O(MODES, ov.mode) + '</select></div>' +
    (isMed ? '<div class="field"><label for="tx-med">Medical treatment</label><select id="tx-med"><option value="">Default (' + esc(S.cfg.medicalDefault) + ')</option>' + O(MEDTREAT, ov.med) + '</select></div>' : '') +
    (isInv ? '<div class="field"><label for="tx-inv">Investment payout is</label><select id="tx-inv">' + O(INVTREAT, ov.inv || 'Deployed') + '</select><span class="hint">Returned lowers ' + esc(e.person) + '\'s ownership. Deployed does not.</span></div>' : '') +
    '<div class="field span3"><label for="tx-note">Note</label><input id="tx-note" value="' + esc(ov.note || '') + '" placeholder="Why it was treated this way"></div></div>' +
    splitBox(e, orig, ov) + '<div class="foot"><button class="btn danger" data-act="clearOv" data-arg="' + esc(id) + '"' + (S.overlay[id] ? '' : ' disabled') + '>Remove my changes</button><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="saveTx" data-arg="' + esc(id) + '">Save</button></div></div></div>';
}

function splitBox(e, orig, ov) {
  const can = ['hhx', 'med', 'spx'].includes(e.kind) && !e.atm && orig.amt < 0;
  if (!can) return e.atm ? '<div class="small mt">ATM withdrawals are itemised in the Cash ledger instead of being split.</div>' : '';
  const parts = ov.split || [], total = r2(-orig.amt);
  return '<div class="mt" id="sp-box" data-total="' + total + '"><h3 style="font-size:14px;margin-bottom:4px">Split across categories</h3><div class="small mb">Use this when one payment covers more than one thing. The parts must add up to ' + inr2(total) + '. Totals, balances and reconciliation do not change.</div><div id="sp-rows">' + parts.map(p => spRow(p.cat, p.amt)).join('') + '</div><div class="row mt"><button class="btn sm" data-act="spAdd" id="sp-add">' + (parts.length ? 'Add part' : 'Split this payment') + '</button><button class="btn sm" data-act="spClear" id="sp-clear"' + (parts.length ? '' : ' style="display:none"') + '>Remove split</button><span id="sp-rem" class="small"></span></div><div id="tx-msg" class="callout neg" style="display:none;margin-top:10px"></div></div>';
}
