#!/usr/bin/env node
/**
 * يفحص سبب عدم ظهور صور المنيو — خطوة بخطوة.
 *
 *   node check-images.js                              # فحص محلي فقط
 *   node check-images.js https://o2bot-b7a51.web.app  # + فحص النطاق فعلياً
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE_URL = (process.argv[2] || '').replace(/\/+$/, '');
let problems = 0;

function ok(m)   { console.log('  ✅ ' + m); }
function bad(m)  { console.log('  ❌ ' + m); problems++; }
function warn(m) { console.log('  ⚠️  ' + m); }
function head(t) { console.log('\n════ ' + t + ' ════'); }

function fetchHead(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'GET', timeout: 12000 }, (res) => {
      const type = res.headers['content-type'] || '';
      let bytes = 0;
      res.on('data', (c) => { bytes += c.length; if (bytes > 2048) res.destroy(); });
      res.on('end',   () => resolve({ status: res.statusCode, type, bytes }));
      res.on('close', () => resolve({ status: res.statusCode, type, bytes }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, err: 'انتهت المهلة' }); });
    req.on('error', (e) => resolve({ status: 0, err: e.message }));
    req.end();
  });
}

(async () => {
  console.log('🖼️  فحص صور المنيو');

  /* ── 1) الملفات محلياً ── */
  head('1) الصور على القرص');
  const pub = path.join(__dirname, 'public', 'menu');
  if (!fs.existsSync(pub)) {
    bad('مجلد public/menu غير موجود — فُك أرشيف الصور داخل مجلد المشروع');
  } else {
    let n = 0, bytes = 0;
    (function walk(d) {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.(jpe?g|png|webp|ico)$/i.test(f.name)) { n++; bytes += fs.statSync(p).size; }
      }
    })(pub);
    ok(`${n} صورة (${(bytes / 1048576).toFixed(1)} MB)`);
  }

  /* ── 2) تطابق المسارات ── */
  head('2) تطابق مسارات المنيو مع الملفات');
  try {
    const { branchMenuData } = require('./menu-source');
    const refs = new Set();
    for (const b of Object.values(branchMenuData))
      for (const c of Object.values(b))
        for (const i of c.items) if (i.image) refs.add(i.image);
    const root = path.join(__dirname, 'public');
    // المسار الصحيح للويب يبدأ بـ /menu/ — أي شكل آخر يكسر الرابط
    const shaped = [...refs].filter((r) => !/^(\/menu\/|https?:\/\/)/.test(r));
    if (shaped.length) {
      bad(`${shaped.length} مسار بشكل خاطئ — يجب أن يبدأ بـ /menu/`);
      shaped.slice(0, 5).forEach((m) => console.log('       ' + m + '   ← الصحيح: ' + m.replace(/^.*?(\/?menu\/)/, '/menu/')));
      console.log('       أصلحها في menu-source.js ثم أعد تشغيل الخدمة');
    } else ok(`كل المسارات الـ${refs.size} بالشكل الصحيح`);

    const missing = [...refs]
      .filter((r) => !/^https?:\/\//.test(r))
      .filter((r) => !fs.existsSync(path.join(root, r.replace(/^.*?(\/?menu\/)/, '/menu/'))));
    if (missing.length) {
      bad(`${missing.length} مسار بلا ملف صورة`);
      missing.slice(0, 6).forEach((m) => console.log('       ' + m));
    } else ok('كل المسارات لها ملف على القرص');
  } catch (e) { bad('تعذّر قراءة menu-source.js: ' + e.message); }

  /* ── 3) جاهزية النشر ── */
  head('3) جاهزية Firebase Hosting');
  fs.existsSync(path.join(__dirname, 'firebase.json'))
    ? ok('firebase.json موجود')
    : bad('firebase.json مفقود');

  const rcPath = path.join(__dirname, '.firebaserc');
  if (fs.existsSync(rcPath)) {
    try {
      const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
      ok('.firebaserc → المشروع: ' + (rc.projects && rc.projects.default));
    } catch { bad('.firebaserc تالف'); }
  } else {
    bad('.firebaserc مفقود — deploy سيفشل بـ "No project active"');
    console.log('       الحل:  firebase use --add   أو أنشئ الملف يدوياً');
  }

  fs.existsSync(path.join(__dirname, '.firebase'))
    ? ok('.firebase موجود — سبق تنفيذ deploy')
    : bad('لم يُنفَّذ firebase deploy بعد — الصور ليست على الإنترنت');

  /* ── 4) فحص النطاق فعلياً ── */
  head('4) فحص النطاق');
  if (!BASE_URL) {
    warn('لم تمرّر نطاقاً. للفحص الكامل:');
    console.log('       node check-images.js https://o2bot-b7a51.web.app');
  } else {
    console.log('  النطاق: ' + BASE_URL + '\n');
    const samples = ['/menu/shawarma/48.jpg', '/menu/sweets/9.jpg', '/menu/drinks/1.jpg'];
    let good = 0;
    for (const s of samples) {
      const url = BASE_URL + s;
      const r = await fetchHead(url);
      if (r.status === 200 && /^image\//.test(r.type)) { ok(s + '  →  200 ' + r.type); good++; }
      else if (r.status === 200) bad(s + '  →  200 لكن النوع ' + r.type + ' (ليست صورة — غالباً صفحة HTML)');
      else if (r.status === 404) bad(s + '  →  404 غير موجودة على النطاق');
      else if (r.status === 0)   bad(s + '  →  ' + (r.err || 'تعذّر الوصول'));
      else                       bad(s + '  →  ' + r.status);
    }
    if (good === samples.length) {
      console.log('');
      ok('النطاق يعمل. ضعه في: اللوحة ← الإعدادات ← نطاق صور المنيو');
      console.log('       ' + BASE_URL);
    }
  }

  /* ── الخلاصة ── */
  head('الخلاصة');
  if (problems === 0) {
    console.log('  ✅ كل شيء سليم');
  } else {
    console.log(`  ${problems} مشكلة. الترتيب الصحيح:\n`);
    console.log('   1) firebase login');
    console.log('   2) firebase use --add        ← اختر o2bot-b7a51');
    console.log('   3) firebase deploy --only hosting');
    console.log('   4) انسخ الـ Hosting URL من المخرجات');
    console.log('   5) node check-images.js <الرابط>   ← تأكّد أنه يعمل');
    console.log('   6) اللوحة ← الإعدادات ← نطاق صور المنيو ← الصق الرابط ← حفظ');
  }
  console.log('');
  process.exit(problems ? 1 : 0);
})();
