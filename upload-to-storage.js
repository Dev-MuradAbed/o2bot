#!/usr/bin/env node
/**
 * يرفع صور المنيو إلى Firebase Storage ويجعلها عامة.
 *
 *   node upload-to-storage.js                 # يقرأ FIREBASE_SERVICE_ACCOUNT
 *   node upload-to-storage.js key.json        # أو من ملف مفتاح
 *
 * ⚠️ منذ 3 فبراير 2026 صار Firebase Storage يتطلب خطة Blaze (بطاقة بنكية)
 *    حتى لو بقي استهلاكك ضمن الحد المجاني. إن كنت على Spark استخدم
 *    Firebase Hosting بدلاً منه — انظر IMAGES.md، وهو مجاني بلا بطاقة.
 *
 * يرفع من مجلد public/menu محافظاً على نفس المسارات، فتبقى قيم
 * image في المنيو صالحة كما هي.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'public', 'menu');
const PREFIX = 'menu';                       // المسار داخل الحاوية
const CONTENT = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon' };

function listFiles(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) listFiles(p, out);
    else if (CONTENT[path.extname(f.name).toLowerCase()]) out.push(p);
  }
  return out;
}

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error('❌ مجلد public/menu غير موجود بجانب هذا السكربت');
    process.exit(1);
  }

  const keyFile = process.argv[2];
  let raw = keyFile ? fs.readFileSync(keyFile, 'utf8') : process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('❌ لا مفتاح. مرّر ملفاً أو اضبط FIREBASE_SERVICE_ACCOUNT');
    process.exit(1);
  }

  let sa;
  try { sa = JSON.parse(raw.trim()); }
  catch (e) { console.error('❌ المفتاح ليس JSON صالحاً: ' + e.message); process.exit(1); }
  if (typeof sa.private_key === 'string' && sa.private_key.includes('\\n')) {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }

  const { initializeApp, cert } = require('firebase-admin/app');
  const { getStorage } = require('firebase-admin/storage');

  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${sa.project_id}.firebasestorage.app`;
  console.log('المشروع : ' + sa.project_id);
  console.log('الحاوية : ' + bucketName);
  console.log('');

  initializeApp({ credential: cert(sa), storageBucket: bucketName });
  const bucket = getStorage().bucket();

  try {
    const [exists] = await bucket.exists();
    if (!exists) {
      console.error('❌ الحاوية غير موجودة: ' + bucketName);
      console.error('   إن كان اسمها مختلفاً اضبط FIREBASE_STORAGE_BUCKET');
      console.error('   وإن لم تُنشأ بعد: Firebase Console ← Build ← Storage ← Get started');
      console.error('   (يتطلب خطة Blaze منذ فبراير 2026)');
      process.exit(1);
    }
  } catch (e) {
    const m = String(e.message || e);
    if (/403|does not have storage|billing|Blaze/i.test(m)) {
      console.error('❌ لا صلاحية على Storage — غالباً المشروع على خطة Spark.');
      console.error('   منذ 3 فبراير 2026 يتطلب Storage خطة Blaze (بطاقة بنكية).');
      console.error('   البديل المجاني: Firebase Hosting — انظر IMAGES.md');
    } else {
      console.error('❌ ' + m);
    }
    process.exit(1);
  }

  const files = listFiles(SRC);
  console.log(`⬆️  رفع ${files.length} صورة…\n`);

  let done = 0, failed = 0, bytes = 0;
  for (const local of files) {
    const rel = path.relative(SRC, local).split(path.sep).join('/');
    const dest = `${PREFIX}/${rel}`;
    try {
      await bucket.upload(local, {
        destination: dest,
        metadata: {
          contentType: CONTENT[path.extname(local).toLowerCase()],
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });
      await bucket.file(dest).makePublic();
      bytes += fs.statSync(local).size;
      done++;
      process.stdout.write(`\r   ${done}/${files.length}  ${rel.padEnd(34).slice(0, 34)}`);
    } catch (e) {
      failed++;
      console.log(`\n   ❌ ${rel}: ${e.message}`);
    }
  }

  const base = `https://storage.googleapis.com/${bucketName}`;
  console.log('\n');
  console.log(`✅ رُفعت ${done} صورة (${(bytes / 1048576).toFixed(1)} MB)` + (failed ? `، فشل ${failed}` : ''));
  console.log('');
  console.log('═'.repeat(58));
  console.log('ضع هذا في: اللوحة ← الإعدادات ← نطاق صور المنيو');
  console.log('');
  console.log('   ' + base);
  console.log('');
  console.log('تجربة: ' + base + '/menu/shawarma/48.jpg');
  console.log('═'.repeat(58));
  process.exit(failed ? 1 : 0);
})();
