// ============================================================
// AUTH — الحسابات والصلاحيات وسجل التغييرات
// يخزّن كل شيء داخل STATE فيُحفظ تلقائياً في Firebase
// ============================================================
'use strict';

const crypto = require('crypto');

let STATE = null;
let saveState = () => {};

const SESSION_SECRET = process.env.SESSION_SECRET
  || crypto.createHash('sha256').update('o2-dev-secret-change-me').digest('hex');
const SESSION_HOURS = parseInt(process.env.SESSION_TTL_HOURS || '12', 10);
const COOKIE = 'o2_session';

/* ============ الأدوار ============ */

const ROLES = {
  super_admin: {
    label: 'سوبر أدمن', color: '#00d97e',
    perms: ['menu.view', 'menu.toggle', 'menu.edit', 'orders.view', 'orders.edit',
      'drivers.manage', 'replies.edit', 'settings.edit', 'bot.manage',
      'users.manage', 'audit.view', 'learn.manage', 'transfer.manage'],
  },
  cashier:       { label: 'كاشير',      color: '#f5a623', perms: ['menu.view', 'menu.toggle'] },
  call_center:   { label: 'كول سنتر',   color: '#4a9eff', perms: ['menu.view', 'menu.toggle'] },
  customer_care: { label: 'كاستمر كير', color: '#b26bff', perms: ['menu.view', 'menu.toggle'] },
};

function can(user, perm) {
  if (!user) return false;
  const r = ROLES[user.role];
  return !!r && r.perms.includes(perm);
}

function roleLabel(role) {
  return (ROLES[role] && ROLES[role].label) || role;
}

/* ============ كلمات المرور ============ */

function hash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}

function verify(password, salt, expected) {
  try {
    const a = crypto.scryptSync(password, salt, 64);
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

/* ============ التهيئة ============ */

const DEFAULTS = [
  { id: 'u-super', username: 'murad',      displayName: 'مراد عابد',  role: 'super_admin',
    pw: process.env.DEFAULT_ADMIN_PASSWORD || 'O2-admin-2026' },
  { id: 'u-cash',  username: 'cashier',    displayName: 'الكاشير',     role: 'cashier',       pw: 'O2-cashier' },
  { id: 'u-call',  username: 'callcenter', displayName: 'الكول سنتر',  role: 'call_center',   pw: 'O2-call' },
  { id: 'u-care',  username: 'care',       displayName: 'كاستمر كير',  role: 'customer_care', pw: 'O2-care' },
];

/** يُستدعى بعد loadState — ينشئ الحسابات الناقصة فقط ولا يمسّ الموجود */
function init(state, saver) {
  STATE = state;
  saveState = saver || (() => {});
  if (!Array.isArray(STATE.users)) STATE.users = [];
  if (!Array.isArray(STATE.audit)) STATE.audit = [];

  let created = 0;
  for (const d of DEFAULTS) {
    if (STATE.users.some(u => u.id === d.id)) continue;
    const { salt, hash: h } = hash(d.pw);
    STATE.users.push({
      id: d.id, username: d.username, displayName: d.displayName, role: d.role,
      salt, hash: h, active: true, usingDefaultPassword: true,
      whatsappNumber: '', lastLoginAt: null, createdAt: new Date().toISOString(),
    });
    created++;
  }
  if (created) { saveState(); console.log(`👥 أُنشئت ${created} حسابات افتراضية`); }
  const weak = STATE.users.filter(u => u.usingDefaultPassword).map(u => u.username);
  if (weak.length) console.log(`⚠️  حسابات ما زالت بكلمة المرور الافتراضية: ${weak.join('، ')}`);
}

/* ============ العمليات ============ */

const users = () => (STATE && STATE.users) || [];
const byId = (id) => users().find(u => u.id === id) || null;
const byUsername = (n) => users().find(u => u.username.toLowerCase() === String(n || '').trim().toLowerCase()) || null;

function byWhatsapp(jid) {
  const n = String(jid || '').split('@')[0].replace(/\D/g, '');
  if (!n) return null;
  return users().find(u => u.whatsappNumber && u.whatsappNumber.replace(/\D/g, '') === n) || null;
}

function login(username, password) {
  const u = byUsername(username);
  if (!u || !u.active || !verify(password, u.salt, u.hash)) return null;
  u.lastLoginAt = new Date().toISOString();
  saveState();
  return u;
}

function setPassword(id, password) {
  const u = byId(id);
  if (!u) return false;
  const { salt, hash: h } = hash(password);
  u.salt = salt; u.hash = h; u.usingDefaultPassword = false;
  saveState();
  return true;
}

function updateUser(id, patch) {
  const u = byId(id);
  if (!u) return null;
  if (patch.displayName    !== undefined) u.displayName    = String(patch.displayName).trim();
  if (patch.username       !== undefined) u.username       = String(patch.username).trim();
  if (patch.active         !== undefined) u.active         = !!patch.active;
  if (patch.whatsappNumber !== undefined) u.whatsappNumber = String(patch.whatsappNumber).replace(/\D/g, '');
  saveState();
  return u;
}

/** نسخة آمنة للإرسال للواجهة — بدون hash/salt */
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, displayName: u.displayName, role: u.role,
    roleLabel: roleLabel(u.role), color: (ROLES[u.role] || {}).color || '#888',
    active: u.active, usingDefaultPassword: u.usingDefaultPassword,
    whatsappNumber: u.whatsappNumber, lastLoginAt: u.lastLoginAt,
    perms: (ROLES[u.role] || {}).perms || [],
  };
}

/* ============ سجل التغييرات ============ */

const MAX_AUDIT = 1500;

function audit(user, action, target, details = '', source = 'dashboard') {
  if (!STATE) return;
  if (!Array.isArray(STATE.audit)) STATE.audit = [];
  STATE.audit.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    at: new Date().toISOString(),
    userId: user ? user.id : null,
    userName: user ? user.displayName : 'النظام',
    role: user ? user.role : 'system',
    roleLabel: user ? roleLabel(user.role) : 'النظام',
    action, target, details, source,
  });
  if (STATE.audit.length > MAX_AUDIT) STATE.audit.length = MAX_AUDIT;
  saveState();
}

function auditList({ limit = 300, q = '' } = {}) {
  let rows = (STATE && STATE.audit) || [];
  if (q) {
    const n = String(q).trim();
    rows = rows.filter(r => (r.target || '').includes(n) || (r.details || '').includes(n) || (r.userName || '').includes(n));
  }
  return rows.slice(0, limit);
}

function auditStats() {
  const rows = (STATE && STATE.audit) || [];
  const since = Date.now() - 24 * 3600 * 1000;
  const today = rows.filter(r => new Date(r.at).getTime() >= since);
  const byUser = {};
  for (const r of today) byUser[r.userName] = (byUser[r.userName] || 0) + 1;
  return { total: rows.length, last24h: today.length, byUser };
}

/* ============ الجلسات (كوكي موقّعة) ============ */

const sign = (p) => crypto.createHmac('sha256', SESSION_SECRET).update(p).digest('base64url');

function issue(user) {
  const body = Buffer.from(JSON.stringify({
    uid: user.id, exp: Date.now() + SESSION_HOURS * 3600 * 1000,
  })).toString('base64url');
  return `${body}.${sign(body)}`;
}

function readToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const exp = sign(body);
  if (!sig || sig.length !== exp.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return null;
  try {
    const d = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!d.exp || d.exp < Date.now()) return null;
    const u = byId(d.uid);
    return u && u.active ? u : null;
  } catch { return null; }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const userFromReq = (req) => readToken(parseCookies(req.headers.cookie)[COOKIE]);

const cookieHeader = (token) =>
  `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}`
  + (process.env.NODE_ENV === 'production' ? '; Secure' : '');

const clearCookieHeader = () => `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;

/* ============ خريطة صلاحيات نقاط الـ API ============ */

/** يرجع اسم الصلاحية المطلوبة لهذا الطلب، أو null إذا كانت مفتوحة */
function permFor(url, method, body) {
  if (url === '/api/auth/me' || url === '/api/auth/login' || url === '/api/auth/logout') return null;

  // تبديل توفّر صنف: تعديل حقل active فقط
  if (/^\/api\/items\/\d+$/.test(url) && method === 'PUT') {
    const keys = Object.keys(body || {});
    const onlyActive = keys.length > 0 && keys.every(k => k === 'active' || k === 'id');
    return onlyActive ? 'menu.toggle' : 'menu.edit';
  }
  if (url === '/api/items' && method === 'POST')          return 'menu.edit';
  if (/^\/api\/items\/\d+$/.test(url) && method === 'DELETE') return 'menu.edit';
  if (url === '/api/cats/toggle')                          return 'menu.toggle'; // إغلاق/تفعيل قسم كامل
  if (url.startsWith('/api/cats'))                        return method === 'GET' ? 'menu.view' : 'menu.edit';
  if (url.startsWith('/api/replies'))                     return 'replies.edit';
  if (url.startsWith('/api/settings'))                    return 'settings.edit';
  if (url.startsWith('/api/bot/'))                        return 'bot.manage';
  if (url.startsWith('/api/drivers'))                     return method === 'GET' ? 'orders.view' : 'drivers.manage';
  if (url.startsWith('/api/orders'))                      return method === 'GET' ? 'orders.view' : 'orders.edit';
  if (url.startsWith('/api/queue'))                       return 'transfer.manage';
  if (url.startsWith('/api/send'))                        return 'transfer.manage';
  if (url.startsWith('/api/learn') || url.startsWith('/api/unknown') || url.startsWith('/api/alias')
      || url.startsWith('/api/analyz'))                   return 'learn.manage';
  if (url.startsWith('/api/users'))                       return 'users.manage';
  if (url.startsWith('/api/audit'))                       return 'audit.view';
  if (url.startsWith('/api/simulate'))                    return 'bot.manage';
  if (url.startsWith('/api/groups'))                      return 'settings.edit';
  if (url.startsWith('/api/customers'))                   return 'orders.view';
  if (url === '/api/logs')                                return 'audit.view';
  if (url === '/api/state' || url === '/api/status')      return 'menu.view';

  return 'settings.edit'; // الافتراضي: الأشد
}

module.exports = {
  ROLES, COOKIE,
  init, can, roleLabel,
  users, byId, byUsername, byWhatsapp, publicUser,
  login, setPassword, updateUser,
  audit, auditList, auditStats,
  issue, readToken, userFromReq, cookieHeader, clearCookieHeader,
  permFor,
};
