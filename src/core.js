'use strict';
/* ============ constants & helpers ============ */
const KEY = 'fbfund.v1';
const SEEN_KEY = 'fbfund.seenVersion';
const FUNDS = ['H', 'I', 'S', 'M', 'O', 'X'];   // household, investment, special, medical, outside the family fund, unclassified
// money that passes through the account but is not the family's: it comes in and goes out again
const OUTSIDE_REASONS = ['Payable to a third party', 'Donation / charity', 'Other debt', 'Not part of the family fund'];   // which version's "what's new" this browser has shown
const APP_VERSION = '__APP_VERSION__';   // filled in by build.py from VERSION
const WHATS_NEW = {   // shown once after an update; newest first
  '1.5.0': ['Print: Overview, Contributions, Household, Investments and Housing goal each have a Print button. The printout leaves out menus and buttons, stays light in dark mode and shows the period and the date printed.', 'You can start without the Excel workbook: from a bank statement, a transaction added by hand or a cash entry.'],
  '1.4.2': ['Saving categories now warns before it removes any. Setup → Categories has a button to bring back the default categories.'],
  '1.4.1': ['Updates install by themselves when you open the app, and Reload always works, so the "new version" message no longer keeps coming back.',
            'This note replaces the "What\'s new" window: it goes away by itself.'],
  '1.4.0': ['Add a bank transaction by hand (To review → Add transaction by hand), with who, what for and splits.',
            'When the statement with that transaction is imported, the app recognises your hand entry and keeps your choices: no duplicate.',
            'Setup → Remove Excel history: start clean and rebuild from bank statements and hand entries; your plan, cash ledger and approvals stay.'],
  '1.3.1': ['Money held for others (from a split or an "Outside the family fund" row) is no longer counted in the family\'s total. It is shown separately until it is paid out.',
            'When the bank balance differs from your statement, the app now says where the difference starts. Tap "see why".'],
  '1.3.0': ['Import the bank statement straight from HDFC net banking (Excel). No separate spreadsheet needed.',
            'New "To review" page: approve who each bank row belongs to and what it was for. Nothing counts until you approve it.',
            'Split one bank row across brothers and purposes, e.g. a deposit that is partly another brother\'s share or money owed to someone else.',
            '"Outside the family fund" for money that comes in and goes out for others: donations, charity, other debts, third parties.',
            'Cash ledger: "Paid directly by a brother" counts as his contribution and the family\'s expense together.',
            'Overlapping statements add only new rows; a missing statement or a balance that does not add up is flagged.'],
  '1.2.1': ['Erase everything now removes all saved data and restarts the app fresh.',
            'The version is shown in the sidebar and in Setup, and this note appears after each update.'],
  '1.2.0': ['Add to your Home Screen: it opens without internet, and tells you when a new version is ready.',
            'Backups can have a password (encrypted). Older backups still restore.',
            'Amounts can be typed as 10,000, 1,00,000 or ₹12,500.',
            'Your cursor and open sections stay put after each edit.',
            'Phone: the Filters pop-up stays on screen and above the cards.',
            'Libraries are bundled with the app and the page cannot send data to any server.']
};
/* Amounts as people type them: "10000", "10,000", "1,00,000" (lakh), "1 00 000", "₹ 1,250.50", "1250,5".
   Returns a number, or null if it is not one. */
function parseAmount(t) {
  let s = String(t == null ? '' : t).trim().replace(/[\s  '₹]/g, '').replace(/^rs\.?/i, '');
  if (!s) return null;
  const c = s.lastIndexOf(','), d = s.lastIndexOf('.');
  if (c > -1 && d > -1) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');   // the last mark is the decimal
  else if (c > -1) s = /^-?\d{1,3}(,\d{3})+$/.test(s) || /^-?\d{1,2}(,\d{2})*,\d{3}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');   // 10,000 / 1,00,000 grouping; 12,5 decimal
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s); return Number.isFinite(n) ? n : null;
}
const MS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MFULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MODES = ['Bank','Cash','UPI','Card','Transfer','Other'];
const CTYPES = ['Household','Investment','Special'];
const TTYPES = ['Deposit','Withdrawal','Internal Transfer','Cash Receipt','Cash Payment'];
const MEDTREAT = ['Household','Separate Family Medical','Special / Extraordinary'];
const INVTREAT = ['Deployed','Returned to brother'];
const STATUSES = ['Paid','Partially Paid','Unpaid','Overpaid','Advance','Not Required','Contribution Suspended'];
const ACCOUNTS = ['Cash','Bank (not yet in statement)'];
const CLASSES = ['Household','Investment','Medical','Other'];
const CHECK_STATUS = ['Reconciled','Difference','Review Required','Missing Classification'];
const DEFAULT_CATS = {
  'Groceries':['Provisions','Bakery','Vegetables & fruit'],
  'Utilities':['Internet','Mobile','Gas','Electricity','Water'],
  'Maintenance':['Building','Appliances'],
  'Household Supplies':['Cleaning','Kitchen'],
  'Education':['Fees','Books'],
  'Transport':['Fuel','Vehicle service'],
  'Medical':['Doctor','Medicines','Diagnostics','Hospital'],
  'Family Support':['Allowance','Parents'],
  'Festivals / Events':['Eid','Donation'],
  'Repairs':['Plumbing','Electrical','Furniture'],
  'Bank Charges':[],
  'Miscellaneous':[]
};
const DEFAULT_RULES = [
  ['jiofiber','Utilities'],['jio','Utilities'],['airtel','Utilities'],['gas agency','Utilities'],['electricity','Utilities'],
  ['bakery','Groceries'],['general store','Groceries'],['grocery','Groceries'],['supermarket','Groceries'],
  ['fuel','Transport'],['tyre','Transport'],['petrol','Transport'],
  ['medical','Medical'],['pharma','Medical'],['diagnos','Medical'],['hospital','Medical'],['clinic','Medical'],
  ['furniture','Repairs'],['electricals','Repairs'],['hardware','Repairs'],['plumb','Repairs']
].map(([kw,cat])=>({kw,cat}));

const $ = (s, e=document) => e.querySelector(s);
const $$ = (s, e=document) => [...e.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

function inr(n, d = 0) {
  if (n == null || Number.isNaN(n)) return '—';
  const a = Math.abs(n), neg = n < 0 && Math.round(a * Math.pow(10, d)) > 0;
  return (neg ? '−' : '') + '₹' + a.toLocaleString('en-IN', {minimumFractionDigits: d, maximumFractionDigits: d});
}
const inr2 = n => inr(n, 2);
function lakh(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e7) return s + '₹' + (a / 1e7).toFixed(2) + ' Cr';
  if (a >= 1e5) return s + '₹' + (a / 1e5).toFixed(2) + ' L';
  return inr(n);
}
const pct = (n, d = 1) => (n == null || !isFinite(n)) ? '—' : (n * 100).toFixed(d) + '%';
function axisFmt(v) {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e7) return s + +(a / 1e7).toFixed(1) + 'Cr';
  if (a >= 1e5) return s + +(a / 1e5).toFixed(1) + 'L';
  if (a >= 1e3) return s + +(a / 1e3).toFixed(1) + 'k';
  return s + Math.round(a);
}
const mLabel = m => m ? MS[+m.slice(5, 7) - 1] + ' ' + m.slice(2, 4) : '';
const mLong = m => m ? MFULL[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4) : '';
const dLabel = d => d ? (+d.slice(8, 10)) + ' ' + MS[+d.slice(5, 7) - 1] + ' ' + d.slice(2, 4).replace(/^/, '\u2019') : '';
const dFull = d => d ? d.slice(8, 10) + ' ' + MS[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4) : '';
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const addMonths = (m, n) => { const y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1 + n; const yy = y + Math.floor(mo / 12), mm = ((mo % 12) + 12) % 12; return yy + '-' + String(mm + 1).padStart(2, '0'); };
const monthDiff = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
const validISO = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(new Date(s + 'T00:00:00Z')) && +s.slice(0, 4) >= 2000 && +s.slice(0, 4) <= 2100;

/* ============ state & persistence ============ */
function defaults() {
  return {
    v: 1, tx: [], bad: [], meta: null, overlay: {}, cash: [], ack: {},
    stmt: [],        // rows read from bank statements, exactly as the bank gave them
    review: {},      // your decision for each statement row: who and what, possibly split into parts
    stmtFiles: [],   // which statements were imported, for the import history
    cfg: {
      // Placeholder names that match the sample workbook. Set your family's real names in Setup → Family
      // members; they are saved in this browser only, never in this code or on the website.
      brothers: ['Aman', 'Bilal', 'Chirag', 'Dev'],
      spender: 'Parent',          // the person who spends from the household account
      banks: ['Bank'],            // depositor labels the bank itself uses (interest, charges)
      plan: [
        {id: 'p1', from: '2025-01', brother: 'All', type: 'Household', amount: 10000, status: 'Active'},
        {id: 'p2', from: '2025-01', brother: 'All', type: 'Investment', amount: 10000, status: 'Active'}
      ],
      medicalDefault: 'Household', tol: 0.5,
      goal: {target: 10000000, start: '2025-01', years: 10, ret: 0, basis: 'lifetime'},
      categories: JSON.parse(JSON.stringify(DEFAULT_CATS)),
      rules: JSON.parse(JSON.stringify(DEFAULT_RULES)),
      people: ['Parent', 'Aman', 'Bilal', 'Chirag', 'Dev']
    }
  };
}
/* Data saved by version 1.2.1 or earlier has no spender or bank labels: those versions treated two fixed
   depositor labels that way, so keep exactly that behaviour for it. */
function upgradeCfg(cfg) {
  if (cfg && !('spender' in cfg)) { cfg.spender = ['B', 'a', 'p', 'a'].join(''); cfg.banks = ['HD' + 'FC']; }
  return cfg;
}
function loadState() {
  try {
    const j = localStorage.getItem(KEY);
    if (j) {
      const o = JSON.parse(j), d = defaults();
      upgradeCfg(o.cfg);
      o.cfg = Object.assign(d.cfg, o.cfg || {});
      o.cfg.goal = Object.assign(d.cfg.goal, (o.cfg || {}).goal || {});
      return Object.assign(d, o, {cfg: o.cfg});
    }
  } catch (e) { /* ignore */ }
  return defaults();
}
let S = loadState();
let saveT;
function flushSave() {
  clearTimeout(saveT); saveT = null;
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Could not save to this browser. Use Setup → Save backup.', 'warn'); }
}
function persist() { clearTimeout(saveT); saveT = setTimeout(flushSave, 150); }
window.addEventListener('pagehide', () => { if (saveT) flushSave(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveT) flushSave(); });
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
}

/* ============ workbook import ============ */
const normH = s => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '');
function serialToISO(v) {
  const d = new Date(Math.round((v - 25569) * 864e5));
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}
function parseDateCell(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  if (typeof v === 'number') return v > 20000 && v < 80000 ? serialToISO(v) : null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3})[a-z]*[-\/ ](\d{4})$/);
  if (m) { const mi = MS.findIndex(x => x.toLowerCase() === m[2].toLowerCase()); if (mi >= 0) return m[3] + '-' + String(mi + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return null;
}
function parseAmt(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[₹,\s]/g, ''));
  return isFinite(n) ? n : null;
}
function parseWorkbook(buf, fileName) {
  if (typeof XLSX === 'undefined') throw new Error('The spreadsheet reader did not load. Check your connection and reload.');
  const wb = XLSX.read(buf, {type: 'array'});
  let pick = null;
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {header: 1, raw: true, defval: null});
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const h = (rows[i] || []).map(normH);
      if (h.includes('date') && h.includes('depositor') && h.includes('amount') && h.includes('purpose')) {
        if (!pick || /transaction/i.test(name)) pick = {name, rows, hi: i, h};
        break;
      }
    }
    if (pick && /transaction/i.test(pick.name)) break;
  }
  if (!pick) throw new Error('No sheet with the columns Date, Depositor, TransactionType, Purpose, Description and Amount was found.');
  const col = k => pick.h.indexOf(k);
  const ci = {date: col('date'), dep: col('depositor'), type: col('transactiontype'), purp: col('purpose'), desc: col('description'), amt: col('amount')};
  if (ci.type < 0) throw new Error('The TransactionType column is missing.');
  let stmt = null;
  for (let i = 0; i < Math.min(pick.rows.length, 10) && stmt == null; i++) {
    const row = pick.rows[i] || [];
    const k = row.findIndex(c => typeof c === 'string' && /bank statement balance/i.test(c));
    if (k >= 0) for (let j = k + 1; j < row.length; j++) if (typeof row[j] === 'number') { stmt = row[j]; break; }
  }
  const tx = [], bad = [], seen = {};
  let totalsSkipped = 0, blank = 0;
  for (let i = pick.hi + 1; i < pick.rows.length; i++) {
    const r = pick.rows[i] || [];
    const cell = k => (k >= 0 ? r[k] : null);
    const rawDate = cell(ci.date), dep = String(cell(ci.dep) ?? '').trim(), type = String(cell(ci.type) ?? '').trim(),
      purpose = String(cell(ci.purp) ?? '').trim(), desc = String(cell(ci.desc) ?? '').trim(), rawAmt = cell(ci.amt);
    if ([rawDate, dep, type, purpose, desc, rawAmt].every(x => x == null || x === '')) { blank++; continue; }
    if (!dep && !purpose && !type && typeof rawDate === 'string' && /^total/i.test(rawDate.trim())) { totalsSkipped++; continue; }
    if ((rawDate == null || rawDate === '') && !dep && !purpose && !type && typeof rawAmt === 'number') { totalsSkipped++; continue; }
    const date = parseDateCell(rawDate), amt = parseAmt(rawAmt);
    const rec = {row: i + 1, date, dep, type, purpose, desc, amt};
    if (!validISO(date) || amt == null) { rec.reason = !validISO(date) ? 'Invalid or missing date' : 'Amount is not a number'; rec.rawDate = String(rawDate ?? ''); rec.rawAmt = String(rawAmt ?? ''); bad.push(rec); continue; }
    const base = [date, dep, type, purpose, amt, desc].join('|');
    seen[base] = (seen[base] || 0) + 1;
    rec.id = base + '#' + seen[base];
    tx.push(rec);
  }
  tx.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.row - b.row);
  return {tx, bad, meta: {file: fileName, sheet: pick.name, importedAt: new Date().toISOString(), statementBalance: stmt, rowsRead: tx.length + bad.length, totalsSkipped}};
}

/* ============ download helper ============ */
async function saveFile(filename, data, mime) {
  try {
    if (window.claude && typeof claude.use === 'function') {
      const dl = await claude.use('downloads');
      if (dl) { await dl.save({filename, data}); return; }
    }
  } catch (e) { if (e && e.code === 'declined') return; }
  const blob = data instanceof Blob ? data : new Blob([data], {type: mime || 'application/octet-stream'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
const toCSV = rows => rows.map(r => r.map(csvCell).join(',')).join('\n');
