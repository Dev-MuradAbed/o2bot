#!/usr/bin/env node
/**
 * فاحص مفتاح Firebase — يحسم إن كان المفتاح ما زال يعمل أم لا.
 *
 *   node test-firebase.js path/to/key.json
 *   node test-firebase.js                  ← يقرأ FIREBASE_SERVICE_ACCOUNT
 *
 * لا يكتب أي شيء — قراءة فقط.
 */
'use strict';

const fs = require('fs');

function line(c = '─') { console.log(c.repeat(58)); }

(async () => {
  const file = process.argv[2];
  let raw;

  if (file) {
    if (!fs.existsSync(file)) { console.error('❌ الملف غير موجود: ' + file); process.exit(1); }
    raw = fs.readFileSync(file, 'utf8');
    console.log('📄 المصدر: ' + file);
  } else {
    raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      console.error('❌ لا ملف ولا متغيّر FIREBASE_SERVICE_ACCOUNT');
      console.error('   الاستخدام: node test-firebase.js key.json');
      process.exit(1);
    }
    console.log('📄 المصدر: متغيّر البيئة FIREBASE_SERVICE_ACCOUNT');
  }

  let sa;
  try { sa = JSON.parse(raw.trim()); }
  catch (e) { console.error('❌ ليس JSON صالحاً: ' + e.message); process.exit(1); }

  if (typeof sa.private_key === 'string' && sa.private_key.includes('\\n')) {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    console.log('ℹ️  صُحّحت أسطر private_key');
  }

  line();
  console.log('المشروع        : ' + sa.project_id);
  console.log('حساب الخدمة    : ' + sa.client_email);
  console.log('معرّف المفتاح   : ' + (sa.private_key_id || '—'));
  line();

  let admin;
  try {
    const { initializeApp, cert } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    admin = { initializeApp, cert, getFirestore };
  } catch (e) {
    console.error('❌ firebase-admin غير مثبّتة. شغّل: npm install');
    process.exit(1);
  }

  console.log('⏳ محاولة قراءة من Firestore…\n');
  try {
    admin.initializeApp({ credential: admin.cert(sa) });
    const db = admin.getFirestore();
    const snap = await db.collection('o2bot').doc('state').get();

    console.log('✅ المفتاح يعمل — الاتصال ناجح');
    if (snap.exists) {
      const d = snap.data();
      const size = Buffer.byteLength(JSON.stringify(d), 'utf8');
      console.log('✅ مستند البيانات موجود');
      console.log('   الأصناف   : ' + ((d.items || []).length));
      console.log('   الحسابات  : ' + ((d.users || []).map(u => u.username).join('، ') || 'لا يوجد'));
      console.log('   الطلبات   : ' + ((d.orders || []).length));
      console.log('   الحجم     : ' + size.toLocaleString() + ' بايت');
    } else {
      console.log('⚠️ الاتصال ناجح لكن مستند o2bot/state غير موجود (قاعدة فارغة)');
    }
    process.exit(0);
  } catch (e) {
    const msg = String(e.message || e);
    console.error('❌ فشل الاتصال\n');
    if (/not in allowlist|egress|proxy/i.test(msg)) {
      console.error('   السبب: الشبكة على هذا الجهاز تحجب firestore.googleapis.com');
      console.error('   هذه ليست مشكلة في المفتاح — جرّب من شبكة أخرى أو من سجل Render.');
    } else if (/UNAUTHENTICATED|invalid authentication|invalid_grant/i.test(msg)) {
      console.error('   السبب: هذا المفتاح **مُبطَل أو محذوف** من Google Cloud.');
      console.error('   استعادة الملف لا تنفع — المفتاح ميت نهائياً.');
      console.error('');
      console.error('   الحل: Firebase Console ← ⚙️ Project Settings ← Service accounts');
      console.error('        ← Generate new private key ← ضع الجديد في Render');
    } else if (/PERMISSION_DENIED|insufficient permissions/i.test(msg)) {
      console.error('   السبب: المفتاح صالح لكن بلا صلاحية على Firestore.');
      console.error('   الحل: Google Cloud ← IAM ← امنحه دور "Cloud Datastore User"');
    } else if (/NOT_FOUND/i.test(msg)) {
      console.error('   السبب: قاعدة Firestore غير منشأة في هذا المشروع.');
      console.error('   الحل: Firebase Console ← Build ← Firestore Database ← Create');
    } else if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(msg)) {
      console.error('   السبب: لا اتصال بالإنترنت من هذا الجهاز.');
    } else {
      console.error('   ' + msg);
    }
    console.error('');
    console.error('   الرسالة الأصلية: ' + msg.split('\n')[0]);
    process.exit(1);
  }
})();
