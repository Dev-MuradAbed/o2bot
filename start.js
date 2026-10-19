/**
 * نقطة تشغيل البوت على cPanel/Namecheap.
 *
 * لماذا هذا الملف؟
 * لوحة الاستضافة تمرّر متغيرات البيئة عبر الشِل فتحذف علامات " من
 * قيمة FIREBASE_SERVICE_ACCOUNT، فيصل المفتاح تالفاً ويتوقف البوت (503).
 * هذا الملف يقرأ المفتاح من ملف JSON داخل مجلد البوت ويضعه في المتغيّر
 * من داخل Node نفسه (بلا شِل)، ثم يشغّل index.js كالمعتاد.
 * يعمل مع أي نسخة من index.js — قديمة أو جديدة.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const log = (...a) => console.error(...a);   // stderr ← يظهر في stderr.log
log(`\n🚀 start.js (2026-10-19) — ${new Date().toISOString()}`);

function isJson(t) {
  try { const o = JSON.parse(String(t || '').trim()); return o && typeof o === 'object'; }
  catch { return false; }
}

if (isJson(process.env.FIREBASE_SERVICE_ACCOUNT)) {
  log('🔑 FIREBASE_SERVICE_ACCOUNT صالح — يُستخدم كما هو');
} else {
  const dir = __dirname;
  let files = [];
  try { files = fs.readdirSync(dir); } catch { /* */ }
  const candidates = [
    process.env.FIREBASE_KEY_FILE,
    path.join(dir, 'firebase-key.json'),
    ...files.filter(f => /firebase-adminsdk.*\.json$/i.test(f)).map(f => path.join(dir, f)),
  ].filter(Boolean);

  let used = null;
  for (const f of candidates) {
    try {
      if (!fs.existsSync(f)) continue;
      const txt = fs.readFileSync(f, 'utf8');
      if (!isJson(txt)) { log(`⚠️  ${path.basename(f)} موجود لكنه ليس JSON صالحاً`); continue; }
      process.env.FIREBASE_SERVICE_ACCOUNT = txt.trim();
      used = f;
      break;
    } catch (e) { log(`⚠️  تعذّرت قراءة ${path.basename(f)}: ${e.message}`); }
  }

  if (used) {
    log(`🔑 مفتاح Firebase قُرئ من الملف: ${path.basename(used)}`);
  } else {
    log('❌ لم يُعثر على مفتاح Firebase.');
    log('   ارفع ملف المفتاح إلى هذا المجلد باسم firebase-key.json');
    log(`   المجلد: ${dir}`);
    log(`   ملفات JSON الموجودة: ${files.filter(f => f.endsWith('.json')).join(', ') || '(لا شيء)'}`);
  }
}

require('./index.js');
