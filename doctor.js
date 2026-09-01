#!/usr/bin/env node
/**
 * فحص شامل للبوت الحيّ — يشخّص كل الأعطال المعروفة دفعة واحدة.
 *
 *   node doctor.js https://o2bot.onrender.com
 *   node doctor.js https://o2bot.onrender.com murad كلمة_المرور
 *
 * قراءة فقط — لا يغيّر شيئاً.
 */
'use strict';

const https = require('https');
const http  = require('http');

const BASE = (process.argv[2] || '').replace(/\/+$/, '');
const USER = process.argv[3] || 'murad';
const PASS = process.argv[4] || '';

if (!BASE) {
  console.error('الاستخدام: node doctor.js <رابط-الخدمة> [اسم_المستخدم] [كلمة_المرور]');
  console.error('مثال    : node doctor.js https://o2bot.onrender.com murad O2-admin-2026');
  process.exit(1);
}

let problems = [], warns = [];
const ok   = (m) => console.log('  ✅ ' + m);
const bad  = (m, fix) => { console.log('  ❌ ' + m); if (fix) console.log('     → ' + fix); problems.push(m); };
const warn = (m, fix) => { console.log('  ⚠️  ' + m); if (fix) console.log('     → ' + fix); warns.push(m); };
const head = (t) => console.log('\n════ ' + t + ' ════');

function req(path, { method = 'GET', body = null, cookie = '' } = {}) {
  return new Promise((resolve) => {
    const url = new URL(BASE + path);
    const lib = url.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const t0 = Date.now();
    const r = lib.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      timeout: 90000,   // Render المجاني قد يحتاج دقيقة للاستيقاظ
    }, (res) => {
      let o = '';
      res.on('data', (c) => (o += c));
      res.on('end', () => {
        let parsed = o;
        try { parsed = JSON.parse(o); } catch {}
        resolve({ status: res.statusCode, body: parsed, ms: Date.now() - t0, cookie: res.headers['set-cookie'] });
      });
    });
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, err: 'انتهت المهلة (90 ثانية)' }); });
    r.on('error', (e) => resolve({ status: 0, err: e.message }));
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  console.log('🩺 فحص شامل: ' + BASE);

  /* 1 — هل الخدمة حيّة؟ */
  head('1) الخدمة');
  const ping = await req('/ping');
  if (ping.status === 0) {
    bad('الخدمة لا تستجيب: ' + (ping.err || ''), 'تأكد من الرابط ومن أن Render يعمل');
    console.log('\n⛔ لا يمكن المتابعة.');
    process.exit(1);
  }
  ok(`تستجيب (HTTP ${ping.status}) في ${ping.ms}ms`);
  if (ping.ms > 20000) warn('الاستجابة بطيئة جداً — الخدمة كانت نائمة', 'اضبط RENDER_EXTERNAL_URL لتفعيل النداء الذاتي');

  /* 2 — قاعدة البيانات */
  head('2) قاعدة البيانات');
  const db = (await req('/api/dbstatus')).body || {};
  if (db.ready) ok('Firebase متصل والبيانات محمّلة');
  else {
    bad('البيانات غير محمّلة: ' + (db.short || db.error || 'سبب غير معروف'));
    (db.steps || []).forEach((s) => console.log('     ' + s));
    console.log('     ⚠️ هذا وحده يوقف: الربط، والمنيو، والصور، والبوت كله.');
  }

  /* 3 — الدخول */
  head('3) الدخول');
  let cookie = '';
  if (!PASS) {
    warn('لم تمرّر كلمة مرور — الفحوص التالية محدودة', 'node doctor.js <رابط> murad <كلمة_المرور>');
  } else {
    const lg = await req('/api/auth/login', { method: 'POST', body: { username: USER, password: PASS } });
    if (lg.status === 200 && lg.body.ok) {
      cookie = (lg.cookie || [''])[0].split(';')[0];
      ok(`دخول ناجح: ${lg.body.user.displayName} (${lg.body.user.roleLabel})`);
    } else if (lg.status === 503) {
      bad('الدخول متعذّر — البيانات لم تُحمّل بعد', 'أصلح Firebase أولاً');
    } else {
      bad('فشل الدخول: ' + (lg.body.error || lg.status),
        'استخدم RESET_ADMIN_PASSWORD في Render لاسترجاع كلمة المرور');
    }
  }

  /* 4 — واتساب */
  head('4) اتصال واتساب');
  const link = (await req('/api/bot/link', { cookie })).body || {};
  if (link.connected) {
    ok('البوت مرتبط بواتساب ✅');
  } else {
    const st = link.phaseLabel || 'غير معروف';
    if (!db.ready) bad('غير مرتبط — البوت لا يبدأ لأن البيانات لم تُحمّل');
    else if (link.pairCode) warn('بانتظار إدخال كود الربط: ' + link.pairCode);
    else if (link.qrAvailable) warn('بانتظار مسح رمز QR', BASE + '/link');
    else bad('غير مرتبط — المرحلة: ' + st, BASE + '/link');
  }

  if (cookie) {
    const stt = (await req('/api/status', { cookie })).body || {};
    const w = stt.waStats || {};
    if (w.disconnects) {
      const codes = {};
      (w.history || []).forEach((h) => { codes[h.code] = (codes[h.code] || 0) + 1; });
      console.log('     انقطاعات: ' + w.disconnects + ' | عاد تلقائياً: ' + (w.reconnects || 0));
      Object.entries(codes).forEach(([c, n]) => {
        const hint = c === '440' ? ' ← نفس الرقم مرتبط بجلسة أخرى، أوقف إحداهما'
                   : c === '401' ? ' ← مضت 14 يوماً بلا إنترنت على الهاتف، أعد الربط'
                   : c === '408' ? ' ← الخدمة تنام، اضبط RENDER_EXTERNAL_URL' : '';
        console.log(`     رمز ${c}: ${n} مرة${hint}`);
        if (hint) warns.push('انقطاعات ' + c);
      });
    }
    if (stt.botActive === false) bad('البوت موقوف يدوياً', 'اضغط «تشغيل البوت» في أعلى اللوحة');
  }

  /* 5 — المنيو والصور */
  head('5) المنيو والصور');
  if (!cookie) {
    warn('يتطلب دخولاً');
  } else {
    const st = (await req('/api/state', { cookie })).body || {};
    const cats = st.categories || [];
    const items = st.items || [];
    const base = (st.settings || {}).imageBaseUrl || '';

    cats.length ? ok(`${cats.length} قسم`) : bad('لا أقسام في قاعدة البيانات', 'المنيو لم يُرحَّل — راجع سجل Render');
    const noLabel = cats.filter((c) => !c.label);
    if (noLabel.length) bad(`${noLabel.length} قسم بلا عنوان`, 'حقل label مفقود — أعد الترحيل');

    items.length ? ok(`${items.length} صنف (${items.filter((i) => i.active).length} متوفر)`) : bad('لا أصناف');

    const withImg = items.filter((i) => i.image);
    const absolute = withImg.filter((i) => /^https?:\/\//i.test(i.image)).length;
    const relative = withImg.length - absolute;
    console.log(`     صور: ${withImg.length} (${absolute} رابط كامل، ${relative} مسار نسبي)`);

    const dirty = withImg.filter((i) => !/^https?:\/\//i.test(i.image) && !i.image.startsWith('/menu/') && !i.image.startsWith('/api/img/'));
    if (dirty.length) bad(`${dirty.length} مسار مشوّه مثل: ${dirty[0].image}`, 'أعد نشر أحدث كود — الإصلاح تلقائي عند التحميل');

    if (relative && !base) {
      bad('يوجد مسارات نسبية لكن «نطاق صور المنيو» فارغ',
        'اللوحة ← الإعدادات ← نطاق صور المنيو ← https://o2bot-b7a51.web.app');
    } else if (base) {
      ok('نطاق الصور: ' + base);
      const sample = withImg.find((i) => i.image.startsWith('/menu/'));
      if (sample) {
        const full = base.replace(/\/+$/, '') + sample.image;
        const u = new URL(full);
        const r = await new Promise((res) => {
          const lib = u.protocol === 'https:' ? https : http;
          const q = lib.get(full, (x) => { x.resume(); res({ s: x.statusCode, t: x.headers['content-type'] }); });
          q.on('error', (e) => res({ s: 0, e: e.message }));
          q.setTimeout(15000, () => { q.destroy(); res({ s: 0, e: 'مهلة' }); });
        });
        if (r.s === 200 && /^image\//.test(r.t || '')) ok('صورة نموذجية تُحمَّل: ' + sample.image);
        else bad(`الصورة لا تُحمَّل (${r.s || r.e}): ${full}`, 'نفّذ firebase deploy --only hosting');
      }
    }
  }

  /* 6 — رسائل مُهملة */
  if (cookie) {
    head('6) رسائل لم يرد عليها البوت');
    const dr = (await req('/api/dropped', { cookie })).body || {};
    const list = dr.dropped || [];
    if (!list.length) ok('لا رسائل مُهملة');
    else {
      const by = {};
      list.forEach((x) => { by[x.reason] = (by[x.reason] || 0) + 1; });
      Object.entries(by).forEach(([r, n]) => console.log(`     ${n}× ${r}`));
      const s = dr.settings || {};
      console.log(`     الإعدادات: botActive=${s.botActive} requireTrigger=${s.requireTrigger} browseOnly=${s.browseOnly}`);
      console.log(`     كلمات التفعيل: ${(s.triggerWords || []).join('، ')}`);
    }
  }

  /* الخلاصة */
  head('الخلاصة');
  if (!problems.length && !warns.length) console.log('  ✅ كل شيء سليم');
  else {
    if (problems.length) { console.log(`  ❌ ${problems.length} مشكلة:`); problems.forEach((p) => console.log('     • ' + p)); }
    if (warns.length)    { console.log(`  ⚠️  ${warns.length} تنبيه:`);   warns.forEach((p) => console.log('     • ' + p)); }
    console.log('\n  ابدأ بأول مشكلة — أغلبها متسلسل: إصلاح Firebase يعيد الربط والمنيو والصور معاً.');
  }
  console.log('');
  process.exit(problems.length ? 1 : 0);
})();
