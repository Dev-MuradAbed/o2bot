// Baileys — واتساب بدون Chromium
const makeWASocket    = require('@whiskeysockets/baileys').default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const pino   = require('pino');
const https  = require('https');
const auth   = require('./auth');
const menuBuild = require('./menu-build');

// ============================================================
// STATE
// ============================================================
let STATE = {
  settings: {
    name: 'مطعم O2',
    phone: '0567743979',
    location: 'النصيرات — شارع أبو صرار',
    hours: '11 صباحاً - 11 مساءً',
    estimatedTime: 30,
    welcome: 'أهلاً وسهلاً بك في مطعم O2 🌿\nيسعدنا خدمتك! شو بدك اليوم؟',
    // defaultReply: 'هههه مش فاهم قصدك كتير 😄 بدك تطلب ولا بدك تشوف الأسعار؟',
    bankName: 'فادي أبو شرخ',
    bank: 'بنك فلسطين',
    bankPhone: '0567743979',
    iban: 'PS43PALS045411071670993000000',
    transferMode: false,
    botActive: true,
    groupId: '',
    sessionTimeoutMins: 30, // انتهاء الجلسة بعد X دقيقة من آخر رسالة
    // ── تفعيل البوت بكلمة مفتاحية ──
    // true = البوت صامت حتى يرسل الزبون كلمة تفعيل (مناسب للرقم الشخصي)
    // false = البوت يرد على كل رسالة (مناسب لرقم المطعم المخصص)
    requireTrigger: true,
    // browseOnly: البوت لا يفعل شيئاً سوى عرض الأقسام والأصناف المتوفرة.
    // لا ترحيب، لا رد على صنف مفرد، لا طلبات، لا أسئلة عامة.
    browseOnly: true,
    triggerWords: ['bot', 'بوت', 'o2', 'منيو', 'menu'],
    triggerTimeoutMins: 20, // تنتهي حالة التفعيل بعد هذه المدة من الخمول

    // ── طريقة ربط واتساب ──
    // 'qr'   = مسح رمز QR بالكاميرا
    // 'pair' = كود من 8 خانات يُكتب في الهاتف (لا يحتاج كاميرا)
    // ── الفروع ──
    // 'single' = فرع واحد ثابت (activeBranch)
    // 'ask'    = يسأل الزبون عن فرعه أول المحادثة
    branchMode: 'ask',
    activeBranch: 'gaza',
    imageBaseUrl: '',   // مثال: https://o2restaurant.com — يُسبق مسارات الصور النسبية
    showItemDesc: true, // إظهار وصف الصنف تحت اسمه للزبون

    linkMethod: 'qr',
    pairPhone: '', // رقم الواتساب بصيغة دولية أرقام فقط، مثل 970567743979
  },
  deliveryZones: [
    { label: 'النصيرات (مستشفى العودة)', keys: ['العودة', 'مستشفى العودة'], fee: 5 },
    { label: 'النصيرات عام', keys: ['النصيرات'], fee: 10 },
    { label: 'السوارحة والبريج', keys: ['السوارحة', 'البريج'], fee: 15 },
    { label: 'الزوايدة والمغازي', keys: ['الزوايدة', 'المغازي'], fee: 20 },
    { label: 'دير البلح', keys: ['دير البلح'], fee: 35 },
  ],
  // المنيو الرسمي — مبني من menu-source.js (فرعا غزة والأوسط)
  categories: menuBuild.buildCategories(),
  items: menuBuild.buildItems(1000),
  replies: [
    { id:1, keys:['مرحبا','هلا','اهلا','السلام','هاي','hi','hello'], text:'أهلاً وسهلاً! 🌿 شو بدك اليوم؟', active:true },
    { id:2, keys:['منيو','قائمة','اسعار','أسعار'],                   text:'شو بدك تشوف؟ 😊\n1️⃣ الشاورما\n2️⃣ الإيطالي\n3️⃣ الساندويشات\n4️⃣ السلطات\n5️⃣ المشروبات\n6️⃣ الحلويات', active:true },
    { id:3, keys:['دوام','ساعات','مفتوح','متى'],                     text:'احنا مفتوحين من 11 الصبح لـ11 الليل كل أيام الأسبوع 🕛', active:true },
    { id:4, keys:['موقع','عنوان','وين','فين'],                       text:'موجودين في النصيرات — شارع أبو صرار 📍', active:true },
    { id:5, keys:['توصيل','ديليفري','رسوم'],                         text:'رسوم التوصيل 🚚\nالنصيرات (العودة): 5 ₪\nالنصيرات: 10 ₪\nالسوارحة/البريج: 15 ₪\nالزوايدة/المغازي: 20 ₪\ndير البلح: 35 ₪', active:true },
    { id:6, keys:['تحويل','دفع','بنك','حساب'],                       text:'💳 فادي أبو شرخ — بنك فلسطين\nجوال: 0567743979\nIBAN: PS43PALS045411071670993000000', active:true },
    { id:7, keys:['شكرا','شكراً','يسلمو','ممتاز','مشكور'],           text:'يسلمو! نتشرف فيك دايماً ❤️', active:true },
    { id:8, keys:['موظف','بشري','شخص','انسان'],                      text:'تمام! سيتواصل معك أحد موظفينا قريباً 👨‍💼', active:true },
  ],
  orders: [],
  queue: [],
  logs: [],
  nextId: 2000,
  nextOrderNum: 10001,
  botConnected: false,
  customerProfiles: {}, // بيانات الزبائن المتكررين
  learnedAliases: {},   // تعلّم تراكمي
  pendingOrders: {},    // طلبات معلقة لم يُكمل التحويل
  dailyCounter: { date: '', seq: 0 }, // ترقيم يومي

  // ── الديلفري ──────────────────────────────────────────────
  drivers: [
    // zones: مناطق مسؤوليته الأساسية (مطابق لـ deliveryZones[].label)
    // shift: 'morning'(6-15) | 'evening'(15-24) | 'both'
    // maxActive: أقصى عدد طلبات في نفس الوقت
    { id:1, name:'أحمد',  phone:'', shift:'both',    zones:[], maxActive:3, active:true,  ordersToday:0, currentOrders:[] },
    { id:2, name:'محمد',  phone:'', shift:'morning', zones:[], maxActive:3, active:false, ordersToday:0, currentOrders:[] },
    { id:3, name:'خالد',  phone:'', shift:'evening', zones:[], maxActive:3, active:false, ordersToday:0, currentOrders:[] },
  ],
  driverDailyDate: '', // تاريخ آخر reset للعدادات

  deletedItemIds: [], // شواهد الحذف — تمنع عودة صنف حذفه المستخدم

  // ── الحسابات وسجل التغييرات ──
  users: [],   // تُنشأ تلقائياً عند أول تشغيل (auth.init)
  audit: [],   // من غيّر ماذا ومتى
};

// ============================================================
// PERSISTENCE — Firebase Firestore
// ============================================================
const { initializeApp, cert }  = require('firebase-admin/app');
const { getFirestore }         = require('firebase-admin/firestore');

// قراءة Service Account من متغير البيئة
let STATE_DOC;
let IMG_COL;              // مجموعة الصور المرفوعة من الجهاز
let FB_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';   // لاستنتاج نطاق الصور
if (!FB_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT) {
  try { FB_PROJECT_ID = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT).project_id || ''; }
  catch { /* يُفحص لاحقاً في parseServiceAccount */ }
}

/** مخزن صور في الذاكرة لأوضاع الاختبار */
function memImageCollection() {
  const mem = new Map();
  return {
    doc(id) {
      return {
        id,
        async set(d) { mem.set(id, d); },
        async get() { return { exists: mem.has(id), id, data: () => mem.get(id) }; },
        async delete() { mem.delete(id); },
      };
    },
  };
}

if (process.env.O2_TEST_MODE === 'failread') {
  // وضع اختبار: يفشل أول قراءة لمحاكاة انقطاع لحظي مع Firebase
  STATE_DOC = {
    async set(d){ global.__FAKE_DB.doc = JSON.parse(JSON.stringify(d)); },
    async get(){
      global.__FAKE_DB.gets++;
      if (global.__FAKE_DB.failAlways) throw new Error(global.__FAKE_DB.errMsg || 'UNAVAILABLE: الخدمة غير متاحة');
      if (global.__FAKE_DB.failNextGet) {
        global.__FAKE_DB.failNextGet = false;
        throw new Error('DEADLINE_EXCEEDED: فشل اتصال لحظي');
      }
      return { exists: !!global.__FAKE_DB.doc, data: () => global.__FAKE_DB.doc };
    },
  };
  IMG_COL = memImageCollection();
  console.log('🧪 وضع اختبار فشل القراءة');
} else if (process.env.O2_TEST_MODE === 'persist') {
  // وضع اختبار يبقي المستند بين إعادات التشغيل (global)
  STATE_DOC = {
    async set(d){ global.__FAKE_DB.doc = JSON.parse(JSON.stringify(d)); },
    async get(){ return { exists: !!global.__FAKE_DB.doc, data: () => global.__FAKE_DB.doc }; },
  };
  IMG_COL = memImageCollection();
  console.log('🧪 وضع اختبار الاستمرارية');
} else if (process.env.O2_TEST_MODE === '1') {
  let mem = null;
  STATE_DOC = { async set(d){ mem = JSON.parse(JSON.stringify(d)); }, async get(){ return { exists: !!mem, data: () => mem }; } };
  IMG_COL = memImageCollection();
  console.log('🧪 وضع الاختبار: Firebase معطّل');
} else {
  const sa = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
  FB_PROJECT_ID = sa.project_id;
  console.log(`🔑 مفتاح Firebase: ${sa.client_email}`);
  console.log(`   المشروع: ${sa.project_id}`);
  initializeApp({ credential: cert(sa) });
  const _db = getFirestore();
  STATE_DOC = _db.collection('o2bot').doc('state');
  IMG_COL   = _db.collection('o2bot_images');   // صورة لكل مستند
}

/**
 * يفحص مفتاح الخدمة قبل استخدامه ويشرح الخطأ بدقة.
 * أغلب مشاكل الاتصال بـ Firebase سببها هذا المتغيّر لا الشبكة.
 */
function parseServiceAccount(raw) {
  const die = (title, ...hints) => {
    console.error('');
    console.error('❌ ' + title);
    hints.forEach(h => console.error('   ' + h));
    console.error('');
    process.exit(1);
  };

  if (!raw || !raw.trim()) {
    die('متغيّر FIREBASE_SERVICE_ACCOUNT غير موجود',
        'Render ← Environment ← أضف FIREBASE_SERVICE_ACCOUNT',
        'قيمته: محتوى ملف JSON الذي نزّلته من Firebase كاملاً');
  }

  let sa;
  try {
    sa = JSON.parse(raw.trim());
  } catch (e) {
    die('محتوى FIREBASE_SERVICE_ACCOUNT ليس JSON صالحاً: ' + e.message,
        'انسخ الملف كاملاً من { حتى } دون حذف أو إضافة',
        'لا تضع علامات اقتباس حول المحتوى كله');
  }

  for (const f of ['project_id', 'client_email', 'private_key']) {
    if (!sa[f]) die(`مفتاح الخدمة ناقص الحقل "${f}"`, 'نزّل ملفاً جديداً من Firebase ← Project Settings ← Service accounts');
  }

  // بعض لوحات الاستضافة تحوّل أسطر المفتاح إلى \n نصية — نصلحها
  if (typeof sa.private_key === 'string' && sa.private_key.includes('\\n')) {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    console.log('ℹ️  صُحّحت أسطر private_key تلقائياً');
  }
  if (!/^-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(sa.private_key.trim())) {
    die('حقل private_key تالف',
        'يجب أن يبدأ بـ -----BEGIN PRIVATE KEY-----',
        'أعد نسخ ملف JSON كاملاً من Firebase');
  }
  return sa;
}

/** يترجم أخطاء Firebase إلى سبب وحل واضحين */
function explainFirebaseError(msg) {
  const m = String(msg || '');
  if (/UNAUTHENTICATED|invalid authentication|invalid_grant/i.test(m)) {
    return {
      fatal: true,
      short: 'مفتاح Firebase غير صالح أو مُبطَل',
      steps: [
        'غالباً حذفت المفتاح القديم من Google Cloud ولم تضع الجديد في Render.',
        '1) Firebase Console ← ⚙️ Project Settings ← Service accounts',
        '2) Generate new private key ← نزّل ملف JSON',
        '3) Render ← Environment ← FIREBASE_SERVICE_ACCOUNT ← الصق محتواه كاملاً',
        '4) Save Changes — تُعاد الخدمة تلقائياً',
      ],
    };
  }
  if (/PERMISSION_DENIED|Missing or insufficient permissions/i.test(m)) {
    return {
      fatal: true,
      short: 'المفتاح صالح لكن لا يملك صلاحية على Firestore',
      steps: [
        'Google Cloud ← IAM ← امنح حساب الخدمة دور "Cloud Datastore User"',
        'أو تأكد أن قواعد Firestore ليست في وضع production مغلق',
      ],
    };
  }
  if (/NOT_FOUND|database.*does not exist/i.test(m)) {
    return {
      fatal: true,
      short: 'قاعدة Firestore غير موجودة في هذا المشروع',
      steps: ['Firebase Console ← Build ← Firestore Database ← Create database'],
    };
  }
  return { fatal: false, short: 'انقطاع مؤقت في الاتصال بـ Firebase', steps: ['ستستمر إعادة المحاولة تلقائياً'] };
}

// debounce — لا نكتب لـ Firebase أكثر من مرة كل 3 ثواني
let saveTimer = null;
// ══════════════════════════════════════════════════════════
// قفل أمان: لا كتابة على Firebase قبل قراءة ناجحة مؤكَّدة.
// بدونه، أي فشل قراءة لحظي يجعل الخدمة تعمل بالبيانات
// الافتراضية ثم تكتبها فوق قاعدتك — فيضيع المنيو وكلمات المرور.
// ══════════════════════════════════════════════════════════
let stateLoaded = false;
let loadError   = '';
let migrationPending = false;

function saveState() {
  if (!stateLoaded) { console.log('⛔ حفظ مرفوض: البيانات لم تُحمَّل بعد'); return; }
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try { await STATE_DOC.set(STATE); }
    catch(e) { console.log('⚠️ Firebase save:', e.message); }
  }, 3000);
}

async function saveStateNow() {
  if (!stateLoaded) { console.log('⛔ حفظ مرفوض: البيانات لم تُحمَّل بعد'); return false; }
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try { await STATE_DOC.set(STATE); return true; }
  catch(e) { console.log('⚠️ Firebase saveNow:', e.message); return false; }
}

/** يكتب أي حفظ مؤجّل فوراً — يُستدعى عند إيقاف الخدمة */
async function flushState() {
  if (!stateLoaded || !saveTimer) return;
  clearTimeout(saveTimer); saveTimer = null;
  try { await STATE_DOC.set(STATE); console.log('💾 حُفظت البيانات قبل الإغلاق'); }
  catch(e) { console.log('⚠️ فشل الحفظ قبل الإغلاق:', e.message); }
}

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => { await flushState(); process.exit(0); });
}

async function loadState() {
  try {
    const snap = await STATE_DOC.get();
    if (!snap.exists) {
      console.log('📝 Firebase: أول تشغيل — حفظ البيانات الافتراضية');
      stateLoaded = true;              // القراءة نجحت والمستند غير موجود فعلاً
      await saveStateNow();
      return true;
    }
    const saved = snap.data();
    STATE.settings     = { ...STATE.settings, ...(saved.settings || {}) };
    STATE.orders       = saved.orders    || [];
    STATE.queue        = saved.queue     || [];
    STATE.logs         = (saved.logs     || []).slice(-200);
    STATE.nextId       = saved.nextId    || STATE.nextId;
    STATE.nextOrderNum = saved.nextOrderNum || STATE.nextOrderNum;
    STATE.botConnected = false;
    if (saved.drivers)          STATE.drivers          = saved.drivers;
    if (saved.driverDailyDate)  STATE.driverDailyDate  = saved.driverDailyDate;
    if (saved.customerProfiles) STATE.customerProfiles = saved.customerProfiles;
    if (saved.pendingOrders)    STATE.pendingOrders    = saved.pendingOrders;
    if (saved.dailyCounter)     STATE.dailyCounter     = saved.dailyCounter;
    if (saved.unknowns)         STATE.unknowns         = saved.unknowns;
    if (saved.runtimeAliases)   STATE.runtimeAliases   = saved.runtimeAliases;
    if (saved.learnedAliases)   STATE.learnedAliases   = saved.learnedAliases;
    if (saved.users && saved.users.length) STATE.users = saved.users;
    if (saved.audit)                       STATE.audit = saved.audit;
    if (saved.categories    && saved.categories.length)    STATE.categories    = saved.categories;
    if (saved.replies       && saved.replies.length)       STATE.replies       = saved.replies;
    if (saved.deliveryZones && saved.deliveryZones.length) STATE.deliveryZones = saved.deliveryZones;
    // ── دمج المنيو ──────────────────────────────────────────
    // المحفوظ هو المرجع دائماً. المقارنة بعدد أصناف الكود كانت
    // ترمي القائمة كاملة بمجرد حذف صنف واحد، فتعود كل الأصناف
    // مُفعّلة وتضيع كل حالات الإغلاق.
    STATE.deletedItemIds = Array.isArray(saved.deletedItemIds) ? saved.deletedItemIds : [];
    if (saved.items && saved.items.length) {
      const codeItems = STATE.items;                 // النسخة الافتراضية من الكود
      STATE.items = saved.items;                     // المحفوظ يفوز
      const haveIds  = new Set(STATE.items.map(i => i.id));
      const gone     = new Set(STATE.deletedItemIds);
      // أضف فقط أصناف الكود الجديدة التي لم تُحفظ ولم تُحذف يدوياً
      const fresh = codeItems.filter(i => !haveIds.has(i.id) && !gone.has(i.id));
      if (fresh.length) {
        STATE.items.push(...fresh);
        console.log(`➕ ${fresh.length} صنف جديد من الكود أُضيف للمنيو`);
      }
      const closed = STATE.items.filter(i => !i.active).length;
      console.log(`✅ Firebase: ${STATE.items.length} صنف محمّل (${closed} مغلق)`);
    }
    // ══ ترحيل المنيو إلى بيانات الفروع الرسمية (مرة واحدة) ══
    if (saved.menuVersion !== menuBuild.MENU_VERSION) {
      const oldCount = STATE.items.length;
      STATE.itemsBackup = { at: new Date().toISOString(), version: saved.menuVersion || 'legacy', items: STATE.items };
      STATE.categories  = menuBuild.buildCategories();
      STATE.items       = menuBuild.buildItems(1000);
      STATE.menuVersion = menuBuild.MENU_VERSION;
      STATE.nextId      = Math.max(STATE.nextId || 100, 1000 + STATE.items.length + 50);
      STATE.deletedItemIds = [];
      const g = STATE.items.filter(i => i.branch === 'gaza').length;
      const m = STATE.items.filter(i => i.branch === 'middle').length;
      console.log(`🔄 ترحيل المنيو: ${oldCount} صنف قديم ← ${STATE.items.length} صنف (غزة ${g} / الأوسط ${m})`);
      console.log('   النسخة القديمة محفوظة في itemsBackup');
      migrationPending = true;
    }

    // ══ إصلاح مسارات الصور المحفوظة ══
    // بعض النسخ حفظت المسار كـ public/menu/… بدل /menu/… فيصير الرابط
    // https://…/public/menu/… ويرجع 404. الإصلاح آمن ويتكرر بلا ضرر.
    let fixedImgs = 0;
    for (const it of STATE.items) {
      if (!it.image || /^https?:\/\//i.test(it.image)) continue;
      const m = String(it.image).match(/\/?menu\/.*$/i);
      const clean = m ? '/' + m[0].replace(/^\/+/, '') : it.image;
      if (clean !== it.image) { it.image = clean; fixedImgs++; }
    }
    if (fixedImgs) {
      console.log(`🖼️  صُحّح ${fixedImgs} مسار صورة (public/menu/… ← /menu/…)`);
      migrationPending = true;
    }

    console.log('✅ Firebase: state محمّل (' + STATE.orders.length + ' طلب)');
    stateLoaded = true;
    loadError = '';
    return true;
  } catch(e) {
    loadError = e.message;
    console.log('⚠️ Firebase loadState:', e.message);
    return false;
  }
}

/**
 * يحاول التحميل عدة مرات قبل الاستسلام، ولا يفتح قفل الكتابة إلا بنجاح.
 * إن فشل الكل: الخدمة تبقى تعمل للاطلاع، الكتابة مقفلة، والبوت لا يبدأ،
 * ومحاولات إعادة التحميل تستمر في الخلفية.
 */
async function loadStateWithRetry(attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    if (await loadState()) return true;
    if (i < attempts) {
      const delay = Math.min(1000 * 2 ** i, 15000);
      console.log(`🔁 إعادة محاولة تحميل البيانات (${i}/${attempts}) بعد ${delay / 1000} ثانية…`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  const why = explainFirebaseError(loadError);
  console.error('');
  console.error('❌❌❌ تعذّر تحميل البيانات من Firebase بعد ' + attempts + ' محاولات');
  console.error('   ' + why.short);
  why.steps.forEach(x => console.error('   ' + x));
  console.error('   الخطأ الأصلي: ' + loadError);
  console.error('   ⛔ الكتابة مقفلة والبوت متوقف حتى لا تُمحى بياناتك.');
  if (why.fatal) console.error('   ⚠️ هذا الخطأ لا يُصلحه الانتظار — يحتاج تدخلك.');
  console.error('');
  const timer = setInterval(async () => {
    if (await loadState()) {
      clearInterval(timer);
      console.log('✅ نجح التحميل — الكتابة مفتوحة الآن');
      auth.init(STATE, saveState);
      if (!waSocket) startBaileys();
    }
  }, 30000);
  timer.unref?.();
  return false;
}

// ترقيم يومي: يبدأ من 1 كل يوم جديد
function getNextOrderNum() {
  const today = new Date().toLocaleDateString('ar-SA', {year:'numeric',month:'2-digit',day:'2-digit'});
  if (!STATE.dailyCounter || STATE.dailyCounter.date !== today) {
    STATE.dailyCounter = { date: today, seq: 1 };
  } else {
    STATE.dailyCounter.seq++;
  }
  saveState();
  return STATE.dailyCounter.seq;
}

function addLog(msg) {
  STATE.logs.unshift({ msg, time: new Date().toLocaleTimeString('ar') });
  if (STATE.logs.length > 200) STATE.logs.pop();
  saveState();
}

// ============================================================
// PENDING ORDERS — طلبات لم يُكمَل تحويلها
// ============================================================
const PENDING_TTL = 3 * 60 * 60 * 1000; // 3 ساعات

function savePendingOrder(from, orderData) {
  if (!STATE.pendingOrders) STATE.pendingOrders = {};
  STATE.pendingOrders[from] = { ...orderData, savedAt: Date.now() };
  saveState();
}

function getPendingOrder(from) {
  const po = STATE.pendingOrders?.[from];
  if (!po) return null;
  if (Date.now() - po.savedAt > PENDING_TTL) {
    delete STATE.pendingOrders[from];
    saveState();
    return null;
  }
  return po;
}

function clearPendingOrder(from) {
  if (STATE.pendingOrders?.[from]) {
    delete STATE.pendingOrders[from];
    saveState();
  }
}

function pendingOrderSummary(po) {
  const items = (po.cart || []).map(i => `• ${i.qty}x ${i.name} — ${i.qty * i.price} ₪`).join('\n');
  const delivery = po.deliveryType === 'توصيل'
    ? `🚚 توصيل إلى: ${po.address} (${po.deliveryFee} ₪)`
    : `🏪 استلام من المطعم`;
  const grand = (po.cart || []).reduce((s,i) => s + i.qty*i.price, 0) + (po.deliveryFee || 0);
  return `${items}\n${delivery}\nالمجموع: *${grand} ₪*`;
}

// ============================================================
// SESSIONS — في الذاكرة فقط (تنمحي عند restart وهذا مقصود)
// ============================================================
const sessions = {};
const pendingPayments = {}; // msgId -> { orderNum, customerPhone, name }

// بيانات الزبائن المتكررين (مستمرة في state.json)
function saveCustomerProfile(from, data) {
  if (!STATE.customerProfiles) STATE.customerProfiles = {};
  STATE.customerProfiles[from] = {
    ...(STATE.customerProfiles[from] || {}),
    ...data,
    lastSeen: new Date().toLocaleDateString('ar'),
  };
  saveState();
}

function getCustomerProfile(from) {
  return STATE.customerProfiles?.[from] || null;
}

function makeSession(from) {
  return {
    state: null, cart: [], name: '', phone: '', address: '',
    deliveryType: '', deliveryFee: 0, pendingItem: null, pendingQty: 1,
    orderNum: null, paymentType: null, transferName: null, from,
    note: '', lastActivity: Date.now(),
    // سياق المحادثة — يساعد البوت يفهم الرسائل القصيرة
    lastCategory: null,  // آخر قسم ذُكر (شاورما/حلويات/مشروبات)
    lastItem: null,      // آخر صنف ذُكر (كنافة/جيلاتو/بيتزا)
    history: [],         // آخر 5 رسائل للسياق
    browseList: [],      // أصناف القسم المعروض حالياً — للاختيار بالرقم
  };
}

function getSession(from) {
  if (!sessions[from]) sessions[from] = makeSession(from);
  return sessions[from];
}

function resetSession(from) {
  sessions[from] = makeSession(from);
  return sessions[from];
}

// تنظيف الجلسات المنتهية كل 10 دقائق
setInterval(() => {
  const timeoutMs = (STATE.settings.sessionTimeoutMins || 30) * 60 * 1000;
  const now = Date.now();
  for (const from of Object.keys(sessions)) {
    if (now - sessions[from].lastActivity > timeoutMs) {
      delete sessions[from];
    }
  }
}, 10 * 60 * 1000);

// تنظيف الطلبات المعلقة المنتهية كل ساعة
setInterval(() => {
  if (!STATE.pendingOrders) return;
  const now = Date.now();
  let cleaned = 0;
  for (const phone of Object.keys(STATE.pendingOrders)) {
    if (now - STATE.pendingOrders[phone].savedAt > PENDING_TTL) {
      delete STATE.pendingOrders[phone];
      cleaned++;
    }
  }
  if (cleaned > 0) saveState();
}, 60 * 60 * 1000);

// ملاحظة: كانت هنا دالة scheduleReconnect قديمة تشير إلى `client`
// (بقايا whatsapp-web.js) وتحجب نسخة Baileys الصحيحة. حُذفت.
// ============================================================
// قاموس الأعداد والمساعدات
// ============================================================
const ARABIC_NUMS = {
  'واحد':1,'واحدة':1,'وحدة':1,'وحده':1,'واحده':1,'١':1,
  'اثنين':2,'اثنتين':2,'اثنان':2,'اتنين':2,'تنتين':2,'٢':2,
  'ثلاثة':3,'ثلاثه':3,'ثلاث':3,'تلاتة':3,'تلاته':3,'تلات':3,'٣':3,
  'اربعة':4,'أربعة':4,'اربعه':4,'اربع':4,'أربع':4,'٤':4,
  'خمسة':5,'خمسه':5,'خمس':5,'٥':5,
  'ستة':6,'سته':6,'ست':6,'٦':6,
  'سبعة':7,'سبعه':7,'سبع':7,'٧':7,
  'ثمانية':8,'تمانية':8,'ثمان':8,'٨':8,
  'تسعة':9,'تسعه':9,'تسع':9,'٩':9,
  'عشرة':10,'عشره':10,'عشر':10,'١٠':10,
};

function arabicToEnglishNumbers(str) {
  return str.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - '٠'.charCodeAt(0)));
}

function extractQty(text) {
  const normalized = arabicToEnglishNumbers(text);
  const n = normalized.match(/^(\d+)/);
  if (n) return Math.min(parseInt(n[1]), 99); // max 99
  for (const [w, num] of Object.entries(ARABIC_NUMS)) {
    if (text.toLowerCase().includes(w)) return num;
  }
  return 1;
}

function extractItemName(text) {
  let c = text.replace(/^\d+\s*x?\s*/i, '').trim();
  c = c.replace(/\s*ب\s*\d+\s*$/i, '').trim();
  c = c.replace(/^\d+\s*$/, '').trim();
  for (const w of Object.keys(ARABIC_NUMS)) {
    const r = new RegExp(`^${w}\\s+`, 'i');
    if (r.test(c)) { c = c.replace(r, '').trim(); break; }
  }
  c = c.replace(/^(بدي|عايز|اريد|أريد|خذلي|حطلي|اضيفلي|زودني|اضيف|شيل|شيلو|شيلي|بدل|بدلو)\s+/i, '').trim();
  return c;
}

const SPELLING_FIX = {
  'شاورمه':'شاورما','شاورمة':'شاورما',
  'زنقر':'زنجر','زنكر':'زنجر','زينجر':'زنجر',
  'كاليزوني':'كالزوني','كلزوني':'كالزوني',
  'بيتزه':'بيتزا','بيتزة':'بيتزا',
  'برقر':'برجر','بورقر':'برجر',
  'شيش طاوق':'شيش طاووق',
  'فطيره':'فطيرة','فطيره ذهبيه':'فطيرة ذهبية',
  'بانسيه':'بانسية',
  'ملك شيك':'ميلك شيك',
  'كريبة':'كريب','كريبه':'كريب',
  'كنافه':'كنافة','كنافه نابلسيه':'كنافة نابلسية',
  'نابلسيه':'نابلسية',
  'بقلاوه':'بقلاوة',
  'نسكفيه':'نسكافيه',
  'موتلن':'مولتن','مولتون':'مولتن',
  'وافله':'وافل','وافلة':'وافل',
  'لقيمه':'لقيمات','لقيمة':'لقيمات',
  'بانكيك':'بان كيك','باين كيك':'بان كيك',
  'ايس كافيه':'آيس كافي','ايس كافي':'آيس كافي',
  'جيلاتوه':'جيلاتو',
  'موهيطو':'موهيتو',
  'فراشيح':'فرشوحة','فراشيح شاورما':'بيتا شاورما',
  'فرشوحه':'فرشوحة',
  'كوكا كولا':'كولا كبير',
  'كولسلو':'كول سلو','كولسلاو':'كول سلو',
  'بيكانتو':'بيكانتي','بيكانتى':'بيكانتي',
  'ميجا':'ميجا شاورما',
  'سبريت':'سبرايت',
};

const EN_TO_AR = {
  'hello':'مرحبا','hi':'مرحبا','hey':'مرحبا','salam':'مرحبا',
  'menu':'منيو','prices':'اسعار','order':'طلب','delivery':'توصيل','location':'موقع',
  'hours':'ساعات','open':'مفتوح','cancel':'الغاء',
  'thanks':'شكرا','thank you':'شكرا','ok':'تمام','yes':'نعم','no':'لا',
  'shawarma':'شاورما','pizza':'بيتزا','burger':'برجر','sandwich':'ساندويش',
  'juice':'عصير','coffee':'قهوة','tea':'شاي','cake':'كيك',
  'dessert':'حلويات','salad':'سلطة','ice coffee':'آيس كافي',
  'transfer':'تحويل','payment':'دفع','confirm':'تأكيد','add':'اضيف',
  'nutella':'نوتيلا','lotus':'لوتس','waffle':'وافل','crepe':'كريب',
  'pancake':'بان كيك','milkshake':'ميلك شيك','mojito':'موهيتو',
  'gelato':'جيلاتو','baklava':'بقلاوة','kunafa':'كنافة',
};

function translateEN(text) {
  let t = text.toLowerCase();
  const sorted = Object.entries(EN_TO_AR).sort((a,b) => b[0].length - a[0].length);
  for (const [en, ar] of sorted) t = t.replace(new RegExp('\\b' + en + '\\b', 'gi'), ar);
  return t;
}

function fixSpelling(text) {
  let t = text;
  const sorted = Object.entries(SPELLING_FIX).sort((a,b) => b[0].length - a[0].length);
  for (const [wrong, right] of sorted) t = t.replace(new RegExp(wrong, 'gi'), right);
  return t;
}

// ============================================================
// FUZZY SEARCH
// ============================================================
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({length: m+1}, (_, i) =>
    Array.from({length: n+1}, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i=1; i<=m; i++)
    for (let j=1; j<=n; j++)
      dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function normalize(s) { return s.toLowerCase().replace(/[هة]/g, 'ه').trim(); }

// ============================================================
// ITEM ALIASES — من محادثات الزبائن الحقيقية
// ============================================================
// ============================================================
// INGREDIENTS MAP — مكونات/نكهات يبحث عنها الزبون
// ============================================================
const INGREDIENT_MAP = {
  // فواكه ونكهات
  'بلوبري':   ['ميلك شيك سبيشل','لقيمات نوتيلا','آيس كافي كراميل'],
  'فراولة':   ['ميلك شيك سبيشل','وافل سنيك'],
  'مانجو':    ['ميلك شيك سبيشل','عصير الموسم'],
  'نوتيلا':   ['كنافة نوتيلا','بان كيك نوتيلا','آيس كافي نوتيلا','لقيمات نوتيلا'],
  'لوتس':     ['جيلاتو لوتس','بان كيك لوتس','لقيمات لوتس'],
  'كراميل':   ['آيس كافي كراميل','ميلك شيك سبيشل'],
  'شوكولا':   ['مولتن كيك','تشيز كيك','ميلك شيك سبيشل'],
  'شوكولاتة': ['مولتن كيك','تشيز كيك'],
  // مكونات الشاورما
  'لحمة':     ['فرشوحة دبل لحمة','فرشوحة دبل دبل','سوري'],
  'دجاج':     ['فرشوحة عادي','فرشوحة دبل','صفيحة','شاورما عربي','بيتزا مكسيكي دجاج','تشيكن برجر','شيش طاووق','ستيك دجاج مشوي','بانسية'],
  'جبن':      ['بيتزا مكسيكي دجاج','مارغريتا','نابولي','بيتزا ماما روزا'],
  'خضار':     ['بيتزا خضار وذرة','كالزوني خضار'],
  // مشروبات
  'قهوة':     ['كابتشينو','نسكافيه','إسبريسو سنجل','إسبريسو دبل','قهوة تركي سنجل','آيس كافي كراميل'],
  'حليب':     ['كابتشينو','ميلك شيك سبيشل','آيس كافي كراميل'],
  'ليمون':    ['عصير ليمون ونعناع','موهيتو'],
  'نعناع':    ['عصير ليمون ونعناع','موهيتو'],
  'أفوكادو':  ['عصير أفوكاتو'],
  'افوكادو':  ['عصير أفوكاتو'],
};

// البحث عن ingredient في الأصناف
function findByIngredient(query) {
  const q = normalize(query);
  // 1. فحص INGREDIENT_MAP
  for (const [ing, itemNames] of Object.entries(INGREDIENT_MAP)) {
    if (normalize(ing) === q || q.includes(normalize(ing)) || normalize(ing).includes(q)) {
      const items = itemNames
        .map(name => STATE.items.find(i => normalize(i.name) === normalize(name) && i.active))
        .filter(Boolean);
      if (items.length) return { ingredient: ing, items };
    }
  }
  // 2. بحث في أسماء الأصناف نفسها
  const matchedItems = STATE.items.filter(i =>
    i.active && (
      normalize(i.name).includes(q) ||
      i.keys.some(k => normalize(k).includes(q))
    )
  );
  if (matchedItems.length) return { ingredient: query, items: matchedItems };
  return null;
}

// ============================================================
// ITEM_ALIASES — قاموس شامل من محادثات حقيقية
// كل صنف مع كل طرق كتابته باللهجة الفلسطينية
// ============================================================
const ITEM_ALIASES = {

  // ── فرشوحة ───────────────────────────────────────────────
  'فراشيح':'فرشوحة عادي','فراشيح عادية':'فرشوحة عادي',
  'فراشيح عادي':'فرشوحة عادي','فرشوحات':'فرشوحة عادي',
  'فرشوحه':'فرشوحة عادي',

  'دبل':'فرشوحة دبل','فرشوحة دبله':'فرشوحة دبل',
  'فرشوحات دبل':'فرشوحة دبل',

  'دوبل لحمة':'فرشوحة دبل لحمة','دبل لحمة':'فرشوحة دبل لحمة',
  'دبل لحم':'فرشوحة دبل لحمة','فرشوحه دبل لحمة':'فرشوحة دبل لحمة',
  'فراشيح دبل لحمة':'فرشوحة دبل لحمة','فراشيح دوبل لحمة':'فرشوحة دبل لحمة',

  'دبل دبل':'فرشوحة دبل دبل','دوبل دوبل':'فرشوحة دبل دبل',

  'فراشيح شاورما':'فرشوحة شاورما','فرشوحه شاورما':'فرشوحة شاورما',

  // ── شاورما ────────────────────────────────────────────────
  'صحن':'صحن شاورما','الصحن':'صحن شاورما',
  'شاورما عادي':'صحن شاورما','شاورما صحن':'صحن شاورما',
  'صحن شاورما ب ٣٠':'صحن شاورما','صحن شاورما ب 30':'صحن شاورما',

  'شاورما سوري':'سوري','السوري':'سوري',

  'شاورما عربي':'شاورما عربي','العربي':'شاورما عربي','عربي':'شاورما عربي',

  'شاورما ايطالي':'شاورما إيطالي','ايطالي شاورما':'شاورما إيطالي',

  'صفيحه':'صفيحة','صفايح':'صفيحة','الصفيحة':'صفيحة',

  'بيتا':'بيتا شاورما','فراشيح شاورما':'بيتا شاورما',

  'ميجا':'ميجا شاورما','الميجا':'ميجا شاورما',

  // ── إيطالي ────────────────────────────────────────────────
  'كلزوني':'كالزوني دجاج','الكلزوني':'كالزوني دجاج',
  'كاليزوني':'كالزوني دجاج','كالزوني':'كالزوني دجاج',
  'كلزوني دجاج':'كالزوني دجاج','الكالزوني':'كالزوني دجاج',

  'كلزوني خضار':'كالزوني خضار','كاليزوني خضار':'كالزوني خضار',

  'مكسيكي':'بيتزا مكسيكي دجاج','تشكن بيتزا':'بيتزا مكسيكي دجاج',
  'تشيكن بيتزا':'بيتزا مكسيكي دجاج','بيتزا تشكن':'بيتزا مكسيكي دجاج',
  'بيتزا دجاج':'بيتزا مكسيكي دجاج','دجاج بيتزا':'بيتزا مكسيكي دجاج',

  'ماما':'بيتزا ماما روزا','ماما روزا':'بيتزا ماما روزا',

  'بيتزا خضار':'بيتزا خضار وذرة','خضار وذرة':'بيتزا خضار وذرة',

  'مرغريتا':'مارغريتا',

  'صوص':'علبة صوص إكسترا','علبة صوص':'علبة صوص إكسترا',
  'اكسترا صوص':'علبة صوص إكسترا','صوص اكسترا':'علبة صوص إكسترا',

  // ── ساندويش ───────────────────────────────────────────────
  'الصاروخ':'ستيك دجاج مشوي','صاروخ':'ستيك دجاج مشوي',
  'ستيك دجاج':'ستيك دجاج مشوي','ستيك مشوي':'ستيك دجاج مشوي',

  'زينجر':'زنجر','الزنجر':'زنجر',
  'الزنجر العادي':'زنجر','زنجر عادي':'زنجر',

  'بيغ زنجر':'بيج زنجر','بيج زنقر':'بيج زنجر',

  'بيغ ماك':'بيج ماك','البيج ماك':'بيج ماك',

  'وقية شيش':'شيش طاووق','الشيش':'شيش طاووق',
  'شيش دجاج':'شيش طاووق','شيش طاوق':'شيش طاووق',

  'بيف':'بيف برجر','برجر بيف':'بيف برجر',

  'تشيكن':'تشيكن برجر','تشكن':'تشيكن برجر',
  'تشكن برجر':'تشيكن برجر','دجاج برجر':'تشيكن برجر',
  'برجر دجاج':'تشيكن برجر',

  'بانسيه':'بانسية','بانيه':'بانسية','دجاج بانيه':'بانسية',

  'فطيره':'فطيرة ذهبية','الفطيرة':'فطيرة ذهبية',
  'فطيرة':'فطيرة ذهبية',

  // ── سلطة ──────────────────────────────────────────────────
  'بطاطا':'بطاطا كبير','الشيبس':'بطاطا كبير',
  'شيبس بطاطس':'بطاطا كبير','علبة بطاطا':'بطاطا كبير',
  'علب بطاطا':'بطاطا كبير','صحن بطاطا':'بطاطا كبير',

  'سلطة مشكلة':'سلطات وسط','صحن سلطه مشكل':'سلطات وسط',
  'سلطه':'سلطات وسط',

  'كولسلو':'كول سلو','كولسلاو':'كول سلو',

  'ذره':'ذرة بمايونيز','ذرة مايونيز':'ذرة بمايونيز',
  'سلطة ذرة':'ذرة بمايونيز','الذرة':'ذرة بمايونيز',

  'بيكانتي':'بيكانتي','بيكانتو':'بيكانتي','بيكانتى':'بيكانتي',

  // ── مشروبات ───────────────────────────────────────────────
  'ايس كافي':'آيس كافي كراميل','آيس كافي':'آيس كافي كراميل',
  'ايس كوفي':'آيس كافي كراميل','ايس كافيه':'آيس كافي كراميل',
  'كافي كراميل':'آيس كافي كراميل',

  'كافي نوتيلا':'آيس كافي نوتيلا','ايس كافي نوتيلا':'آيس كافي نوتيلا',

  'نسكفيه':'نسكافيه','ناسكافيه':'نسكافيه',

  'اسبريسو':'إسبريسو سنجل','اسبريسو سنجل':'إسبريسو سنجل',
  'اسبريسو دبل':'إسبريسو دبل',

  'تركي':'قهوة تركي سنجل','قهوة تركي':'قهوة تركي سنجل',
  'تركي دبل':'قهوة تركي دبل',

  'كوكا':'كولا كبير','كوكاكولا':'كولا كبير','كوكا كولا':'كولا كبير',
  'كولا':'كولا كبير',

  'سبريت':'سبرايت',

  'ملك شيك':'ميلك شيك سبيشل','ملكشيك':'ميلك شيك سبيشل',
  'ميلك شيك':'ميلك شيك سبيشل',

  'موهيطو':'موهيتو',

  'ليمون':'عصير ليمون ونعناع','ليمون نعناع':'عصير ليمون ونعناع',

  'افوكاتو':'عصير أفوكاتو','أفوكادو':'عصير أفوكاتو',

  'موسم':'عصير الموسم','عصير موسم':'عصير الموسم',

  // ── حلويات ────────────────────────────────────────────────
  'كنافه نوتيلا':'كنافة نوتيلا',
  'كنافه دبي':'كنافة دبي',
  'كنافه عربية':'كنافة عربية','كنافه عربيه':'كنافة عربية',
  'كنافه نابلسية':'كنافة نابلسية','نابلسيه':'كنافة نابلسية',
  'نابلسية':'كنافة نابلسية',

  'مولتن':'مولتن كيك','موتلن':'مولتن كيك',

  'وافله':'وافل سنيك','وافلة':'وافل سنيك','الوافل':'وافل سنيك',

  'كريبة دبي':'كريب دبي','كريبه دبي':'كريب دبي',

  'تشيزكيك':'تشيز كيك','تشيز':'تشيز كيك',

  'لوتس':'جيلاتو لوتس','الجيلاتو':'جيلاتو لوتس',

  'بقلاوه لوز':'بقلاوة لوز',

  'بانكيك نوتيلا':'بان كيك نوتيلا','بانكيك':'بان كيك نوتيلا',
  'بان كيك':'بان كيك نوتيلا','pancake':'بان كيك نوتيلا',

  'بانكيك لوتس':'بان كيك لوتس',

  'لقيمه نوتيلا':'لقيمات نوتيلا','لقيمة نوتيلا':'لقيمات نوتيلا',
  'لقيمات':'لقيمات نوتيلا',

  'لقيمه لوتس':'لقيمات لوتس','لقيمة لوتس':'لقيمات لوتس',
};

function findItem(query, onlyActive = false) {
  // فحص ITEM_ALIASES + runtimeAliases أولاً
  const rawQ = (query||'').trim();
  const allAliases = {...ITEM_ALIASES,...(STATE.runtimeAliases||{})};
  for (const [alias,target] of Object.entries(allAliases)) {
    if (normalize(rawQ).includes(normalize(alias))||normalize(alias).includes(normalize(rawQ))) {
      query = target; break;
    }
  }
  const q = normalize(arabicToEnglishNumbers(query || ''));
  if (!q || q.length < 2) return null;

  const pool = onlyActive
    ? STATE.items.filter(i => i.active && STATE.categories.find(c => c.id===i.cat && c.active))
    : STATE.items;

  // 1. مطابقة تامة أولاً
  for (const item of pool) {
    for (const k of item.keys) {
      if (q === normalize(k)) return item;
    }
  }
  // 2. الـ query يحتوي الـ key (الصنف داخل الرسالة)
  for (const item of pool) {
    for (const k of item.keys) {
      const kn = normalize(k);
      if (kn.length >= 3 && q.includes(kn)) return item;
    }
  }
  // 3. الـ key يحتوي الـ query — نفضّل الأقصر (الأدق)
  let containsBest = null, containsLen = Infinity;
  for (const item of pool) {
    for (const k of item.keys) {
      const kn = normalize(k);
      if (kn.includes(q) && kn.length < containsLen) {
        containsLen = kn.length; containsBest = item;
      }
    }
  }
  if (containsBest) return containsBest;

  // 3.5. مطابقة متعددة الكلمات — يجب أن تتشارك أغلب الكلمات
  // "تشكن فرايز" vs "تشكن بيتزا" → كلمة مشتركة من 2 = 50% فقط → ❌
  // "بيتزا مكسيكي" vs "بيتزا مكسيكي دجاج" → كلمتان من 2 = 100% → ✅
  const qWords = q.split(' ').filter(w => w.length >= 3);
  if (qWords.length >= 2) {
    let multiMatch = null, multiScore = 0;
    for (const item of pool) {
      for (const k of item.keys) {
        const knWords = normalize(k).split(' ').filter(w => w.length >= 3);
        if (!knWords.length) continue;
        // عدد الكلمات المشتركة
        let shared = 0;
        for (const qw of qWords) {
          if (knWords.some(kw => kw === qw || levenshtein(qw, kw) <= 1)) shared++;
        }
        // نسبة التطابق = مشترك / إجمالي كلمات الـ query
        const ratio = shared / qWords.length;
        // يجب أن تتطابق على الأقل 60% من كلمات الـ query
        if (ratio >= 0.6 && ratio > multiScore) {
          multiScore = ratio;
          multiMatch = item;
        }
      }
    }
    if (multiMatch) return multiMatch;
  }

  // 2. levenshtein — شروط صارمة تمنع التطابق الخاطئ
  let best = null, bestScore = Infinity;
  for (const item of pool) {
    for (const k of item.keys) {
      const kn = normalize(k);

      // ✅ شرط الفرق في الطول — مهم جداً
      // "كولا" (4) vs "كالزوني" (7) = فرق 3 → لا يُقارَن
      const lenDiff = Math.abs(q.length - kn.length);
      if (lenDiff > Math.min(q.length, kn.length) * 0.5) continue;

      // ✅ شرط الحد الأدنى للطول — كلمات أقل من 3 حروف لا تُطابَق بـ levenshtein
      if (q.length < 3 || kn.length < 3) continue;

      // ✅ threshold صارم: أقصر الكلمة تحدد الـ threshold
      const minLen = Math.min(q.length, kn.length);
      const threshold = minLen <= 3 ? 0   // كلمات قصيرة: مطابقة تامة فقط
                      : minLen <= 5 ? 1   // كلمات متوسطة: خطأ واحد فقط
                      : minLen <= 8 ? 2   // كلمات طويلة: خطآن
                      : 3;               // كلمات طويلة جداً

      const dist = levenshtein(q, kn);

      // ✅ شرط إضافي: يجب أن يبدأا بنفس الحرف أو الحرفين (يمنع تطابق الكلمات غير المترابطة)
      if (dist > 0 && q[0] !== kn[0]) continue;

      if (dist <= threshold && dist < bestScore) { bestScore = dist; best = item; }

      // مطابقة كلمة واحدة — فقط إذا الـ query كلمة واحدة
      // "ستيك" (كلمة واحدة) → ستيك دجاج مشوي ✅
      // "تشكن فرايز" (كلمتان) → لا يطابق بكلمة واحدة من الـ key ❌
      const qWords = q.split(' ');
      if (qWords.length === 1) { // فقط لما الـ query كلمة واحدة
        for (const w of kn.split(' ')) {
          if (w.length < 4) continue;
          const wd = levenshtein(qWords[0], w);
          if (wd > 0 && qWords[0][0] !== w[0]) continue;
          const wLen = Math.min(qWords[0].length, w.length);
          const wThreshold = wLen <= 4 ? 0 : wLen <= 6 ? 1 : 2;
          if (wd <= wThreshold && wd < bestScore) { bestScore = wd; best = item; }
        }
      }
    }
  }
  return best;
}

function findSimilarItems(query, preferCat=null, limit=3) {
  const q = normalize(query);
  const active = STATE.items.filter(i => i.active && STATE.categories.find(c => c.id===i.cat && c.active));
  return active
    .map(item => {
      let score = 999;
      for (const k of item.keys) {
        const kn = normalize(k);
        score = Math.min(score, levenshtein(q, kn));
        for (const w of kn.split(' '))
          if (w.length >= 3) score = Math.min(score, levenshtein(q.split(' ')[0]||q, w));
      }
      if (preferCat && item.cat === preferCat) score -= 5;
      return { item, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(s => s.item);
}

// ============================================================
// CART HELPERS
// ============================================================
function cartTotal(c) { return c.reduce((s, i) => s + i.qty * i.price, 0); }
function cartText(c)  { return c.map(i => `• ${i.qty}x ${i.name} — ${i.qty * i.price} ₪`).join('\n'); }

function addToCart(session, item, qty) {
  const ex = session.cart.find(c => c.name === item.name);
  if (ex) ex.qty += qty;
  else session.cart.push({ id: item.id, name: item.name, price: item.price, qty });
  // تتبع السياق
  session.lastItem = item.name;
  if (item.cat) session.lastCategory = item.cat;
}

function removeFromCart(session, itemName) {
  const n = normalize(itemName);
  session.cart = session.cart.filter(c => !normalize(c.name).includes(n) && !n.includes(normalize(c.name)));
}

// ============================================================
// ORDER PERSISTENCE
// ============================================================
function saveOrder(session, status = 'pending_payment') {
  const now = new Date();
  const dateKey = now.toLocaleDateString('ar-SA', {year:'numeric',month:'2-digit',day:'2-digit'});
  const order = {
    id: session.orderNum,
    dateKey,
    customerPhone: session.from,
    name: session.name,
    phone: session.phone,
    items: session.cart.map(i => ({...i})),
    total: cartTotal(session.cart),
    deliveryFee: session.deliveryFee,
    grandTotal: cartTotal(session.cart) + session.deliveryFee,
    deliveryType: session.deliveryType,
    address: session.address || '',
    paymentType: session.paymentType || '',
    transferName: session.transferName || '',
    note: session.note || '',
    status,
    time: new Date().toLocaleString('ar'),
    timestamp: Date.now(),
  };
  const idx = STATE.orders.findIndex(o => o.id === session.orderNum);
  if (idx >= 0) STATE.orders[idx] = order;
  else STATE.orders.unshift(order);
  if (STATE.orders.length > 500) STATE.orders = STATE.orders.slice(0, 500);
  // احفظ بيانات الزبون للمرات القادمة
  if (session.name && session.phone) {
    saveCustomerProfile(session.from, {
      name: session.name,
      phone: session.phone,
      address: session.address || '',
      deliveryType: session.deliveryType,
      deliveryFee: session.deliveryFee,
    });
  }
  saveState();
  return order;
}

// ============================================================
// SMART DELIVERY ASSIGNMENT
// نظام التعيين التلقائي الذكي للديلفري
// ============================================================

function getCurrentShift() {
  const h = new Date().getHours();
  return (h >= 6 && h < 15) ? 'morning' : 'evening';
}

// reset يومي تلقائي منتصف الليل
setInterval(() => {
  const today = new Date().toLocaleDateString('ar-SA');
  if (STATE.driverDailyDate !== today) {
    STATE.driverDailyDate = today;
    (STATE.drivers || []).forEach(d => { d.ordersToday = 0; d.currentOrders = []; });
    saveState();
    addLog('🔄 reset عدادات الديلفري');
  }
}, 60000);

// استخراج المنطقة من عنوان الطلب
function detectZone(address) {
  if (!address) return null;
  const lower = address.toLowerCase();
  for (const z of STATE.deliveryZones) {
    if (z.keys.some(k => lower.includes(k.toLowerCase()))) return z.label;
  }
  return null;
}

// ─── الخوارزمية الرئيسية ────────────────────────────────────
// ترجع { driver, reason, score, warning }
function selectDriver(order) {
  const shift   = getCurrentShift();
  const zone    = detectZone(order.address || '');
  const grandTotal = order.grandTotal || 0;
  const isBigOrder = grandTotal >= 100; // طلب ضخم

  const active = (STATE.drivers || []).filter(d => d.active);
  if (!active.length) return { driver: null, reason: 'لا يوجد سائق متاح', warning: 'no_driver' };

  // ── تقييم كل سائق ──
  const scored = active.map(d => {
    let score   = 0;
    let flags   = [];

    // 1. الفترة — أهم معيار (40 نقطة)
    const rightShift = d.shift === shift || d.shift === 'both';
    if (rightShift) score += 40;
    else flags.push('wrong_shift');

    // 2. المنطقة (30 نقطة)
    const coversZone = !zone || !d.zones?.length || d.zones.includes(zone);
    if (coversZone && zone && d.zones?.includes(zone)) score += 30; // يغطي تحديداً
    else if (coversZone && !d.zones?.length) score += 20;           // يغطي الكل
    else if (!coversZone) flags.push('wrong_zone');

    // 3. العبء الحالي (20 نقطة — أقل أفضل)
    const active_orders = d.currentOrders?.length || 0;
    const maxA = d.maxActive || 3;
    if (active_orders === 0)        score += 20;
    else if (active_orders < maxA)  score += Math.round(20 * (1 - active_orders/maxA));
    else { score -= 20; flags.push('overloaded'); } // تجاوز الحد

    // 4. عدالة توزيع اليوم (10 نقطة — أقل طلبات اليوم = أحسن)
    const maxToday = Math.max(...active.map(x => x.ordersToday || 0), 1);
    score += Math.round(10 * (1 - (d.ordersToday || 0) / (maxToday + 1)));

    return { driver: d, score, flags, active_orders, rightShift, coversZone, isBigOrder };
  });

  // ── فرز: نقاط أعلى أولاً ──
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  // ── توليد السبب والتحذيرات ──
  let reason = '';
  let warning = null;

  if (best.flags.includes('overloaded')) {
    reason  = `${best.driver.name} مشغول (${best.active_orders} طلب) — أفضل المتاحين`;
    warning = 'overloaded';
  } else if (best.flags.includes('wrong_zone') && !best.flags.includes('wrong_shift')) {
    reason  = `${best.driver.name} — منطقته مختلفة لكن الأقرب متاحاً`;
    warning = 'wrong_zone';
  } else if (best.flags.includes('wrong_shift')) {
    reason  = `${best.driver.name} — من فترة مختلفة (لا يوجد سائق من فترة ${shift === 'morning' ? 'الصباح' : 'المساء'})`;
    warning = 'wrong_shift';
  } else {
    const parts = [];
    if (best.rightShift)   parts.push(`فترة ${shift === 'morning' ? 'صباحية' : 'مسائية'}`);
    if (best.coversZone && zone) parts.push(`يغطي ${zone}`);
    if (best.active_orders === 0) parts.push('متفرغ');
    reason = `${best.driver.name} — ${parts.join('، ')}`;
  }

  // تحذير إضافي: طلب ضخم
  if (isBigOrder && !warning) warning = 'big_order';

  return { driver: best.driver, score: best.score, reason, warning, scored };
}

// تطبيق التعيين على الطلب
function applyDriverAssignment(order, driver) {
  if (!driver) return;
  if (!driver.currentOrders) driver.currentOrders = [];
  driver.currentOrders.push(order.id);
  driver.ordersToday = (driver.ordersToday || 0) + 1;
  order.driverId    = driver.id;
  order.driverName  = driver.name;
  order.assignedAt  = Date.now();
  saveState();
  addLog(`🚗 #${order.id} → ${driver.name} (${driver.currentOrders.length} نشط، ${driver.ordersToday} اليوم)`);
}

function releaseDriver(orderId) {
  (STATE.drivers || []).forEach(d => {
    if (d.currentOrders) d.currentOrders = d.currentOrders.filter(id => id !== orderId);
  });
  saveState();
}

// ============================================================
// LEARNING SYSTEM — نظام التعلم التلقائي
// ============================================================
// ============================================================
// GROQ AI — فهم الرسائل الصعبة (مجاني على groq.com)
// ============================================================
// الإعداد: Render → Environment → GROQ_API_KEY = gsk_xxxx
const GROQ_KEY = process.env.GROQ_API_KEY || '';

// نظام التعلم التراكمي
// كل alias مؤقت يحتاج N تأكيد قبل يصير دائم
const CONFIRM_THRESHOLD = 3; // عدد مرات الاستخدام قبل يصير alias دائم

// سجّل استخدام alias مؤقت وارفعه للدائم إذا وصل العتبة
// كلمات لا تُتعلّم أبداً كـ alias
const LEARN_BLACKLIST = new Set([
  'نعم','آه','اه','ايوه','أيوه','yes','يلا','ماشي','حاضر','تمام','اوكي','ok','صح','صحيح',
  'مزبوط','زبط','انعم','حلو','موافق','اضيف','ضيفه','اطلبه','خذلي','بدي',
  'لا','لأ','لاء','no','بلاش','مش','مو','ما','مش بدي','ما بدي',
  'تأكيد','تاكيد','خلص','كفاية','ارسل','ابعت','send','يلا ارسل',
  'الغاء','إلغاء','كنسل','بطل','وقف',
  'شكرا','شكراً','يسلمو','مشكور','تسلم',
  'مرحبا','هلا','سلام','صباح','مساء','كيف','اهلا',
]);

function learnAlias(rawMsg, itemName) {
  const rawNorm = normalize(rawMsg);
  if (!rawMsg || rawMsg.length < 2 || rawMsg.length > 50) return;

  // لا تتعلم كلمات التأكيد والتحيات والردود العامة
  if (LEARN_BLACKLIST.has(rawNorm)) return;
  // لا تتعلم كلمة أقل من 3 أحرف (تا، لا، آه...)
  if (rawNorm.length < 3) return;
  // لا تتعلم إذا الكلمة هي isYes/isNo/isConfirm
  const isGenericResponse = /^(نعم|آه|اه|اوك|ok|تمام|يلا|ايوه|ماشي|حاضر|لا|لأ|no|بلاش|مزبوط|صح|صحيح|تأكيد|خلص)$/i.test(rawMsg);
  if (isGenericResponse) return;

  // إذا موجود بالفعل في القاموس الثابت → تجاهل
  const item = STATE.items.find(i => normalize(i.name) === normalize(itemName));
  if (!item) return;
  const alreadyPermanent = item.keys.some(k => normalize(k) === rawNorm);
  if (alreadyPermanent) return;

  // سجّل في learnedAliases (عداد الاستخدام)
  if (!STATE.learnedAliases) STATE.learnedAliases = {};
  const key = rawNorm + '→' + normalize(itemName);
  const entry = STATE.learnedAliases[key] || { raw:rawMsg, itemId:item.id, itemName, count:0, permanent:false };
  entry.count++;
  entry.lastSeen = new Date().toLocaleString('ar');
  STATE.learnedAliases[key] = entry;

  // وصل العتبة → أضف للقاموس الدائم
  if (entry.count >= CONFIRM_THRESHOLD && !entry.permanent) {
    item.keys.push(rawMsg);
    if (!STATE.runtimeAliases) STATE.runtimeAliases = {};
    STATE.runtimeAliases[rawNorm] = itemName;
    entry.permanent = true;
    addLog('📚 تعلّم دائم (' + entry.count + 'x): "' + rawMsg + '" → ' + itemName);
  } else if (entry.count === 1) {
    // أضف كـ runtimeAlias مؤقت فوراً (يشتغل لكن مش في item.keys)
    if (!STATE.runtimeAliases) STATE.runtimeAliases = {};
    STATE.runtimeAliases[rawNorm] = itemName;
    addLog('🤖 AI تعلّم مؤقت: "' + rawMsg + '" → ' + itemName);
  }
  saveState();
}

async function askGroq(systemPrompt, userMsg) {
  if (!GROQ_KEY) return null;
  try {
    const res = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        // llama-3.3-70b أقوى بالعربية وأفهم للسياق — مجاني على Groq
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMsg },
        ],
        max_tokens: 120,
        temperature: 0.0, // 0 = أكثر دقة وثبات
      });
      const req = https.request({
        hostname: 'api.groq.com',
        path:     '/openai/v1/chat/completions',
        method:   'POST',
        headers:  {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
      }, r => {
        let data = '';
        r.on('data', d => data += d);
        r.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    return res.choices?.[0]?.message?.content?.trim() || null;
  } catch(e) {
    console.log('⚠️ Groq:', e.message);
    return null;
  }
}

// يبني قائمة الأصناف للـ AI
function buildItemsList() {
  return STATE.items
    .filter(i => i.active)
    .map(i => `${i.name} (${i.price}₪) — قسم: ${i.cat}`)
    .join('\n');
}

// يحاول يفهم الرسالة بـ AI
async function tryAIUnderstand(from, rawMsg, session) {
  const itemsList = buildItemsList();
  const cartInfo  = session?.cart?.length
    ? `السلة الحالية: ${session.cart.map(i=>`${i.qty}x ${i.name}`).join(', ')}`
    : 'السلة فارغة';

  // سياق المحادثة — آخر 5 رسائل
  const historyText = (session?.history || [])
    .slice(-5)
    .map(h => h.text)
    .join(' → ');
  const contextInfo = session?.lastItem
    ? `آخر صنف ذُكر: ${session.lastItem}` + (session?.lastCategory ? ` (قسم: ${session.lastCategory})` : '')
    : '';

  // قائمة مختصرة
  const itemsShort = STATE.items.filter(i=>i.active).map(i=>i.name).join('، ');

  const systemPrompt = `أنت مساعد طلبات مطعم ${STATE.settings.name} في غزة.
الزبائن يكتبون بلهجة فلسطينية وعامية.

الأصناف المتاحة: ${itemsShort}

${cartInfo}

أجب بأمر واحد فقط:
ORDER:اسم_الصنف:الكمية  ← طلب صنف من القائمة بالاسم الدقيق
PRICE:اسم_الصنف          ← سؤال عن سعر
REMOVE:اسم_الصنف         ← حذف من السلة
CONFIRM                  ← تأكيد (تمام/يلا/ماشي/مزبوط/خلص/حاضر)
CANCEL                   ← إلغاء
MENU_CAT:اسم_القسم       ← عرض منيو قسم (شاورما/ايطالي/ساندويش/سلطة/مشروبات/حلويات)
ADD_NOTE:النص            ← ملاحظة (بدون بصل/بس طحينه/زيادة ثلج)
GREETING                 ← تحية أو كلام اجتماعي فقط
SKIP                     ← لا علاقة بالطلب
UNKNOWN                  ← ما فهمت

قواعد:
• الصنف غير موجود في القائمة → UNKNOWN لا ORDER
• تحيات + طلب معاً → ORDER (تجاهل التحية)
• أسماء شعبية: صاروخ=ستيك دجاج مشوي، كلزوني=كالزوني دجاج، دبل لحمة=فرشوحة دبل لحمة، وقية شيش=شيش طاووق
• كميات: واحد/وحدة=1، اثنين/2=2، ثلاثة/3=3
• إذا الرسالة نكهة/مكون فقط (مثل "بلوبري" أو "لوتس") وآخر صنف ذُكر واضح → ادمجهم: ORDER:اسم_الصنف_الكامل:1
• سطر واحد فقط بدون شرح`;

  // أضف السياق للرسالة
  const fullMsg = (contextInfo ? contextInfo + '\n' : '')
    + (historyText ? 'المحادثة: ' + historyText + '\n' : '')
    + 'الرسالة الأخيرة: ' + rawMsg;

  const aiResponse = await askGroq(systemPrompt, fullMsg);
  if (!aiResponse) return null;

  console.log(`🤖 Groq: "${rawMsg}" → "${aiResponse}"`);

  // تعلّم تلقائياً من إجابة AI
  if (aiResponse.startsWith('ORDER:')) {
    const parts    = aiResponse.split(':');
    const itemName = parts[1]?.trim();
    const qty      = parseInt(parts[2]) || 1;
    const item     = STATE.items.find(i => normalize(i.name) === normalize(itemName || ''));

    if (item && item.active) {
      const rawNorm = normalize(rawMsg);
      const alreadyKnown = item.keys.some(k => normalize(k) === rawNorm);

      // تعلّم تراكمي
      learnAlias(rawMsg, item.name);
      const unkEntry = (STATE.unknowns||[]).find(u => u.raw === rawMsg);
      if (unkEntry) { unkEntry.status = 'added'; unkEntry.aiLearned = true; }

      // اسأل للتأكيد فقط إذا جديد كلياً ومختلف كثيراً
      const hasTemp = !!(STATE.runtimeAliases?.[rawNorm]);
      const similarity = levenshtein(rawNorm, normalize(item.name));
      const needsConfirm = !alreadyKnown && !hasTemp && similarity > 5;

      if (needsConfirm) {
        if (!session) return null;
        session.state = 'pending_item'; session.pendingItem = item; session.pendingQty = qty;
        return `${item.name} — *${item.price} ₪* 😊\n\nبدك تطلبه؟ (نعم / لا)`;
      }

      if (!session.cart) session.cart = [];
      addToCart(session, item, qty); saveState();
      return `${rand(WAIT_MSGS)} أضفت ${qty}x ${item.name} ✅\n${cartText(session.cart)}\nالمجموع: ${cartTotal(session.cart)} ₪\n\n${rand(CONFIRM_MSGS)}`;
    }
  }

  if (aiResponse.startsWith('PRICE:')) {
    const itemName = aiResponse.split(':')[1]?.trim();
    const item = STATE.items.find(i => normalize(i.name) === normalize(itemName || ''));
    if (item) {
      session.state       = 'pending_item';
      session.pendingItem = item;
      session.pendingQty  = 1;
      return `${item.name} — *${item.price} ₪*\n\nبدك تطلبه؟ (نعم / لا)`;
    }
  }

  if (aiResponse === 'CONFIRM') {
    // معالجة التأكيد
    if (session.cart?.length) {
      session.state = 'delivery_type';
      return `ممتاز! 😊\nكيف بدك تستلم طلبك؟\n1️⃣ توصيل للمنزل 🚚\n2️⃣ استلام من المطعم 🏪`;
    }
  }

  if (aiResponse === 'REMOVE:' || aiResponse.startsWith('REMOVE:')) {
    const itemName = aiResponse.split(':')[1]?.trim();
    if (itemName && session.cart?.length) {
      const idx = session.cart.findIndex(i => normalize(i.name) === normalize(itemName));
      if (idx !== -1) {
        const removed = session.cart.splice(idx, 1)[0];
        return `تمام، حذفت ${removed.name} ✅\n${session.cart.length ? cartText(session.cart) + '\nالمجموع: ' + cartTotal(session.cart) + ' ₪' : 'السلة فاضية'}`;
      }
    }
  }

  if (aiResponse.startsWith('MENU_CAT:')) {
    const catName = aiResponse.split(':')[1]?.trim();
    if (catName && STATE.categories.find(c => c.id === catName && c.active)) {
      return getMenuText(catName) + '\n\nقولي شو بدك تطلب 😊';
    }
  }

  if (aiResponse === 'SKIP') return null;

  if (aiResponse === 'GREETING') {
    // تحية بدون طلب → رد لطيف
    return `أهلاً وسهلاً! 😊 شو بدك تطلب اليوم من ${STATE.settings.name}؟ 🌿`;
  }

  if (aiResponse.startsWith('ADD_NOTE:')) {
    const note = aiResponse.slice(9).trim();
    if (note && session) {
      if (!session.notes) session.notes = [];
      session.notes.push(note);
      saveState();
      return `تمام، لاحظت: "${note}" ✅
شو كمان بدك؟`;
    }
  }

  // UNKNOWN
  return null;
}

// ============================================================
// LEARNING SYSTEM
// ============================================================
function logUnknown(from, rawMsg, ctx={}) {
  if (!rawMsg||rawMsg.length<2) return;
  // لا تسجّل التحيات والثرثرة الاجتماعية
  const t = normalize(rawMsg);
  const isSocial = /^(مرحبا|هلا|سلام|كيف حالك|كيف الحال|شو اخبارك|كيفك|صباح|مساء|يسلمو|شكرا|تمام|اوكي|مزبوط)/.test(t);
  if (isSocial && rawMsg.length < 25) return;
  if (!STATE.unknowns) STATE.unknowns=[];
  const ex = STATE.unknowns.find(u=>u.raw===rawMsg);
  if (ex) { ex.count=(ex.count||1)+1; ex.lastSeen=new Date().toLocaleString('ar'); }
  else STATE.unknowns.push({raw:rawMsg,from:from.slice(-6),count:1,
    firstSeen:new Date().toLocaleString('ar'),lastSeen:new Date().toLocaleString('ar'),
    context:{state:ctx.state||null,cartItems:ctx.cartItems||0},suggested:null,status:'new'});
  if (STATE.unknowns.length>500) STATE.unknowns=STATE.unknowns.slice(-500);
  analyzeUnknown(rawMsg); saveState();
}

function analyzeUnknown(rawMsg) {
  const entry=(STATE.unknowns||[]).find(u=>u.raw===rawMsg);
  if (!entry||entry.suggested||entry.status!=='new') return;
  const q=normalize(rawMsg);

  // 1. هل يشبه اسم قسم؟
  const catResult = detectCategoryQuery(rawMsg);
  if (catResult) {
    entry.suggested = {
      type: 'category',
      catId: catResult,
      confidence: 'high',
      hint: `"${rawMsg}" → يعني قسم "${catResult}" — سيُعرض المنيو تلقائياً`,
    };
    // أضف للـ CAT_KEYWORDS تلقائياً
    if (!CAT_KEYWORDS[catResult].includes(rawMsg)) {
      CAT_KEYWORDS[catResult].push(rawMsg);
      // وأضف للـ runtimeAliases
      if (!STATE.runtimeAliases) STATE.runtimeAliases = {};
      STATE.runtimeAliases['__cat__' + rawMsg] = catResult;
      addLog(`📚 تعلّم قسم: "${rawMsg}" → ${catResult}`);
      saveState();
    }
    return;
  }

  // 2. هل يشبه اسم صنف؟ (levenshtein)
  for (const item of STATE.items) {
    for (const key of item.keys) {
      const d=levenshtein(q,normalize(key));
      if (d<=2&&d>0) {
        entry.suggested={type:'alias',targetItem:item.name,targetId:item.id,
          confidence:d===1?'high':'medium',hint:`"${rawMsg}" → قريب من "${key}" في ${item.name}`};
        return;
      }
    }
  }

  // 3. هل يحتوي اسم صنف؟ (contains)
  for (const item of STATE.items) {
    for (const key of item.keys) {
      const kn = normalize(key);
      if (q.includes(kn) || kn.includes(q)) {
        entry.suggested={type:'alias',targetItem:item.name,targetId:item.id,
          confidence:'medium',hint:`"${rawMsg}" يحتوي "${item.name}"`};
        return;
      }
    }
  }
}

// ============================================================
// CHAT ANALYZER — تحليل تصدير واتساب
// ============================================================
function analyzeChatExport(rawText) {
  const aD={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
  const toN = s=>s.replace(/[٠-٩]/g,d=>aD[d]||d);
  const LINE_RX=/^[\d٠-٩‏\u200f\/،,\s:]+[صمءٌٍ]?\s*-\s*(.+?):\s*(.*)$/u;
  const msgs=[]; let cur=null;
  for (const ln of rawText.split('\n')) {
    const line=ln.trim();
    if (!line||line.includes('<تم استبعاد')) continue;
    const m=LINE_RX.exec(line);
    if (m) { if(cur)msgs.push(cur); cur={sender:m[1].trim(),text:m[2].trim()}; }
    else if (cur) cur.text+='\n'+line;
  }
  if(cur)msgs.push(cur);
  const cnt={}; msgs.forEach(m=>{cnt[m.sender]=(cnt[m.sender]||0)+1;});
  const sorted=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);
  const rest=sorted[0]?.[0]?.includes('Rest')||sorted[0]?.[0]?.includes('O2')?sorted[0][0]:sorted[1]?.[0]||null;
  const custMsgs=msgs.filter(m=>m.sender!==rest);
  const QTY=/^(\d+)\s*[xX×]?\s*(.+)$/;
  const aliasMap={}, unknMap={}, statMap={};
  for (const msg of custMsgs) {
    for (const line of msg.text.split('\n')) {
      const l=toN(line.trim()).replace(/\s*(بدون|بس|فقط)\s*.+/gi,'').trim();
      const m=QTY.exec(l); if(!m)continue;
      const qty=parseInt(m[1]); const name=m[2].trim();
      if(qty<1||qty>99||name.length<2)continue;
      const key=normalize(name);
      if(!statMap[key])statMap[key]={name,count:0};
      statMap[key].count+=qty;
      let found=null;
      for(const item of STATE.items){for(const k of item.keys){const kn=normalize(k);if(kn===key||kn.includes(key)||key.includes(kn)){found=item;break;}}if(found)break;}
      if(found){const already=found.keys.some(k=>normalize(k)===key);if(!already){if(!aliasMap[key])aliasMap[key]={alias:name,itemId:found.id,itemName:found.name,type:'contains',count:0};aliasMap[key].count+=qty;}}
      else{if(!unknMap[key])unknMap[key]={name,count:0};unknMap[key].count+=qty;}
    }
  }
  return {
    stats:{totalMessages:msgs.length,customerMessages:custMsgs.length,restaurantSender:rest||'—'},
    aliases:Object.values(aliasMap).sort((a,b)=>b.count-a.count),
    unknownItems:Object.values(unknMap).sort((a,b)=>b.count-a.count),
    topItems:Object.values(statMap).sort((a,b)=>b.count-a.count).slice(0,20),
  };
}

// ============================================================
// MENU
// ============================================================
function getMenuText(cat) {
  const items = STATE.items.filter(i => i.cat === cat && i.active);
  if (!items.length) return 'هاد القسم مش متوفر الحين 😅';
  const label = (STATE.categories.find(c => c.id === cat) || {}).label
    || (({ شاورما:'🥙', ايطالي:'🍕', ساندويش:'🍔', سلطة:'🥗', مشروبات:'☕', حلويات:'🍰' })[cat] || '🍽️') + ' ' + cat;
  const width = items.reduce((m, i) => Math.max(m, [...i.name].length), 0);
  return [
    `${label}   _(${items.length} صنف)_`,
    '━━━━━━━━━━━━━━━',
    ...items.map(i => itemLine(i, width)),
    '━━━━━━━━━━━━━━━',
  ].join('\n');
}

// ── كلمات كل قسم ──────────────────────────────────────────
const CAT_KEYWORDS = {
  'شاورما':  [
    'شاورما','الشاورما','شاورمه','الشاورمه','شورما',
    'فرشوحة','فرشوحه','فراشيح','فراشيح','صفيحة','صفيحه','صفايح',
    'صحن شاورما','بيتا شاورما','باشكا','ميجا',
  ],
  'ايطالي':  [
    'بيتزا','بيتزه','البيتزا','بيتزات','بيتزة',
    'ايطالي','إيطالي','الايطالي','إيطالية','ايطالية',
    'كالزوني','كالزوني','كلزوني','الكلزوني','كاليزوني',
    'نابولي','مارغريتا','مرغريتا',
  ],
  'ساندويش': [
    'ساندويش','ساندويشات','ساندوتش','ساندوتشات','ساندويشه',
    'برجر','برغر','البرجر','برجرات',
    'شيش','شيش طاووق','ستيك',
    'باربكيو','بانسية','باريه','بانيه',
    'فطيرة','فطيره',
  ],
  'سلطة':    [
    'سلطة','سلطه','سلطات','سلطات',
    'بطاطا','شيبس',
    'كول سلو','كولسلو',
    'بيكانتي','ذرة','ذره',
  ],
  'مشروبات': [
    'مشروبات','مشروب','مشروبه',
    'قهوة','قهوه','قهوه',
    'كافي','كوفي','ايس كافي','آيس كافي','ايس كوفي',
    'كابتشينو','اسبريسو','اسبريسو','نسكافيه',
    'عصير','عصائر','ليمون','موهيتو','ميلك شيك',
    'كولا','كوكاكولا','بيبسي','سبرايت','ميرندا',
    'شاي',
  ],
  'حلويات':  [
    'حلويات','حلو','حلوه','حلوى','حلاوة','حلاوه',
    'كيك','تشيز كيك','مولتن كيك',
    'كنافة','كنافه','كنافة دبي','كنافة نوتيلا',
    'وافل','وافله','وافلة',
    'بان كيك','بانكيك','بانكيك نوتيلا',
    'لقيمات','لقيمه',
    'جيلاتو','لوتس',
    'كريب دبي','كريبة',
    'بقلاوة','بقلاوه',
  ],
};

// هل الرسالة تسأل عن قسم كامل؟
function detectCategoryQuery(text) {
  // أزل البادئات
  const PREFIX = /^(?:بدي|شو\s+عندكم|شو\s+في|عندكم|ابعتلي|شوفلي|اعطيني|منيو\s+ال?|قائمة\s+ال?|اسعار\s+ال?)\s*/iu;
  let t = normalize(text).replace(PREFIX, '').replace(/^ال/, '').trim();

  if (!t || t.length < 2) return null;

  // 0. فحص runtimeAliases: هل تعلّمنا سابقاً إنها قسم؟
  const rta = STATE.runtimeAliases || {};
  const catKey = '__cat__' + t;
  if (rta[catKey]) return rta[catKey];
  // أيضاً: فحص بدون prefix
  for (const [k,v] of Object.entries(rta)) {
    if (k.startsWith('__cat__') && k.slice(7) === t) return v;
  }

  // 1. صنف محدد؟ → مش قسم
  // ملاحظة: نفحص كل الأصناف حتى المغلقة، وإلا سقط اسم الصنف المغلق
  // على مطابقة القسم فعُرضت القائمة بدل رسالة "غير متوفر"
  const exactItem = STATE.items.find(i => i.keys.some(k => normalize(k) === t));
  if (exactItem) return null;

  // 2. فحص CAT_KEYWORDS
  for (const [cat, keywords] of Object.entries(CAT_KEYWORDS)) {
    if (normalize(cat) === t) return cat;
    for (const k of keywords) {
      const kn = normalize(k);
      if (kn === t) return cat;
      // مسامحة إملائية (حلوى ↔ حلويات، مشروبه ↔ مشروبات)
      if (t.length >= 4 && Math.abs(t.length - kn.length) <= 2 && levenshtein(t, kn) <= 1) return cat;
    }
  }
  return null;
}

function getDeliveryFee(address) {
  const lower = address.toLowerCase();
  for (const z of STATE.deliveryZones) {
    if (z.keys.some(k => lower.includes(k.toLowerCase()))) return z.fee;
  }
  return 20; // افتراضي
}

// ============================================================
// COMPLEX MESSAGE PARSER
// ============================================================
// ============================================================
// كلمات نهاية الجملة التي لا تعني صنفاً (تُحذف)
// ============================================================
const TRAILING_FILLER = /\s+(خلص|بس|فقط|هيك|هيك بس|بس هيك|يعني|وبس|وخلص|الحين|هلا|هلق)$/i;

// استخراج الكمية من أي مكان في النص (بداية أو نهاية)
function extractQtyFromText(text) {
  // من البداية: "واحدة دبل لحمة" أو "2 زنجر"
  const startNum = arabicToEnglishNumbers(text).match(/^(\d+)\s/);
  if (startNum) return { qty: Math.min(parseInt(startNum[1]), 99), text: text.replace(/^\d+\s/, '').trim() };
  // من النهاية: "دبل لحمة وحدة" أو "زنجر 2"
  const endNum = arabicToEnglishNumbers(text).match(/\s(\d+)$/);
  if (endNum) return { qty: Math.min(parseInt(endNum[1]), 99), text: text.replace(/\s\d+$/, '').trim() };
  // أعداد عربية من البداية
  for (const [word, num] of Object.entries(ARABIC_NUMS)) {
    const startRx = new RegExp('^' + word + '\\s+', 'i');
    if (startRx.test(text)) return { qty: num, text: text.replace(startRx, '').trim() };
    // من النهاية: "دبل لحمة واحدة"
    const endRx = new RegExp('\\s+' + word + '$', 'i');
    if (endRx.test(text)) return { qty: num, text: text.replace(endRx, '').trim() };
  }
  return { qty: 1, text };
}

function parseComplexMessage(text) {
  const actions = [];

  // نظّف نهاية الجملة من كلمات الحشو أولاً
  let t = text.replace(TRAILING_FILLER, '').trim();

  // ============================================================
  // 1. جمل تبديل مركبة: "ما بدي X بدلها Y" / "ما بدي X خلّيها Y"
  // ============================================================
  const SWAP_COMPLEX = /^(?:ما|مش)\s+بدي\s+(.+?)\s+(?:بدل(?:ها|ه|و)?|خل(?:ّ)?(?:يها|يه)|غير(?:ها|ه)?)\s+(.+)$/i;
  const swapMatch = t.match(SWAP_COMPLEX);
  if (swapMatch) {
    actions.push({ type: 'replace', from: swapMatch[1].trim(), to: swapMatch[2].trim() });
    return actions;
  }

  // ============================================================
  // 2. حذف بأشكاله كلها
  // ============================================================
  const REMOVE_VERBS = /(?:^|\s)(?:شيل(?:و|ي)?|احذف|امسح|حذف|ألغ[ِّي]?|الغ[ِّ]?|لغِّ?|ما\s*بدي|مش\s*بدي|مو\s*بدي|ما\s*عندي|ما\s*راح\s*اخذ|لا\s*أريد|لا\s*اريد|شيلها|شيله|شيلهم|روّ?ح|بدي\s+[أا]شيل|اشيل|أشيل|منها\s+|من\s+السلة|بلاش(?:ه)?|استبعد|اسحب)\s*/i;

  if (REMOVE_VERBS.test(t)) {
    // استخرج اسم الصنف بعد كلمة الحذف
    let itemPart = t.replace(REMOVE_VERBS, '').trim();
    // أزل "ال" التعريف
    itemPart = itemPart.replace(/^ال/, '').trim();
    // استخرج الكمية
    const { qty, text: itemName } = extractQtyFromText(itemPart);
    if (itemName.length > 1) {
      actions.push({ type: 'remove', name: itemName, qty });
    }
    if (actions.length) return actions;
  }

  // ============================================================
  // 3. تبديل: "بدل X بـ Y" / "بدله ببيج زنجر" / "خليها X" / "عوّض X بـ Y"
  // ============================================================
  // بدل X بـ Y (بـ ملصوقة أو مفصولة)
  const REPLACE_FULL = /^(?:بدل(?:ها|ه|و)?|غير(?:ها|ه)?|حول(?:ها|ه)?|عوّ?ض(?:ها|ه)?)\s+(.+?)\s+(?:بـ?|بـ|ب|لـ?|على|كمان|وكمان|وخذ|وجيب|وحط|بدالها?|بدالو?|ببدل(?:ها|ه)?)\s*(.+)$/i;
  const replFull = t.match(REPLACE_FULL);
  if (replFull) {
    actions.push({ type: 'replace', from: replFull[1].trim(), to: replFull[2].trim() });
    return actions;
  }

  // "بدلها بعربي" / "بدله بزنجر" → أزل "ب" البادئة من الـ to
  const REPLACE_NOFROM_NOB = /^(?:بدل(?:ها|ه|و)?|غير(?:ها|ه)?)\s+(?!بـ|ب\s)(.+)$/i;
  const noFromNoBMatch = t.match(REPLACE_NOFROM_NOB);
  if (noFromNoBMatch) {
    let candidate = noFromNoBMatch[1].trim();
    // تأكد إنه مش "بدل X بـ Y"
    if (!/\s+(?:بـ?|بـ|ب|لـ?)\s+/.test(candidate)) {
      // أزل "ب" أو "لـ" البادئة إذا كانت ملصوقة: "بعربي" → "عربي"
      candidate = candidate.replace(/^(?:بـ?|لـ?)(?=\S)/, '').trim();
      actions.push({ type: 'replace', from: '__last__', to: candidate });
      return actions;
    }
  }

  // "صفيحة بدلها عربي" / "الصفيحة روحها جيب عربي"
  const REPLACE_ITEM_THEN_VERB = /^(.+?)\s+(?:بدل(?:ها|ه)?|غيّر(?:ها|ه)?|روح(?:ها|ه)?|شيل(?:ها|ه)?)\s+(?:بـ?|لـ?|وجيب\s+)?(.+)$/i;
  const itemVerbMatch = t.match(REPLACE_ITEM_THEN_VERB);
  if (itemVerbMatch) {
    const fromPart = itemVerbMatch[1].trim().replace(/^ال/, '').trim();
    const toPart   = itemVerbMatch[2].trim().replace(/^(?:بـ?|لـ?)(?=\S)/, '').trim();
    if (fromPart.length > 1 && toPart.length > 1) {
      actions.push({ type: 'replace', from: fromPart, to: toPart });
      return actions;
    }
  }

  // "روح X وجيب Y"
  const REPLACE_ROOH = /^(?:روّ?ح|شيل|احذف)\s+(.+?)\s+(?:وجيب|وحط|وضيف|وخذ)\s+(.+)$/i;
  const roohMatch = t.match(REPLACE_ROOH);
  if (roohMatch) {
    actions.push({ type: 'replace', from: roohMatch[1].trim(), to: roohMatch[2].trim() });
    return actions;
  }

  // "خليها X" / "خلّيه X" / "يصير X" / "صيّره X"
  const REPLACE_BECOME = /^(?:خل(?:ّ)?(?:يها|يه|يهم|ّيه)|يصير|صيّر(?:ها|ه)?)\s+(.+)$/i;
  const becomeMatch = t.match(REPLACE_BECOME);
  if (becomeMatch) {
    actions.push({ type: 'replace', from: '__last__', to: becomeMatch[1].trim() });
    return actions;
  }

  // "خلي الزنجر يصير بيج زنجر"
  const REPLACE_XTOBECOME = /^خل(?:ّ)?ي\s+(.+?)\s+(?:يصير|يكون|بدله|بدلها)\s+(.+)$/i;
  const xtoBecomeMatch = t.match(REPLACE_XTOBECOME);
  if (xtoBecomeMatch) {
    actions.push({ type: 'replace', from: xtoBecomeMatch[1].trim(), to: xtoBecomeMatch[2].trim() });
    return actions;
  }

  // ============================================================
  // 4. تنقيص كمية: "نقّص واحد زنجر" / "خلّي اثنين زنجر"
  // ============================================================
  const QTY_REDUCE = /^(?:نقّ?ص(?:لي)?|قلّ?ل|خلّ?ي(?!ها|ه))\s+(.+)$/i;
  const qtyMatch = t.match(QTY_REDUCE);
  if (qtyMatch) {
    const { qty, text: itemName } = extractQtyFromText(qtyMatch[1].trim());
    if (itemName.length > 1) {
      actions.push({ type: 'reduce', name: itemName, qty });
      return actions;
    }
  }

  // ============================================================
  // 5. إضافات عادية (تقسيم بـ "و")
  // ============================================================
  const parts = t.split(/\s+و(?:بدي|اريد|أريد|عايز|ضيف|أضيف|اضيف|خذلي|حطلي)?\s*/);
  for (const part of parts) {
    const p = part.trim();
    if (!p || p.length < 2) continue;
    const qty = extractQty(p);
    const name = extractItemName(p);
    if (name && name.length > 1) actions.push({ type: 'add', name, qty });
  }
  return actions;
}

// تنظيف اسم الصنف من "ال" التعريف قبل البحث
function cleanItemQuery(s) {
  return (s || '').replace(/^ال(?=[\u0600-\u06FF])/, '').trim();
}

function handleComplexOrder(session, text, inOrdering = false) {
  const actions = parseComplexMessage(text);
  if (!actions.length) return null;

  const added = [], removed = [], replaced = [], notFound = [], unavailable = [];

  for (const action of actions) {
    if (action.type === 'add') {
      const item = findItem(cleanItemQuery(action.name));
      if (!item) { notFound.push(action.name); continue; }
      if (!item.active) { unavailable.push(item.name); continue; }
      addToCart(session, item, action.qty);
      added.push(`${action.qty}x ${item.name}`);
    } else if (action.type === 'remove') {
      const item = findItem(cleanItemQuery(action.name));
      if (!item) { notFound.push(action.name); continue; }
      const inCart = session.cart.find(c => normalize(c.name) === normalize(item.name));
      if (!inCart) { notFound.push(action.name); continue; }

      const removeQty = action.qty || null; // null = شيل كل الكمية

      if (removeQty && removeQty < inCart.qty) {
        // شيل عدد محدد فقط
        inCart.qty -= removeQty;
        removed.push(`${removeQty}x ${item.name} (باقي ${inCart.qty})`);
      } else {
        // شيل كل الصنف
        removeFromCart(session, item.name);
        removed.push(item.name);
      }
    } else if (action.type === 'replace') {
      const toItem = findItem(cleanItemQuery(action.to));
      if (!toItem) { notFound.push(action.to); continue; }
      if (!toItem.active) { unavailable.push(toItem.name); continue; }

      let fromItem = null;
      let replaceQty = 1; // كم وحدة يبدّل — دائماً 1 إذا ما ذُكر عدد

      if (action.from === '__last__') {
        const lastEntry = session.cart[session.cart.length - 1];
        if (lastEntry) {
          fromItem = { name: lastEntry.name };
          replaceQty = 1; // يبدّل واحدة فقط حتى لو عنده أكثر
        }
      } else {
        fromItem = findItem(cleanItemQuery(action.from));
        // الكمية المذكورة في الطلب (مثل "بدل 2 صفيحة بعربي")
        const { qty: mentionedQty } = extractQtyFromText(action.from);
        replaceQty = mentionedQty || 1;
      }

      if (!fromItem) { notFound.push(action.from); continue; }

      const fromInCart = session.cart.find(c => normalize(c.name) === normalize(fromItem.name));
      if (!fromInCart) { notFound.push(fromItem.name); continue; }

      // تأكد ما يبدّل أكثر مما عنده
      replaceQty = Math.min(replaceQty, fromInCart.qty);

      // نقص الكمية من الـ from
      fromInCart.qty -= replaceQty;
      if (fromInCart.qty <= 0) {
        session.cart = session.cart.filter(c => normalize(c.name) !== normalize(fromItem.name));
      }

      // أضف الـ to
      addToCart(session, toItem, replaceQty);
      replaced.push(`${replaceQty > 1 ? replaceQty + 'x ' : ''}${fromItem.name} → ${toItem.name}`);

    } else if (action.type === 'reduce') {
      // تنقيص كمية: "نقّص واحد زنجر"
      const rItem = findItem(cleanItemQuery(action.name));
      if (!rItem) { notFound.push(action.name); continue; }
      const entry = session.cart.find(c => c.name === rItem.name);
      if (!entry) { notFound.push(rItem.name); continue; }
      entry.qty = Math.max(0, entry.qty - (action.qty || 1));
      if (entry.qty === 0) {
        removeFromCart(session, rItem.name);
        removed.push(rItem.name);
      } else {
        removed.push(`${rItem.name} (صار ${entry.qty})`);
      }
    }
  }

  // إذا ما في شي تم → رسالة واضحة بدل null
  if (!added.length && !removed.length && !replaced.length) {
    if (notFound.length) {
      const notInCart = notFound.filter(n => {
        // تحقق إذا كان مقصوده إزالة صنف غير موجود في السلة
        return true;
      });
      if (!session.cart.length)
        return `سلتك فاضية، ما في شي أشيله 😅\nقولي شو بدك تطلب!`;
      return `🤔 "${notFound.join('، ')}" مش في سلتك\n\n🛒 سلتك الحالية:\n${cartText(session.cart)}\n\nشو بدك تشيل بالضبط؟`;
    }
    if (unavailable.length)
      return `❌ ${unavailable.join('، ')} غير متوفر حالياً 😔`;
    return null;
  }
  if (!inOrdering) session.state = 'ordering';

  let reply = '';
  if (added.length)       reply += `✅ أُضيف: ${added.join('، ')}\n`;
  if (removed.length)     reply += `🗑️ شُيل: ${removed.join('، ')}\n`;
  if (replaced.length)    reply += `🔄 بُدّل: ${replaced.join(' | ')}\n`;
  if (unavailable.length) reply += `❌ غير متوفر: ${unavailable.join('، ')}\n`;
  if (notFound.length)    reply += `🤔 مش في سلتك: ${notFound.join('، ')}\n`;

  if (session.cart.length) {
    reply += `\n🛒 السلة:\n${cartText(session.cart)}\nالمجموع: ${cartTotal(session.cart)} ₪\n\nفي غير شي؟ أو أرسل *تأكيد* ✅`;
  } else {
    reply += `\nسلتك فاضية الحين 😊 قولي شو بدك تطلب!`;
  }
  return reply.trim();
}

// ============================================================
// QUICK ORDER — رسائل متعددة الأصناف
// ============================================================

// أسطر تُتجاهل كلياً
const SKIP_PATTERNS = [
  /^(السلام عليكم|وعليكم السلام|سلام عليكم|صباح الخير|مساء الخير|صباح النور|مساء النور)[\s.،!🌸🌼]*$/i,
  /^(مرحبا|هلا|أهلا|اهلا|هاي|سلام)[\s.،!🌸🌼]*$/i,
  /^(لو سمحت\s*)?(بدي|ممكن|عايز|اريد|أريد)\s+(اطلب|أطلب|نطلب|اوصي|أوصي)[\s.،!]*$/i,
  /^(لو سمحت|من فضلك|يعطيك العافيه|يعطيكم العافية|يعطيك العافية)[\s.،!]*$/i,
  /^(ومعلش|معلش|شكرا|شكراً|الله يخليك|يسلمو|مشكور|يسلم|تسلم)[\s.،!]*$/i,
  /^(O2|يا اكسجين|اكسجين|يا o2)[\s!]*$/i,
  /^(اوكي ok|ولا يهمك|مشي)[\s!]*$/i,  // أزلنا تمام/مزبوط — تُعالَج كـ isConfirm
  /^(بدي|ممكن|عايز|أريد|اريد|يعطيك العافية|اعطيني|لو سمحت)[\s.،!]*$/i,  // بدي وحدها
  /^(طلع الطلب ولا لسه|طلع الطلب|شو صار|قديش بدو وقت|وصل الطلب)[\s؟?]*$/i,
  /^[\s\p{Emoji}\u{1F300}-\u{1FFFF}🫣🤦🏻‍♀️😂❤️🌿👍✅❌]+$/u,
];

// ملاحظات مضمّنة داخل سطر الصنف
const NOTE_INLINE_SPLIT = /\s+(واذا|واذا في|اذا في امكانيه|لو في امكانيه|لو ممكن|وتزود|وزود الثلج)(.*)/i;

// ملاحظات تأخذ السطر كله — مبنية على محادثات حقيقية
const NOTE_STANDALONE_PATTERNS = [
  /^(تزود الثلج|زود الثلج|زيادة ثلج|ثلج كثير|حط تلج|تلج بزيادة)/i,
  /^(بدون بصل|بدون طحينة|بدون مخلل|بدون أي نوع خضار|بدون خضار|بدون اي خضار|فقط صوص|بس صوص|بس طحينه|بس طحينة|كله بدون خضار)/i,
  /^(اكتب على|يكتب على|لو في امكانيه يكتب|لو ممكن يكتب)/i,
  /^(لو في امكانيه|واذا في امكانيه|لو ممكن|وتوصى|توصى بالمخللات)/i,
  /^(ملاحظة[:\s]|ملاحظه[:\s])/i,
  /^(مع كل وجبة|مع كل طلب|كياس طحينية|طحينية بشطة|طحينية بالشطة|صوصات|امانة الطحنية|كتر طحنية|كياس طحينية بالشطة|كتر طراشي|صوصات حبطرش)/i,
  /^(سلطات كاتشب زيادة|كاتشب زيادة|بالنسبة ل|اذا مش متوفر|اذا ما في)/i,
];

// ثرثرة لا علاقة لها بالطلب — تُتجاهل صامتاً
const CHATTER_PATTERNS = [
  /لطالبة طب|طالبة طب|لطالب/i,
  /زهقت|الدنيا|نطبطب|على دراستها|يزعلك|اراضيك/i,
  /هاي جمله|هاي جملة|هاي كلمة/i,
  /حغلبك بطلب صغير|ومعلش حغلبك/i,
  /^\(\(.*\)\)$/,
  // بيانات التوصيل في سطر مستقل (اسم + رقم + عنوان) — تُتجاهل عند التحليل بالـ state
  /^بإسم\s+|^الطلب بإسم\s+/i,
  /^رقم الجوال\s+[\d\-]+$/i,
  /^العنوان\s+/i,
];

// فصل الملاحظة المضمّنة أولاً، ثم تصنيف الباقي
function extractInlineNote(line) {
  const m = line.match(NOTE_INLINE_SPLIT);
  if (!m) return { clean: line, note: null };
  return { clean: line.slice(0, m.index).trim(), note: m[0].trim() };
}

// يُعيد { type: 'skip'|'note'|'item', name?, qty?, inlineNote?, note? }
function classifyAndParse(rawLine) {
  const line = rawLine.trim();

  if (SKIP_PATTERNS.some(p => p.test(line))) return { type: 'skip' };
  if (CHATTER_PATTERNS.some(p => p.test(line))) return { type: 'skip' };
  if (/^\(\(.*\)\)$/.test(line)) return { type: 'skip' };

  // ملاحظة مستقلة (السطر كله ملاحظة)
  if (NOTE_STANDALONE_PATTERNS.some(p => p.test(line))) return { type: 'note', note: line };

  // فصل ملاحظة مضمّنة
  const { clean, note: inlineNote } = extractInlineNote(line);

  // بعد الفصل، إذا الباقي فاضي أو ثرثرة = تجاهل
  const cleanNoNums = clean.replace(/[\d٠-٩\s،,\.!\?🫣]/g, '');
  if (cleanNoNums.length === 0) return { type: 'skip' };
  if (cleanNoNums.length > 35) return { type: 'skip' };

  // استخرج الكمية والاسم
  let processedLine = arabicToEnglishNumbers(clean).trim();
  processedLine = processedLine.replace(/^(بدي|عايز|اريد|أريد|اضيف|خذلي|حطلي)\s+/i, '').trim();

  let qty = 1;
  const numMatch = processedLine.match(/^(\d+)\s+/);
  if (numMatch) {
    qty = Math.min(parseInt(numMatch[1]) || 1, 99);
    processedLine = processedLine.slice(numMatch[0].length).trim();
  } else {
    for (const [word, num] of Object.entries(ARABIC_NUMS)) {
      const wordRx = new RegExp('^' + word + '\\s+', 'i');
      if (wordRx.test(clean)) {
        qty = num;
        processedLine = arabicToEnglishNumbers(clean.replace(wordRx, '').trim());
        break;
      }
    }
  }

  // أزل السعر من النهاية "ب 25" أو "(25)"
  processedLine = processedLine.replace(/\s+ب\s*\d+\s*$/i, '').trim();
  processedLine = processedLine.replace(/\s*\(\d+\)\s*$/, '').trim();

  return { type: 'item', name: processedLine, qty, inlineNote };
}

// hashMsg: بصمة مختصرة للرسالة لكشف الإعادة
function hashMsg(raw) {
  return raw.replace(/\s+/g,'').slice(0, 60);
}

function tryQuickOrder(session, raw, inOrdering = false) {
  // ── فصل أصناف متعددة في سطر واحد ────────────────────────
  // "3 دبل 2 كاليزوني" → ["3 دبل", "2 كاليزوني"]
  // "بدي 2 دبل 3 كاليزوني" → ["2 دبل", "3 كاليزوني"]
  function splitMultiItems(text) {
    // أزل بادئات الطلب أولاً
    let t = text.replace(/^(?:بدي|ممكن|عايز|اريد|أريد|لو سمحت|اعطيني|خذلي|حطلي|ابعتلي)\s+/i, '').trim();

    // نمط: رقم + صنف + رقم + صنف
    const parts = t.split(/\s+(?=\d+\s+(?!\d))/);
    if (parts.length > 1) return parts.map(p => p.trim()).filter(p => p.length > 1);

    // أرقام عربية
    const parts2 = t.split(/\s+(?=[٠-٩]+\s+)/);
    if (parts2.length > 1) return parts2.map(p => p.trim()).filter(p => p.length > 1);

    // "فرشوحة و كولا"
    if (/\s+(?:و|وكمان|مع|\+)\s+/.test(t)) {
      return t.split(/\s+(?:و|وكمان|مع|\+)\s+/).map(p => p.trim()).filter(p => p.length > 1);
    }

    // صنف واحد بدون رقم بعد صنف آخر (مثل "3 دبل كاليزوني")
    // ابحث عن نمط: "text1 text2" حيث text2 هو اسم صنف مختلف
    if (!t.match(/^\d/)) return [t]; // بدون رقم = صنف واحد

    return [t];
  }

  let lines = raw.split(/\n/).map(l => l.trim()).filter(l => l.length > 1);
  // فصل كل سطر فيه أصناف متعددة
  const expanded = [];
  for (const line of lines) {
    expanded.push(...splitMultiItems(line));
  }
  lines = expanded;
  if (lines.length < 1) return null;

  // كشف إعادة الإرسال: إذا نفس الرسالة تقريباً والسلة مش فاضية
  if (inOrdering && session.cart.length > 0) {
    const msgHash = hashMsg(raw);
    if (session._lastMsgHash === msgHash) {
      // نفس الرسالة تماماً — الزبون بعت بالخطأ مرتين
      return `سلتك الحالية:
${cartText(session.cart)}
المجموع: *${cartTotal(session.cart)} ₪*

أرسل *تأكيد* لإتمام الطلب أو *إلغاء* للبدء من جديد 😊`;
    }
    session._lastMsgHash = msgHash;
  } else if (!inOrdering) {
    session._lastMsgHash = null;
  }

  const found = [], unavail = [], notes = [];
  // نجمع الأصناف بدون إضافة للسلة أولاً (dry run)
  const pendingCart = [];
  let hasItem = false;

  for (const rawLine of lines) {
    const result = classifyAndParse(rawLine);

    if (result.type === 'skip') continue;
    if (result.type === 'note') { notes.push(result.note); continue; }

    // type === 'item'
    if (result.inlineNote) notes.push(result.inlineNote);
    if (!result.name || result.name.length < 2) continue;

    const item = findItem(result.name);
    if (item) {
      hasItem = true;
      if (!item.active) { unavail.push(item.name); continue; }
      pendingCart.push({ item, qty: result.qty });
      found.push(`${result.qty}x ${item.name} — ${result.qty * item.price} ₪`);

      // ── leftover: بعد إيجاد الصنف، هل في بقية نص تحتوي صنف ثاني؟ ──
      // "3 دبل كاليزوني" → item="دبل", leftover="كاليزوني"
      const itemKeys = item.keys.map(k => normalize(k));
      let leftover = normalize(result.name);
      // أزل اسم الصنف المطابق من النص الأصلي
      for (const k of itemKeys) {
        if (leftover.includes(k)) { leftover = leftover.replace(k, '').trim(); break; }
      }
      // أزل الأرقام من البداية
      leftover = leftover.replace(/^\d+\s*/, '').trim();
      if (leftover.length >= 2) {
        const leftItem = findItem(leftover);
        if (leftItem && leftItem.id !== item.id && leftItem.active) {
          pendingCart.push({ item: leftItem, qty: 1 });
          found.push(`1x ${leftItem.name} — ${leftItem.price} ₪`);
        }
      }
    }
  }

  if (!hasItem || !found.length) return null;

  // إذا في ordering وفي سلة — فحص إذا الأصناف مختلفة تماماً (طلب جديد)
  if (inOrdering && session.cart.length > 0) {
    const currentItemIds = new Set(session.cart.map(i => i.id));
    const newItemIds = pendingCart.map(p => p.item.id);
    const allNew = newItemIds.every(id => !currentItemIds.has(id));
    
    if (allNew && newItemIds.length >= 2) {
      // أصناف جديدة كلياً — ابدأ طلب جديد بدل الإضافة
      // امسح السلة القديمة وابدأ من جديد
      session.cart = [];
      session._lastMsgHash = hashMsg(raw);
    }
    // إذا بعضها موجود = إضافة عادية
  }

  // الآن أضف للسلة
  for (const {item, qty} of pendingCart) {
    addToCart(session, item, qty);
  }

  if (!session.cart.length) return null;

  session.state = 'ordering';
  const messages = [];

  // رد الترحيب — بس إذا في تحية فعلية في الرسالة
  if (/السلام عليكم|سلام عليكم/i.test(raw)) {
    messages.push(rand(['وعليكم السلام! أهلاً وسهلاً 😊', 'وعليكم السلام! تكرم 🌿', 'وعليكم السلام! يا هلا فيك 😊']));
  } else if (/مرحبا|هلا|صباح|مساء/i.test(raw)) {
    messages.push(rand(['أهلاً وسهلاً! 😊', 'يا هلا! 🌿', 'تكرم! 😊']));
  }

  // رسالة الطلب
  let orderMsg = '🛒 *فهمت طلبك:*\n';
  orderMsg += found.join('\n');
  if (unavail.length) orderMsg += '\n' + unavail.map(n => `❌ ${n} — غير متوفر حالياً`).join('\n');
  orderMsg += `\n\n─────────────\n${cartText(session.cart)}\nالمجموع: *${cartTotal(session.cart)} ₪*`;
  messages.push(orderMsg);

  // الملاحظات — مجمّعة في رسالة واحدة
  if (notes.length) {
    messages.push(`📝 *لاحظت ملاحظاتك:*\n${notes.map(n => '• ' + n).join('\n')}\nسنهتم بكل التفاصيل 😊`);
  }

  messages.push('في غير شي؟ أو أرسل *تأكيد* لإتمام الطلب ✅');

  return messages;
}

// ============================================================
// MISC HELPERS
// ============================================================
function buildUnavailableMsg(itemName, query, cat=null) {
  const orig = STATE.items.find(i => normalize(i.name)===normalize(itemName));
  const preferCat = cat||orig?.cat||null;
  const similar = findSimilarItems(query||itemName, preferCat, 3);
  let msg = `عذراً، *${itemName}* غير متوفر حالياً 😔`;
  if (similar.length) {
    const same = similar.filter(i => i.cat===preferCat);
    msg += '\n\nبس عندنا من نفس الفئة:\n';
    msg += (same.length?same:similar).map(i=>`• ${i.name} — ${i.price} ₪`).join('\n');
    msg += '\n\nبدك تطلب أحد هالأصناف؟ 😊';
  }
  return msg;
}

function isQuestion(t) {
  return /كم|بكام|سعره|قيمة|غالي|رخيص|price|how much|cost/.test(t) ||
    /[؟?]$/.test(t.trim()) || /\bبكم\b|\bسعر\b/.test(t) ||
    /^(في|فيه|هل|عندكم|متوفر|في عندكم|بتعملوا)/i.test(t);
}
function isOrder(t)    { return /بدي|عايز|اريد|أريد|اطلب|خذلي|حطلي|اضيف|زودني|i want|order|give me|add/.test(t); }
function isComplex(t) {
  return (
    // حذف: شيل / احذف / امسح / ما بدي / مش بدي / لغِّ / روّح / بدي اشيل
    /(?:^|\s)(?:شيل(?:و|ي)?|احذف|امسح|ألغ[ِّي]?|الغ[ِّ]?|لغِّ?|روّ?ح|ما\s+بدي|مش\s+بدي|شيلها|شيله|اشيل|أشيل|بدي\s+اشيل)/i.test(t) ||
    // تبديل: بدل / غير / حوّل / عوّض / خليها / يصير / صيّر
    /(?:بدل(?:ها|ه|و)?|غير(?:ها|ه)?|خل(?:ّ)?(?:يها|يه)|حول(?:ها|ه)?|عوّ?ض|يصير|صيّر(?:ها|ه)?)/i.test(t) ||
    // تنقيص: نقّص / قلّل
    /(?:نقّ?ص|قلّ?ل)/i.test(t) ||
    // جملة تبديل مركبة: "ما بدي X بدلها Y"
    /(?:ما|مش)\s+بدي\s+.+\s+(?:بدل(?:ها|ه)?|خل(?:ّ)?(?:يها|يه)|غير(?:ها|ه)?)/i.test(t) ||
    // و + فعل
    /\s+و\s*(?:بدي|اريد|ضيف|اضيف|خذلي|شيل|بدل|غير)/i.test(t)
  );
}

const rand = arr => arr[Math.floor(Math.random() * arr.length)];
const WAIT_MSGS    = ['تمام! 👍', 'اوك حبيبي! 👌', 'ماشي!'];
const CONFIRM_MSGS = ['هاد كل شي؟ 😊', 'في غير شي؟', 'شو رأيك بإضافة حلوى أو مشروب؟ 😄'];

// ============================================================
// GROUP NOTIFICATION
// ============================================================
async function sendToGroup(text) {
  if (!STATE.settings.groupId?.trim()) return null;
  try {
    const chatId = STATE.settings.groupId.trim().includes('@g.us')
      ? STATE.settings.groupId.trim()
      : STATE.settings.groupId.trim() + '@g.us';
    if (!waSocket) { console.log('⚠️ لا اتصال — لم يُرسل إشعار القروب'); return null; }
    return await waSocket.sendMessage(chatId, { text });
  } catch(e) {
    console.log('خطأ في القروب:', e.message);
    return null;
  }
}

// ============================================================
// TRIGGER + BROWSING + STAFF COMMANDS
// ============================================================

// الدردشات التي فُعّل فيها البوت: jid → آخر نشاط
const activeChats = new Map();

function triggerWords() {
  const w = STATE.settings.triggerWords;
  return (Array.isArray(w) && w.length ? w : ['bot']).map(x => normalize(String(x)));
}

function isTriggered(text) {
  const t = normalize(text);
  const words = triggerWords();
  return words.includes(t) || words.includes(t.split(' ')[0]);
}

function chatIsActive(jid) {
  const last = activeChats.get(jid);
  if (!last) return false;
  const ttl = (STATE.settings.triggerTimeoutMins || 20) * 60 * 1000;
  if (Date.now() - last > ttl) { activeChats.delete(jid); return false; }
  return true;
}

const touchChat = (jid) => activeChats.set(jid, Date.now());

setInterval(() => {
  const ttl = (STATE.settings.triggerTimeoutMins || 20) * 60 * 1000;
  const now = Date.now();
  for (const [jid, t] of activeChats) if (now - t > ttl) activeChats.delete(jid);
}, 5 * 60 * 1000);

// ── رسائل التصفّح ──────────────────────────────────────────
function activeCategories() {
  return STATE.categories.filter(c => c.active !== false);
}

const NUM_EMOJI = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
const SEP = '━━━━━━━━━━━━━━━';

/** أسطر الأقسام المرقّمة — تُستخدم في البداية وفي نهاية كل قسم */
function categoryLines(branch) {
  const pool = branchItems(branch);
  return activeCategories().map((c, i) => {
    const n = pool.filter(it => it.cat === c.id && it.active).length;
    return `${NUM_EMOJI[i] || (i + 1) + '.'}  ${c.label}${n ? '' : '  (مغلق حالياً)'}`;
  });
}

/** القائمة الرئيسية: كل الأقسام + خيار الإنهاء */
function categoriesMessage(branch) {
  const b = branch || STATE.settings.activeBranch || 'gaza';
  const multi = STATE.settings.branchMode === 'ask' && branchList().length > 1;
  return [
    `📋 *أقسام ${STATE.settings.name}*` + (multi ? ` — ${branchLabel(b)}` : ''),
    SEP,
    ...categoryLines(b),
    SEP,
    '0️⃣  إنهاء العملية' + (multi ? '   |   *99* تغيير الفرع' : ''),
    '',
    'أرسل رقم القسم لعرض أصنافه وأسعاره 👆',
  ].join('\n');
}

/** يُلحق بعد أصناف أي قسم: اختر قسماً آخر أو أنهِ */
function nextStepMessage(branch) {
  const multi = STATE.settings.branchMode === 'ask' && branchList().length > 1;
  return [
    '',
    '👇 *بدك تشوف قسم تاني؟*',
    '',
    ...categoryLines(branch),
    '0️⃣  إنهاء العملية' + (multi ? '   |   *99* تغيير الفرع' : ''),
  ].join('\n');
}

/** نص سعر الصنف: بالوزن، أو بأحجام، أو سعر مفرد */
function priceText(item) {
  if (item.pricePerKg) return `${item.pricePerKg} ₪/كغم`;
  if (Array.isArray(item.variants) && item.variants.length)
    return item.variants.map(v => `${v.name} ${v.price}`).join(' · ') + ' ₪';
  return `${item.price} ₪`;
}

/** سطر صنف بنقاط تملأ الفراغ حتى تصطف الأسعار، ووصف تحته إن وُجد */
function itemLine(item, width) {
  const len = [...item.name].length;
  const dots = '.'.repeat(Math.max(3, width - len + 3));
  let line = `${item.name} ${dots} *${priceText(item)}*`;
  if (STATE.settings.showItemDesc && item.desc) line += `\n   _${item.desc}_`;
  return line;
}

/* ══════════════ الفروع ══════════════ */

function branchList() {
  return menuBuild.BRANCHES;
}

function branchLabel(id) {
  const b = branchList().find(x => x.id === id);
  return b ? b.label : id;
}

/** الفرع الذي يخدم هذه المحادثة */
function sessionBranch(session) {
  if (STATE.settings.branchMode === 'single') return STATE.settings.activeBranch || 'gaza';
  return session.branch || STATE.settings.activeBranch || 'gaza';
}

/** أصناف فرع معيّن فقط — الأصناف بلا حقل branch تُعتبر عامة */
function branchItems(branch) {
  return STATE.items.filter(i => !i.branch || i.branch === branch);
}

function branchQuestion() {
  const nums = ['1️⃣','2️⃣','3️⃣','4️⃣'];
  return [
    `👋 أهلاً بك في *${STATE.settings.name}*`,
    SEP,
    'اختر الفرع الأقرب لك:',
    ...branchList().map((b, i) => `${nums[i] || (i+1)+'.'}  ${b.label}`),
  ].join('\n');
}

/** أصناف قسم واحد مرتّبة بأسعارها، ثم قائمة الأقسام من جديد */
function categoryMessage(session, catId) {
  const cat = STATE.categories.find(c => c.id === catId);
  if (!cat) return null;
  const branch = sessionBranch(session);
  const items = branchItems(branch).filter(i => i.cat === catId && i.active);
  session.browseList = [];
  session.lastCategory = catId;

  if (!items.length) {
    return `${cat.label}\n${SEP}\nلا يوجد صنف متوفر حالياً في هذا القسم 🙏${nextStepMessage(branch)}`;
  }

  const width = items.reduce((m, i) => Math.max(m, [...i.name].length), 0);
  const head = cat.byWeight
    ? `${cat.label}   _(${items.length} صنف — الأسعار بالكيلو)_`
    : `${cat.label}   _(${items.length} صنف)_`;
  return [
    head,
    SEP,
    ...items.map(i => itemLine(i, width)),
    SEP,
  ].join('\n') + nextStepMessage(branch);
}

/** بدائل متوفرة من نفس القسم عندما يطلب الزبون صنفاً مغلقاً */
function alternativesText(item) {
  const alts = STATE.items.filter(i => i.cat === item.cat && i.active).slice(0, 4);
  if (!alts.length) return '';
  return `\n\nبدائل متوفرة من نفس القسم:\n${alts.map(i => `• ${i.name} — ${i.price} ₪`).join('\n')}`;
}

// ── إشعار الطاقم عند تغيّر التوفّر ─────────────────────────
async function notifyStaffAvailability(item, who) {
  const icon = item.active ? '✅' : '🚫';
  const verb = item.active ? 'تم تفعيل' : 'تم إغلاق';
  return sendToGroup(`${icon} ${verb} *${item.name}*\n👤 بواسطة: ${who}\n🕐 ${new Date().toLocaleString('ar-EG')}`);
}

// ── أوامر الطاقم من واتساب ────────────────────────────────
function closedItemsMessage() {
  const closed = STATE.items.filter(i => !i.active);
  if (!closed.length) return '✅ كل الأصناف متوفرة حالياً.';
  const groups = {};
  for (const i of closed) (groups[i.cat] = groups[i.cat] || []).push(i);
  const out = [`🚫 *الأصناف المغلقة (${closed.length})*`, '━━━━━━━━━━━━━━━'];
  for (const [cat, list] of Object.entries(groups)) {
    const label = (STATE.categories.find(c => c.id === cat) || {}).label || cat;
    out.push(`*${label}*`);
    for (const i of list) out.push(`• ${i.name}${i.updatedBy ? ` — ${i.updatedBy}` : ''}`);
    out.push('');
  }
  return out.join('\n').trim();
}

async function handleStaffCommand(from, raw) {
  const parts = raw.slice(1).trim().split(/\s+/);
  const cmd = normalize(parts[0] || '');
  const arg = parts.slice(1).join(' ').trim();
  const user = auth.byWhatsapp(from);

  if (['دخول', 'login', 'تسجيل'].includes(cmd)) {
    const num = String(from).split('@')[0].replace(/\D/g, '');
    if (!num) return '⚠️ تعذّر قراءة رقمك. أرسل الأمر من واتساب مباشرة (لا من محاكي الداشبورد).';
    const account = auth.login(parts[1], parts.slice(2).join(' '));
    if (!account) return '❌ بيانات الدخول غير صحيحة.\nالصيغة: #دخول اسم_المستخدم كلمة_المرور';
    const prev = auth.byWhatsapp(from);
    if (prev && prev.id !== account.id) auth.updateUser(prev.id, { whatsappNumber: '' });
    auth.updateUser(account.id, { whatsappNumber: num });
    auth.audit(account, 'staff.link', 'واتساب', `ربط الرقم ${num}`, 'whatsapp');
    return `✅ تم ربط رقمك بحساب *${account.displayName}* (${auth.roleLabel(account.role)}).\n\nالأوامر:\n#اغلاق اسم الصنف\n#تفعيل اسم الصنف\n#المغلق\n#خروج_طاقم`;
  }

  if (!user) return '🔒 هذا الأمر للطاقم فقط.\nسجّل دخولك أولاً:\n#دخول اسم_المستخدم كلمة_المرور';

  if (['خروج_طاقم', 'logout'].includes(cmd)) {
    auth.updateUser(user.id, { whatsappNumber: '' });
    auth.audit(user, 'staff.unlink', 'واتساب', 'فك ربط الرقم', 'whatsapp');
    return '✅ تم فك ربط رقمك.';
  }

  if (['المغلق', 'مغلق', 'closed'].includes(cmd)) return closedItemsMessage();

  const opening = ['تفعيل', 'فتح', 'open'].includes(cmd);
  const closing = ['اغلاق', 'إغلاق', 'خلص', 'close'].includes(cmd);
  if (opening || closing) {
    if (!auth.can(user, 'menu.toggle')) return '🔒 حسابك لا يملك صلاحية تعديل التوفّر.';
    if (!arg) return `⚠️ الصيغة: #${parts[0]} اسم الصنف`;
    const now = new Date().toISOString();

    // قسم كامل؟
    const cat = STATE.categories.find(c =>
      normalize(c.id) === normalize(arg) || normalize(c.label).includes(normalize(arg)));
    if (cat) {
      const affected = STATE.items.filter(i => i.cat === cat.id && i.active !== opening);
      for (const it of affected) {
        it.active = opening; it.updatedBy = user.displayName;
        it.updatedRole = user.role; it.updatedAt = now;
      }
      await saveStateNow();
      auth.audit(user, opening ? 'category.open' : 'category.close', cat.id,
        `${opening ? 'تفعيل' : 'إغلاق'} ${affected.length} صنف`, 'whatsapp');
      addLog(`${opening ? '✅' : '🚫'} ${cat.label}: ${affected.length} صنف — ${user.displayName}`);
      return `${opening ? '✅' : '🚫'} ${opening ? 'تم تفعيل' : 'تم إغلاق'} قسم *${cat.label}* (${affected.length} صنف) — بواسطة ${user.displayName}`;
    }

    const item = findItem(arg);
    if (!item) return `🤔 لم أجد صنفاً باسم "${arg}".\nجرّب الاسم كما هو في المنيو، أو أرسل #المغلق.`;
    if (item.active === opening) return `ℹ️ *${item.name}* أصلاً ${opening ? 'مفعّل' : 'مغلق'}.`;
    item.active = opening;
    item.updatedBy = user.displayName;
    item.updatedRole = user.role;
    item.updatedAt = now;
    await saveStateNow();
    auth.audit(user, opening ? 'menu.open' : 'menu.close', item.name,
      opening ? 'تفعيل الصنف' : 'إغلاق الصنف', 'whatsapp');
    addLog(`${opening ? '✅ فُعّل' : '🚫 أُغلق'}: ${item.name} — ${user.displayName}`);
    notifyStaffAvailability(item, user.displayName).catch(()=>{});
    return `${opening ? '✅' : '🚫'} *${item.name}* أصبح ${opening ? 'متوفراً' : 'غير متوفر'} — بواسطة ${user.displayName}`;
  }

  return 'الأوامر: #اغلاق | #تفعيل | #المغلق | #خروج_طاقم';
}

// ============================================================
// MAIN MESSAGE HANDLER
// ============================================================
// رد ذكي لما البوت ما يفهم (بدون AI)
function buildSmartUnknownReply(from, rawMsg, session) {
  const t = normalize(rawMsg);

  // سجّل دائماً في unknowns للمراجعة من الداشبورد
  logUnknown(from, rawMsg, {
    state: session?.state || null,
    cartItems: session?.cart?.length || 0,
  });

  // 1. يبدو طلب صنف غير موجود
  const looksLikeOrder = /^(بدي|اريد|أريد|خذلي|حطلي|اعطيني|اطلب|طلب)\s+/i.test(rawMsg)
    || /\d+\s*x?\s*\w+/i.test(rawMsg)
    || (rawMsg.split(' ').length <= 4 && rawMsg.length > 2);

  // فحص ingredient أولاً
  const ingRes = findByIngredient(t);
  if (ingRes && ingRes.items.length) {
    const list = ingRes.items.map(i => '• ' + i.name + ' — ' + i.price + ' ₪').join('\n');
    return 'عندنا هالأصناف فيها ' + ingRes.ingredient + ':\n' + list + '\n\nبدك تطلب أحدها؟ 😊';
  }

  if (looksLikeOrder) {
    const similar = findSimilarItems(t, null, 3);
    if (similar.length) {
      const simList = similar.map(i => '• ' + i.name + ' — ' + i.price + ' ₪').join('\n');
      return 'مش عندنا "' + rawMsg + '" في المنيو 😅\nبس عندنا:\n' + simList + '\n\nبدك تطلب أحد هالأصناف؟';
    }
    return '"' + rawMsg + '" مش في منيونا حالياً 😅\nاكتب *منيو* لتشوف كل أصنافنا 🌿';
  }

  return null;
}

async function handleMessage(msg) {
  const from = msg.from;
  const rawOriginal = msg.body?.trim() || '';
  if (!rawOriginal) return null;

  const session = getSession(from);
  session.from = from;
  session.lastActivity = Date.now();

  // حفظ تاريخ المحادثة للسياق
  if (!session.history) session.history = [];
  session.history.push({ text: rawOriginal, time: Date.now() });
  if (session.history.length > 8) session.history = session.history.slice(-8);

  if (!STATE.settings.botActive) {
    return dropMsg(from, rawOriginal, 'البوت موقوف',
      'زر «تشغيل البوت» في أعلى اللوحة، أو botActive في الإعدادات.');
  }

  // ══════════════════════════════════════════════════════════
  // أوامر الطاقم — تعمل دائماً بغض النظر عن حالة التفعيل
  // ══════════════════════════════════════════════════════════
  if (rawOriginal.startsWith('#')) {
    return await handleStaffCommand(from, rawOriginal);
  }

  // ══════════════════════════════════════════════════════════
  // بوابة التفعيل — عند requireTrigger البوت صامت حتى
  // يرسل الزبون كلمة التفعيل (يجعل ربطه برقم شخصي آمناً)
  // ══════════════════════════════════════════════════════════
  if (STATE.settings.requireTrigger) {
    if (!chatIsActive(from)) {
      if (!isTriggered(rawOriginal)) {
        return dropMsg(from, rawOriginal, 'ليست كلمة تفعيل',
          'الكلمات المقبولة: ' + (STATE.settings.triggerWords || []).join('، ')
          + ' — أو أطفئ «يتطلب كلمة تفعيل» من الإعدادات.');
      }
      touchChat(from);
      const fresh = resetSession(from);
      const sess = fresh && fresh.cart ? fresh : getSession(from);
      if (STATE.settings.branchMode === 'ask' && branchList().length > 1) {
        sess.state = 'pick_branch';
        return branchQuestion();
      }
      const br = sessionBranch(sess);
      return STATE.settings.browseOnly
        ? categoriesMessage(br)
        : `${STATE.settings.welcome}\n\n${categoriesMessage(br)}`;
    }
    touchChat(from);
    if (/^(خروج|انهاء|إنهاء|exit|stop|bye)$/.test(normalize(rawOriginal))) {
      activeChats.delete(from);
      resetSession(from);
      return 'تم إنهاء المحادثة الآلية 🌿\nأرسل *bot* في أي وقت لتشغيلها من جديد.';
    }
  }

  // ══════════════════════════════════════════════════════════
  // وضع التصفّح فقط — لا رد إلا على: كلمة التفعيل، رقم قسم،
  // طلب الأقسام، الإنهاء. أي شيء آخر يُعاد إليه عرض الأقسام،
  // ولا شيء إطلاقاً قبل التفعيل.
  // ══════════════════════════════════════════════════════════
  if (STATE.settings.browseOnly) {
    const t = normalize(rawOriginal);
    const askBranch = STATE.settings.branchMode === 'ask' && branchList().length > 1;
    const cur = getSession(from);

    // مرحلة اختيار الفرع
    if (askBranch && cur.state === 'pick_branch') {
      const n = parseInt(rawOriginal.trim(), 10);
      const picked = branchList()[n - 1];
      if (!picked) return `اختر رقم الفرع 👇\n\n${branchQuestion()}`;
      cur.branch = picked.id;
      cur.state = null;
      return `✅ ${picked.label}\n\n${categoriesMessage(picked.id)}`;
    }

    if (/^(0|صفر|انهاء|خروج|خلصت|تم|بس)$/.test(t)) {
      activeChats.delete(from);
      resetSession(from);
      return `شكراً لك ونتشرف بخدمتك 🌿\n${SEP}\nتم إنهاء العملية.\n\nلعرض المنيو من جديد أرسل *bot* في أي وقت.`;
    }

    // 9 = تغيير الفرع
    if (askBranch && (rawOriginal.trim() === '99' || /^(تغيير الفرع|فرع|الفرع|فروع)$/.test(t))) {
      cur.state = 'pick_branch';
      return branchQuestion();
    }

    if (/^\d{1,2}$/.test(rawOriginal.trim())) {
      const cats = activeCategories();
      const n = parseInt(rawOriginal.trim(), 10);
      if (cats[n - 1]) {
        const msg = categoryMessage(cur, cats[n - 1].id);
        if (msg) return msg;
      }
      return `ما في قسم برقم ${n} 🤔\n\n${categoriesMessage(sessionBranch(cur))}`;
    }

    // أي شيء آخر — بما فيه أسماء الأصناف والتحيات — يعيد الأقسام
    return categoriesMessage(sessionBranch(cur));
  }

  // كلمة التفعيل تعرض الأقسام دائماً، حتى في الوضع الكامل
  if (isTriggered(rawOriginal)) return categoriesMessage(sessionBranch(session));

  const raw = fixSpelling(translateEN(rawOriginal));
  const text = raw.toLowerCase();

  // ══════════════════════════════════════════════════════════
  // التصفّح بالأرقام: 0 = الأقسام، رقم داخل قسم = صنف
  // ══════════════════════════════════════════════════════════
  // ── 0 أو "إنهاء" = إنهاء العملية ──────────────────────────
  if (/^(0|صفر|انهاء|انهاء العمليه|خلصت|تم)$/.test(normalize(rawOriginal)) && !session.state) {
    activeChats.delete(from);
    resetSession(from);
    return `شكراً لك ونتشرف بخدمتك 🌿\n${SEP}\nتم إنهاء العملية.\n\nلعرض المنيو من جديد أرسل *bot* في أي وقت.`;
  }

  // ── طلب عرض الأقسام ───────────────────────────────────────
  if (/^(الاقسام|رجوع|القائمه|قائمه|منيو|المنيو|menu)$/.test(normalize(rawOriginal)) && !session.state) {
    session.browseList = [];
    return categoriesMessage();
  }

  // ── رقم = اختيار قسم (تظهر أصنافه ثم الأقسام من جديد) ─────
  if (/^\d{1,2}$/.test(rawOriginal.trim()) && !session.state) {
    const cats = activeCategories();
    const n = parseInt(rawOriginal.trim(), 10);
    if (cats[n - 1]) {
      const msg = categoryMessage(session, cats[n - 1].id);
      if (msg) return msg;
    }
    return `ما في قسم برقم ${n} 🤔\n\n${categoriesMessage()}`;
  }

  // ── سياق ذكي: رسالة قصيرة بعد ذكر صنف/قسم ──────────────
  // // مثال: "جيلاتو" → "بلوبري" = جيلاتو بلوبري
  // const isShortMsg = rawOriginal.split(' ').length <= 2 && rawOriginal.length <= 20;
  // if (isShortMsg && session.lastItem && !findItem(rawOriginal)) {
  //   // جرب دمج مع آخر صنف ذُكر
  //   const combined = session.lastItem + ' ' + rawOriginal;
  //   const combinedItem = findItem(combined);
  //   if (combinedItem && combinedItem.active) {
  //     session.state = 'pending_item';
  //     session.pendingItem = combinedItem;
  //     session.pendingQty = 1;
  //     session.lastItem = combinedItem.name;
  //     return `${combinedItem.name} — *${combinedItem.price} ₪* 😊\n\nبدك تطلبه؟ (نعم / لا)`;
  //   }
  //   // جرب كـ نكهة
  //   const ingRes = findByIngredient(rawOriginal);
  //   if (ingRes) {
  //     // فلتر حسب آخر صنف/قسم
  //     const contextItems = ingRes.items.filter(i =>
  //       normalize(i.name).includes(normalize(session.lastItem || '')) ||
  //       i.cat === session.lastCategory
  //     );
  //     if (contextItems.length === 1) {
  //       // نكهة واحدة تطابق السياق → اقترحها مباشرة
  //       session.state = 'pending_item';
  //       session.pendingItem = contextItems[0];
  //       session.pendingQty = 1;
  //       return `${contextItems[0].name} — *${contextItems[0].price} ₪* 😊\n\nبدك تطلبه؟ (نعم / لا)`;
  //     }
  //     if (contextItems.length > 1) {
  //       const list = contextItems.map(i => `• ${i.name} — ${i.price} ₪`).join('\n');
  //       return `عندنا هالنكهات:\n${list}\n\nأي واحد بدك؟`;
  //     }
  //   }
  // }

//   // وضع الموظف البشري
//   if (STATE.settings.transferMode) {
//     let q = STATE.queue.find(q => q.phone === from);
//     if (!q) {
//       q = { phone: from, time: new Date().toLocaleTimeString('ar'), msgs: [] };
//       STATE.queue.push(q);
//       addLog(`👨‍💼 زبون في الانتظار: ${from}`);
//     }
//     q.msgs.push(rawOriginal);
//     if (q.msgs.length > 50) q.msgs = q.msgs.slice(-50);
//     saveState();
//     return `شكراً! أحد موظفينا سيتواصل معك قريباً 👨‍💼\nأوقات الدوام: ${STATE.settings.hours}`;
//   }

//   // إلغاء
//   if (/^(الغاء|إلغاء|كنسل|بطل|وقف)$/.test(text)) {
//     clearPendingOrder(from);
//     resetSession(from);
//     return 'تم الإلغاء ❌ أهلاً بك في أي وقت 🌿';
//   }

//   // ====== طلب معلق — تحقق عند أول رسالة للزبون ======
//   if (!session.state && !session.cart.length) {
//     const po = getPendingOrder(from);
//     if (po) {
//       // زبون عنده طلب معلق — نسأله
//       session.state = 'pending_order_choice';
//       session._pendingOrder = po;
//       const age = Math.round((Date.now() - po.savedAt) / 60000);
//       const ageText = age < 60 ? `منذ ${age} دقيقة` : `منذ ${Math.round(age/60)} ساعة`;
//       return `مرحباً! 👋 عندك طلب غير مكتمل (${ageText}):

// ${pendingOrderSummary(po)}

// 1️⃣ *أكمل التحويل للطلب القديم*
// 2️⃣ *اطلب جديد*
// 3️⃣ *إلغاء الطلب القديم*`;
//     }
//   }

//   // استئناف طلب معلق
//   if (session.state === 'pending_order_choice') {
//     const po = session._pendingOrder;
//     if (/^(1|أكمل|اكمل|نفس الطلب|الطلب القديم|نفسو|أكملو|اكملو)$/i.test(text)) {
//       // استئناف — اعادة بناء السلة وانتقل لـ transfer_name
//       session.cart       = po.cart;
//       session.name       = po.name;
//       session.phone      = po.phone;
//       session.address    = po.address || '';
//       session.deliveryType = po.deliveryType;
//       session.deliveryFee  = po.deliveryFee || 0;
//       session.note       = po.note || '';
//       session.orderNum   = po.orderNum;
//       session.state      = 'transfer_name';
//       clearPendingOrder(from);
//       return `تمام! 😊 نكمل طلبك #${po.orderNum}

// ${pendingOrderSummary(po)}

// أرسل *الاسم اللي حوّلت منه* 👇

// بيانات التحويل:
// الاسم: *${STATE.settings.bankName}*
// البنك: *${STATE.settings.bank}*
// جوال: *${STATE.settings.bankPhone}*`;
//     }
//     if (/^(2|جديد|طلب جديد|بدي اطلب|اطلب)$/i.test(text)) {
//       clearPendingOrder(from);
//       session.state = null; session._pendingOrder = null;
//       return `تمام! 🛒 قولي شو بدك تطلب 😊`;
//     }
//     if (/^(3|الغاء|إلغاء|لا|لأ)$/i.test(text)) {
//       clearPendingOrder(from);
//       session.state = null; session._pendingOrder = null;
//       return `تم إلغاء الطلب القديم ✅ أهلاً بك في أي وقت 🌿`;
//     }
//     return `اختار:
// 1️⃣ أكمل التحويل
// 2️⃣ طلب جديد
// 3️⃣ إلغاء الطلب القديم`;
//   }

  // // ====== تتبع الطلب ======
  // const isTrack = /وين طلبي|وين الطلب|حالة الطلب|شو صار|طلع الطلب|تحرك الطلب|وصل طلبي/i.test(text)
  //   || /^#?\d{1,6}$/.test(text.trim());
  // if (isTrack) {
  //   const tOrd = (STATE.orders||[]).find(o=>o.customerPhone===from&&!['delivered','picked_up','cancelled'].includes(o.status));
  //   const stMap = {
  //     pending_payment:'⏳ انتظار تأكيد التحويل',
  //     payment_confirmed:'✅ تم تأكيد الدفع — قيد التجهيز',
  //     added_to_system:'📥 دخل للنظام — قيد التحضير',
  //     preparing:'👨‍🍳 قيد التحضير الآن',
  //     ready:'🔔 جاهز — ينتظر الديلفري',
  //     out_for_delivery:`🚗 في الطريق${tOrd?.driverName?' مع '+tOrd.driverName:''}`,
  //     ready_pickup:'🔔 جاهز للاستلام',
  //   };
  //   if (tOrd) return `📦 طلبك *#${tOrd.id}*\n${stMap[tOrd.status]||tOrd.status}\n💰 المجموع: *${tOrd.grandTotal||tOrd.total} ₪*`;
  //   return `ما عندنا طلب نشط لك حالياً 😊\nقولي شو بدك تطلب!`;
  // }

  // // سؤال عن الحساب
  // if (/كم الحساب|كم بيطلع|كم المبلغ|كم احول|كم بدفع|الحساب كم|بكم الطلب/.test(text)) {
  //   if (session.cart.length) {
  //     const total = cartTotal(session.cart) + (session.deliveryFee || 0);
  //     return `💰 حسابك: *${total} ₪*\n${cartText(session.cart)}${session.deliveryFee ? `\n+ توصيل: ${session.deliveryFee} ₪` : ''}\n\nأرسل *تأكيد* لإتمام الطلب 😊`;
  //   }
  //   return `ما في طلب حالي 😊 قولي شو بدك!`;
  // }

  // // وقت التحضير
  // if (/وقت|كم بياخذ|متى جاهز|بتوصل امتى|قديش بياخذ/.test(text)) {
  //   const t = STATE.settings.estimatedTime || 30;
  //   const ready = new Date(Date.now() + t * 60000);
  //   return `⏱️ وقت التحضير: *${t} دقيقة* (تقريباً ${ready.getHours().toString().padStart(2,'0')}:${ready.getMinutes().toString().padStart(2,'0')}) 😊`;
  // }

  // ====== PRIORITY 1: tryQuickOrder — دايماً أول شي ======
  // const hasNewlines = raw.includes('\n');
  // const looksLikeOrder = raw.length > 30 && /\d|[١٢٣٤٥٦٧٨٩]/.test(raw);
  // if (hasNewlines || looksLikeOrder) {
  //   const inOrdering = session.state === 'ordering' || session.state === null;
  //   const qr = tryQuickOrder(session, raw, inOrdering);
  //   if (qr) return qr;
  // }

  // ====== PRIORITY 1.5: اسم قسم ← عرض المنيو ======
  // لما يكتب "شاورما" أو "بيتزا" أو "مشروبات" — يعرض منيو القسم
  // const catQuery = detectCategoryQuery(text);
  // if (catQuery) {
  //   session.lastCategory = catQuery;
  //   return getMenuText(catQuery) + '\n\nقولي شو بدك تطلب من قائمتنا 😊';
  // }

  // ====== PRIORITY 1.8: تحيات واجتماعيات → رد لطيف ======
//   // "كيف حالك" / "شو اخبارك" / "كيف الاحوال" → يرد ويسأل عن الطلب
//   if (/^(كيف حالك|كيف الحال|كيف اخبارك|شو اخبارك|كيف الاحوال|عامل كيف|كيف عامل|ايش اخبارك|شو اخبارك|كيفك|كيفكم|كيف حالكم)[\s؟?!]*$/i.test(text)) {
//     return `الحمد لله بخير! 😊
// ${STATE.settings.welcome || 'شو بدك اليوم؟ 🌿'}`;
//   }
//   if (/^(صباح|مساء)/.test(text) && text.length < 20) {
//     const isM = /صباح/.test(text);
//     return `${isM ? 'صباح النور' : 'مساء النور'} 🌿
// أهلاً بك في ${STATE.settings.name}!
// شو بدك تطلب اليوم؟ 😊`;
//   }

  // ====== PRIORITY 2: الردود الثابتة ======
  // const hasOrderIntent = /بدي|عايز|اريد|أريد|اطلب/.test(text);
  // if (!session.state && !session.cart.length && !hasOrderIntent) {
  //   for (const r of STATE.replies) {
  //     if (!r.active) continue;
  //     if (r.keys.some(k => text.includes(k.toLowerCase()))) return r.text;
  //   }
  // }

  // ====== STATES ======
  if (!session.state) {
    // رقم قسم
    if (/^[1-6]$/.test(text)) {
      return getMenuText(['شاورما','ايطالي','ساندويش','سلطة','مشروبات','حلويات'][parseInt(text)-1]);
    }

    // طلب مركب (جملة فيها و)
    if (isComplex(text) || (isOrder(text) && text.includes(' و '))) {
      const result = handleComplexOrder(session, text);
      if (result) return result;
    }

    // رسالة طويلة أو فيها فاصلة
    if (raw.length > 25 && (raw.includes('،') || raw.includes(',') || isOrder(text))) {
      const qr = tryQuickOrder(session, raw);
      if (qr) return qr;
      const result = handleComplexOrder(session, text);
      if (result) return result;
    }

    // سؤال عن سعر/توفر → pending_item
    if (isQuestion(text)) {
      const q = raw.replace(/^(في|فيه|هل|عندكم|متوفر|في عندكم)\s*/i,'').replace(/[؟?]+$/,'').trim();
      const item = findItem(extractItemName(q||text)||q||raw);
      if (item) {
        if (!item.active) return buildUnavailableMsg(item.name, raw, item.cat);
        session.state = 'pending_item'; session.pendingItem = item; session.pendingQty = 1;
        session.lastItem = item.name; session.lastCategory = item.cat;
        return `${item.name} متوفر ✅ — *${item.price} ₪*\n\nبدك تطلبه؟ (نعم / لا)`;
      }
      // ما لقى صنف بالاسم → جرب ingredient/نكهة
      const ingResult = findByIngredient(q || raw);
      if (ingResult) {
        const list = ingResult.items.map(i => `• ${i.name} — ${i.price} ₪`).join('\n');
        return `عندنا هالأصناف فيها ${ingResult.ingredient}:\n${list}\n\nبدك تطلب أحدها؟ 😊`;
      }
    }

    // طلب صنف واحد
    if (isOrder(text) || /^\d/.test(text) || Object.keys(ARABIC_NUMS).some(k => text.startsWith(k + ' '))) {
      const qty = extractQty(text);
      const item = findItem(extractItemName(text));
      if (item) {
        if (!item.active) return buildUnavailableMsg(item.name, raw);
        session.state = 'ordering';
        addToCart(session, item, qty);
        return `تمام! أضفت ${qty}x ${item.name} 🛒\n${rand(CONFIRM_MSGS)}`;
      }
    }

    // بحث مباشر باسم الصنف
    const item = findItem(raw);
    if (item) {
      if (!item.active) return buildUnavailableMsg(item.name, raw);
      session.state = 'pending_item';
      session.pendingItem = item;
      session.pendingQty = extractQty(text);
      return `${item.name} — ${item.price} ₪ 😊\nبدك تطلبه ولا بس بدك السعر؟`;
    }

    // نية طلب عامة
    if (/بدي|عايز|اريد|أريد|اطلب|طلب/.test(text)) {
      session.state = 'ordering';
      return `تمام! 🛒 قولي شو بدك تطلب\nأرسل *تأكيد* لما تخلص 😊`;
    }

    // الردود الثابتة للجلسات النشطة
    for (const r of STATE.replies) {
      if (!r.active) continue;
      if (r.keys.some(k => text.includes(k.toLowerCase()))) return r.text;
    }

    return STATE.settings.defaultReply;
  }

  // ====== PENDING ITEM ======
  if (session.state === 'pending_item') {
    const item = session.pendingItem;
    const qty  = session.pendingQty || 1;
    const isYes = /^(نعم|آه|اه|اوك|ok|تمام|اضيف|يلا|ايوه|أيوه|ماشي|حلو|اطلبه|ضيفه|خذلي|yes|بدي|حاضر|انعم)$/i.test(text);
    if (isYes) {
      session.state='ordering'; addToCart(session,item,qty); session.pendingItem=null;
      return `تمام أضفت ${qty}x ${item.name}! 🛒\nشو كمان بدك؟ 😊`;
    }
    const isNo = /^(لا|لأ|لاء|لع|بس|مو|مش|no|بلاش|مش بدي|ما بدي|لا شكرا|بالعكس)$/i.test(text);
    if (isNo) {
      session.state='ordering'; session.pendingItem=null;
      return session.cart.length
        ? `اوكي! 😊\n🛒 سلتك:\n${cartText(session.cart)}\nالمجموع: *${cartTotal(session.cart)} ₪*\n\nشو بدك تضيف؟`
        : `اوكي! 😊 شو بدك تطلب؟`;
    }
    if (/كم سعره|بكام|بكم|سعره كم|السعر/i.test(text))
      return `${item.name} بـ*${item.price} ₪* 😊\n\nبدك تطلبه؟ (نعم / لا)`;
    const newItem = findItem(extractItemName(text)||raw);
    if (newItem && newItem.id !== item.id) {
      if (!newItem.active) return buildUnavailableMsg(newItem.name, raw, newItem.cat);
      session.state='ordering'; addToCart(session,item,qty); addToCart(session,newItem,extractQty(text)); session.pendingItem=null;
      return `تمام أضفت:\n• ${qty}x ${item.name}\n• ${extractQty(text)}x ${newItem.name}\nشو كمان؟ 😊`;
    }
    return `${item.name} — *${item.price} ₪*\n\nبدك تطلبه؟ اكتب *نعم* أو *لا* 😊`;
  }

  // ====== ORDERING ======
  if (session.state === 'ordering') {
    // لغة العامية: "لاء" = لا، "لأ" = لا
    const normalizedText = text.replace(/^لاء$/, 'لا').replace(/^لأ$/, 'لا');

    // إلغاء كامل للطلب
    if (/^(الغاء|إلغاء|كنسل|بطل|وقف|لا بدي|مش بدي طلب)$/.test(text)) {
      resetSession(from);
      return `تم إلغاء طلبك ❌\nأهلاً بك في أي وقت 🌿`;
    }

    if (/^(سلة|سلتي|طلبي|شو طلبت|شو في)$/.test(text)) {
      if (!session.cart.length) return `سلتك فاضية 😅`;
      return `🛒 *سلتك:*\n${cartText(session.cart)}\nالمجموع: *${cartTotal(session.cart)} ₪*\n\nأرسل *تأكيد* لإتمام الطلب 😊`;
    }

    // تأكيد: يجب أن يكون الرسالة كلها كلمة تأكيد — لا "لا تمام.هيك"
    const isConfirm = /^(تأكيد|تاكيد|موافق|خلص|كفاية|بس هيك|هيك بس)$/.test(text)
      || /^(نعم|آه|اه|اوك|ok|تمام)$/.test(text);
    if (isConfirm) {
      if (!session.cart.length) return `سلتك فاضية! 😅 قولي شو بدك`;
      session.state = 'delivery_type';
      return `${cartText(session.cart)}\n─────────────\nالمجموع: *${cartTotal(session.cart)} ₪*\n\nكيف بدك تستلم؟\n1️⃣ توصيل 🚚\n2️⃣ استلام من المطعم 🏪`;
    }

    if (isComplex(text) || text.includes(' و ')) {
      const result = handleComplexOrder(session, text, true);
      if (result) return result;
    }

    if (raw.includes('\n')) {
      // في ordering: نتحقق إذا كانت الأصناف الجديدة مختلفة عن السلة الحالية
      const qr = tryQuickOrder(session, raw, true); // inOrdering=true
      if (qr) return qr;
    }

    if (isQuestion(text)) {
      const item = findItem(extractItemName(text) || raw);
      if (item) return item.active ? `${item.name} بـ${item.price} ₪ 😊\nتحبني أضيفه؟` : `عذراً، *${item.name}* غير متوفر 😔`;
    }

    const qty = extractQty(text);
    const item = findItem(extractItemName(text) || raw);
    if (item) {
      if (!item.active) return buildUnavailableMsg(item.name, extractItemName(text)||raw);
      addToCart(session, item, qty);
      return `${rand(WAIT_MSGS)} أضفت ${qty}x ${item.name} ✅\n${cartText(session.cart)}\nالمجموع: ${cartTotal(session.cart)} ₪\n\n${rand(CONFIRM_MSGS)}`;
    }

    if (/^[1-6]$/.test(text))
      return getMenuText(['شاورما','ايطالي','ساندويش','سلطة','مشروبات','حلويات'][parseInt(text)-1]) + '\n\nأرسل *تأكيد* لما تخلص 😊';

    // كتب اسم قسم وهو في الطلب ← يعرض المنيو بدل "مش فاهم"
    const catQ2 = detectCategoryQuery(text);
    if (catQ2) {
      return getMenuText(catQ2) + '\n\nقولي شو بدك تطلب أضيفه على سلتك 😊';
    }
    if (/منيو|قائمة|اسعار/.test(text))
      return `1️⃣ الشاورما  2️⃣ الإيطالي  3️⃣ الساندويشات\n4️⃣ السلطات  5️⃣ المشروبات  6️⃣ الحلويات`;

    // سجّل + AI
    logUnknown(from, rawOriginal, {state:'ordering', cartItems:session.cart.length});
    if (GROQ_KEY) {
      try {
        const aiReply = await tryAIUnderstand(from, rawOriginal, session);
        if (aiReply) return aiReply;
      } catch(e) { console.log('⚠️ AI error:', e.message); }
    }
    return `مش فاهم "${rawOriginal}" 🤔\nقولي اسم الصنف أو *تأكيد* إذا خلصت`;
  }

  // ====== DELIVERY TYPE ======
  if (session.state === 'delivery_type') {
    if (/^1$|توصيل|ديليفري|بيتي|منزل/.test(text)) {
      session.deliveryType = 'توصيل';
      const profile = getCustomerProfile(from);
      if (profile?.address) {
        session.state = 'address_confirm';
        session.pendingAddress = profile.address;
        const oldFee = getDeliveryFee(profile.address);
        return `نفس عنوانك كالعادة؟ 📍\n*${profile.address}*\nتوصيل: ${oldFee} ₪\n\nأرسل *نعم* للتأكيد أو أرسل عنوانك الجديد`;
      }
      session.state = 'address';
      return `تمام! 🚚 أرسل عنوانك التفصيلي`;
    }
    if (/^2$|استلام|مطعم|بجي|برجع/.test(text)) {
      session.deliveryType = 'استلام'; session.deliveryFee = 0;
      const profile = getCustomerProfile(from);
      if (profile?.name) {
        session.name = profile.name; session.phone = profile.phone || '';
        session.state = profile.phone ? 'note' : 'phone';
        return profile.phone
          ? `تمام! 🏪 أهلاً ${profile.name}! ملاحظات؟ (أو أرسل *لا*)`
          : `تمام! 🏪 شو اسمك الكريم؟`;
      }
      session.state = 'name';
      return `تمام! 🏪 شو اسمك الكريم؟`;
    }
    return `1️⃣ توصيل للمنزل 🚚\n2️⃣ استلام من المطعم 🏪\nأرسل 1 أو 2`;
  }

  // تأكيد العنوان القديم للزبائن المتكررين
  if (session.state === 'address_confirm') {
    const profile = getCustomerProfile(from);
    if (/^(نعم|آه|اه|اوك|ok|تمام|صحيح|مزبوط|اه نفس)$/i.test(text)) {
      session.address = session.pendingAddress;
      session.deliveryFee = getDeliveryFee(session.address);
      session.pendingAddress = null;
      if (profile?.name) {
        session.name = profile.name; session.phone = profile.phone || '';
        session.state = profile.phone ? 'note' : 'phone';
        return profile.phone
          ? `تمام! 🛒 التوصيل: ${session.deliveryFee} ₪\nأهلاً ${profile.name}! هل عندك ملاحظات؟ (أو *لا*)`
          : `تمام! رسوم التوصيل ${session.deliveryFee} ₪\nشو اسمك الكريم؟ 😊`;
      }
      session.state = 'name';
      return `تمام! رسوم التوصيل: *${session.deliveryFee} ₪* 🚚\nشو اسمك الكريم؟ 😊`;
    }
    // الزبون بعث عنوان جديد
    session.address = rawOriginal;
    session.deliveryFee = getDeliveryFee(rawOriginal);
    session.pendingAddress = null;
    if (profile?.name) {
      session.name = profile.name; session.phone = profile.phone || '';
      session.state = profile.phone ? 'note' : 'phone';
      return profile.phone
        ? `تمام! التوصيل: *${session.deliveryFee} ₪* 🚚\nأهلاً ${profile.name}! ملاحظات؟ (أو *لا*)`
        : `تمام! التوصيل: *${session.deliveryFee} ₪* 🚚\nشو اسمك الكريم؟ 😊`;
    }
    session.state = 'name';
    return `تمام! التوصيل لـ${rawOriginal}: *${session.deliveryFee} ₪* 🚚\nشو اسمك الكريم؟ 😊`;
  }

  if (session.state === 'address') {
    session.address = rawOriginal;
    session.deliveryFee = getDeliveryFee(rawOriginal);
    const profileA = getCustomerProfile(from);
    if (profileA?.name) {
      session.name = profileA.name; session.phone = profileA.phone || '';
      session.state = profileA.phone ? 'note' : 'phone';
      return profileA.phone
        ? `تمام! التوصيل: *${session.deliveryFee} ₪* 🚚\nأهلاً ${profileA.name}! ملاحظات؟ (أو *لا*)`
        : `تمام! التوصيل: *${session.deliveryFee} ₪* 🚚\nشو اسمك؟ 😊`;
    }
    session.state = 'name';
    return `تمام! التوصيل لـ${rawOriginal}: *${session.deliveryFee} ₪* 🚚\nشو اسمك الكريم؟ 😊`;
  }

  if (session.state === 'name') {
    if (rawOriginal.length < 2 || rawOriginal.length > 50) return `الاسم غير واضح 😅 حاول مرة ثانية`;
    session.name = rawOriginal; session.state = 'phone';
    return `أهلاً ${rawOriginal}! 😊\nرقم هاتفك؟ 📞`;
  }

  if (session.state === 'phone') {
    const cleanPhone = rawOriginal.replace(/[\s\-]/g, '');
    if (!/^[\d\+]{7,15}$/.test(cleanPhone)) return `الرقم مش صحيح 😅 أدخل رقم هاتف صحيح 📞`;
    session.phone = cleanPhone; session.state = 'note';
    return `ممتاز! 😊\n\nهل عندك ملاحظات خاصة؟\n(مثال: زود الثلج، لا تحط بهارات)\n\nأو أرسل *لا* 👇`;
  }

  if (session.state === 'note') {
    session.note = /^(لا|لأ|لا يوجد|بدون|nothing|no|نو)$/i.test(text) ? '' : rawOriginal;
    session.state = 'confirm';
    const total = cartTotal(session.cart), grand = total + session.deliveryFee;
    const noteLine = session.note ? `\n📝 ملاحظات: ${session.note}` : '';
    return `📋 *ملخص طلبك*\n─────────────\n${cartText(session.cart)}\n─────────────\n${
      session.deliveryType === 'توصيل'
        ? `التوصيل (${session.address}): ${session.deliveryFee} ₪`
        : `استلام من المطعم 🏪`
    }\n*المجموع: ${grand} ₪*\n👤 ${session.name}  📞 ${session.phone}${noteLine}\n─────────────\n✅ *تأكيد*  ✏️ *تعديل*  ❌ *إلغاء*`;
  }

  if (session.state === 'confirm') {
    // أي رد إيجابي = تأكيد (صحيح، آه، ماشي، يلا، اوك، تمام، أي...)
    const isPositive = /^(تأكيد|تاكيد|موافق|صحيح|مزبوط|ماشي|يلا|خلص|نعم|آه|اه|أيوه|ايوه|اوك|ok|تمام|yes|يس|اي|أي|طيب|طب|انعم|مشي|امشي|بسرعة|بسرعه|ابعت|ارسل|روح|يعطيك)$/i.test(text)
      || text.length <= 4; // أي رد قصير جداً = موافقة

    if (isPositive && !/^(لا|لأ|لاء|لع|no|بطل|إلغاء|الغاء|كنسل|تعديل|غير)$/i.test(text)) {
      session.orderNum = getNextOrderNum(); // ترقيم يومي
      session.state = 'transfer_name';
      // احفظ الطلب كـ pending في الـ customerProfiles
      savePendingOrder(from, {
        cart: session.cart.map(i => ({...i})),
        name: session.name,
        phone: session.phone,
        address: session.address,
        deliveryType: session.deliveryType,
        deliveryFee: session.deliveryFee,
        note: session.note,
        orderNum: session.orderNum,
      });
      return `ممتاز! 🎉\n\nالدفع عبر التطبيق البنكي 💳\n\nبيانات التحويل:\nالاسم: *${STATE.settings.bankName}*\nالبنك: *${STATE.settings.bank}*\nجوال: *${STATE.settings.bankPhone}*\nIBAN: *${STATE.settings.iban}*\n\nبعد التحويل، أرسلي *الاسم اللي حوّلت منه* 👇`;
    }
    if (/تعديل|غير/.test(text)) {
      session.state = 'ordering';
      return `قولي شو بدك تعدل 😊\n${cartText(session.cart)}`;
    }
    if (/الغاء|إلغاء|كنسل/.test(text)) {
      clearPendingOrder(from);
      resetSession(from);
      return `تم الإلغاء ❌ أهلاً بك في أي وقت 🌿`;
    }
    return `✅ *تأكيد*  ✏️ *تعديل*  ❌ *إلغاء*`;
  }

  if (session.state === 'transfer_name') {
    if (rawOriginal.length < 2) return `أرسل الاسم اللي حوّلت منه 👇`;

    session.transferName = rawOriginal;
    session.paymentType = 'تحويل';

    // *** FIX: احفظ المعلومات قبل resetSession ***
    const customerName = session.name;
    const orderNum = session.orderNum;
    const order = saveOrder(session, 'pending_payment');
    const t = STATE.settings.estimatedTime || 30;

    addLog(`🛒 طلب #${orderNum} — ${customerName} — تحويل: ${rawOriginal}`);

    const deliveryInfo = session.deliveryType === 'توصيل'
      ? `📍 *إلى:* ${session.address}\n💸 *توصيل:* ${session.deliveryFee} ₪`
      : `🏪 *استلام من المطعم*`;
    const noteSection = session.note ? `\n📝 *ملاحظات:* ${session.note}` : '';

    const groupMsg =
`━━━━━━━━━━━━━━━━━━
🆕 *طلب جديد #${orderNum}*
━━━━━━━━━━━━━━━━━━
📋 *الأصناف:*
${cartText(session.cart)}
─────────────────
💰 *المجموع:* ${order.total} ₪
${deliveryInfo}
💵 *الإجمالي:* ${order.grandTotal} ₪
─────────────────
👤 *الاسم:* ${customerName}
📞 *الهاتف:* ${session.phone}
💳 *تحويل باسم:* ${rawOriginal}
⏱️ *وقت التحضير:* ${t} دقيقة${noteSection}
─────────────────
⚠️ ضع 👍 لتأكيد التحويل
━━━━━━━━━━━━━━━━━━`;

    const sentMsg = await sendToGroup(groupMsg);
    if (sentMsg) {
      pendingPayments[sentMsg.id._serialized] = {
        orderNum,
        customerPhone: from,
        name: customerName,
      };
    }

    clearPendingOrder(from); // الطلب اكتمل — امسح الـ pending
    resetSession(from); // بعد حفظ كل المعلومات

    return `شكراً ${customerName}! 😊\n\nتم استلام طلبك رقم *#${orderNum}*\nبعد تأكيد التحويل ستصلك رسالة فوراً ✅\n⏱️ وقت التحضير: ~${t} دقيقة`;
  }

  logUnknown(from, rawOriginal, {state:null, cartItems:0});
  // AI fallback
  if (GROQ_KEY) {
    try {
      const aiReply = await tryAIUnderstand(from, rawOriginal, session);
      if (aiReply) return aiReply;
    } catch(e) { console.log('⚠️ AI error:', e.message); }
  }
  // بدون AI — رد أذكى + تسجيل في unknowns
  const unknownReply = buildSmartUnknownReply(from, rawOriginal, session);
  if (!unknownReply) {
    // إذا ما بنى رد → سجّل كـ unknown
    logUnknown(from, rawOriginal, {state: session?.state||null, cartItems: session?.cart?.length||0});
  }
  return unknownReply || STATE.settings.defaultReply;
}

// ============================================================
// HTTP SERVER & API
// ============================================================
/** يمسح مجلد جلسة واتساب — مطلوب قبل أي ربط جديد */
function clearAuthFolder() {
  const dir = path.join(__dirname, 'baileys_auth');
  try {
    if (!fs.existsSync(dir)) return false;
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  } catch (e) {
    console.log('⚠️ تعذّر مسح baileys_auth:', e.message);
    return false;
  }
}

let currentQR = '';
let pairCode = '';        // كود الربط الحالي (8 خانات)
let pairCodeAt = 0;       // وقت توليده
let pairRequested = false; // منع تكرار الطلب في نفس الجلسة (تجنّب خطأ 429)
let CURRENT_USER = null; // المستخدم صاحب الطلب الجاري (يُضبط قبل كل handleAPI)

function linkPage(){
  return `<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a0e1a"><title>ربط واتساب — O2</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Cairo',system-ui,Tahoma,sans-serif;background:#0a0e1a;color:#e6edf3;
  min-height:100dvh;padding:16px calc(16px + env(safe-area-inset-left)) 40px}
.wrap{max-width:520px;margin:0 auto}
h1{font-size:20px;font-weight:800;margin:6px 0 4px}
h1 a{color:#6b7a99;font-size:13px;font-weight:600;text-decoration:none;margin-inline-start:8px}
.sub{color:#6b7a99;font-size:12.5px;margin-bottom:16px}
.card{background:#111827;border:1px solid #1f2937;border-radius:16px;padding:16px;margin-bottom:12px}
@media(min-width:480px){.card{padding:20px}}
.tabs{display:flex;gap:8px;margin-bottom:14px}
.tabs button{flex:1;padding:11px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;
  border-radius:10px;border:1px solid #1f2937;background:#0a0e1a;color:#6b7a99;min-height:46px}
.tabs button.on{background:#00d97e;color:#04150f;border-color:#00d97e}
label{display:block;font-size:12.5px;font-weight:700;color:#6b7a99;margin:10px 0 5px}
input{width:100%;padding:12px;font-size:16px;font-family:inherit;border-radius:10px;
  border:1px solid #1f2937;background:#0a0e1a;color:#e6edf3;direction:ltr;text-align:left}
input:focus{outline:2px solid #00d97e;outline-offset:-1px}
.btn{width:100%;margin-top:14px;padding:13px;font-size:15px;font-weight:700;font-family:inherit;
  border:0;border-radius:10px;background:#00d97e;color:#04150f;cursor:pointer;min-height:48px}
.btn.ghost{background:none;color:#e6edf3;border:1px solid #1f2937}
.btn.red{background:#3b1418;color:#ff8a80;border:1px solid #5b1f24}
.btn:disabled{opacity:.55;cursor:not-allowed}
.code{font-size:clamp(30px,10vw,46px);font-weight:800;letter-spacing:6px;text-align:center;
  color:#00d97e;background:#0a0e1a;border:2px dashed #00d97e55;border-radius:14px;
  padding:20px 10px;margin:6px 0 10px;direction:ltr;font-variant-numeric:tabular-nums;cursor:pointer}
.hint{font-size:12.5px;color:#6b7a99;line-height:1.9}
.hint b{color:#e6edf3}
.state{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;margin-bottom:10px}
.steps{margin-bottom:14px}
.step{display:flex;align-items:center;gap:9px;font-size:12.5px;padding:5px 0;color:#3d4a5c}
.step .ic{width:19px;height:19px;border-radius:50%;border:2px solid #1f2937;flex:0 0 auto;
  display:flex;align-items:center;justify-content:center;font-size:10px}
.step.done{color:#6b7a99}
.step.done .ic{background:#00d97e;border-color:#00d97e;color:#04150f}
.step.now{color:#e6edf3;font-weight:700}
.step.now .ic{border-color:#00d97e;animation:pulse 1.1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
.step .t{margin-inline-start:auto;font-size:11px;color:#3d4a5c;font-variant-numeric:tabular-nums}
.slow{background:#3b2a08;border:1px solid #5b471f;color:#ffd32a;padding:10px 12px;
  border-radius:9px;font-size:12px;line-height:1.8;margin-bottom:12px}
.dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
.ok{background:#00d97e}.wait{background:#ffd32a}.off{background:#ff4757}
img{display:block;margin:0 auto;border-radius:12px;border:6px solid #00d97e;max-width:100%}
.msg{font-size:13px;font-weight:600;padding:10px 13px;border-radius:10px;margin-top:10px;display:none}
.msg.e{background:#3b1418;color:#ff8a80}.msg.s{background:#0f2f22;color:#00d97e}
ol{margin:8px 20px 0;font-size:13px;color:#6b7a99;line-height:2}
</style></head><body><div class="wrap">
<h1>ربط واتساب <a href="/">← الداشبورد</a></h1>
<div class="sub">اختر طريقة ربط رقم البوت</div>

<div class="card">
  <div class="state"><span class="dot wait" id="dot"></span><span id="stateTxt">جاري القراءة…</span></div>
  <div class="steps" id="steps"></div>
  <div class="tabs">
    <button id="tab-pair" onclick="pick('pair')">🔢 كود من 8 خانات</button>
    <button id="tab-qr" onclick="pick('qr')">📷 رمز QR</button>
  </div>

  <div id="pane-pair" style="display:none">
    <label for="ph">رقم الواتساب (بصيغة دولية، أرقام فقط)</label>
    <input id="ph" inputmode="numeric" placeholder="970567743979">
    <div class="hint" style="margin-top:6px">بدون + أو مسافات أو شرطات. مثال فلسطين: <b>970</b> ثم الرقم بلا صفر البداية.</div>
    <button class="btn" id="genBtn" onclick="startPair()">توليد كود الربط</button>
    <div class="msg" id="msg"></div>
  </div>

  <div id="pane-qr" style="display:none">
    <div id="qrBox" class="hint">جاري تجهيز الرمز…</div>
    <button class="btn ghost" onclick="startQR()">إعادة توليد الرمز</button>
  </div>
</div>

<div class="card" id="codeCard" style="display:none">
  <div class="hint" style="text-align:center">اكتب هذا الكود في هاتفك — اضغط عليه لنسخه</div>
  <div class="code" id="codeBox" onclick="copyCode()">— — — —</div>
  <ol>
    <li>افتح واتساب على الهاتف</li>
    <li>الإعدادات ← <b>الأجهزة المرتبطة</b></li>
    <li>اضغط <b>ربط جهاز</b></li>
    <li>اضغط <b>الربط برقم الهاتف بدلاً من ذلك</b></li>
    <li>أدخل الكود أعلاه</li>
  </ol>
  <div class="hint" style="margin-top:10px">الكود صالح لدقائق قليلة. إن انتهى، اضغط «توليد كود الربط» من جديد.</div>
</div>

<div class="card">
  <div class="hint">فك الربط يمسح جلسة واتساب المحفوظة ويوقف البوت حتى تربط من جديد.</div>
  <button class="btn red" onclick="unlink()">🔌 فك الربط ومسح الجلسة</button>
</div>

<script>
var METHOD='qr';
function show(id,on){ document.getElementById(id).style.display = on?'':'none'; }
function say(t,cls){ var m=document.getElementById('msg'); m.textContent=t; m.className='msg '+cls; m.style.display=t?'block':'none'; }

function pick(m){
  METHOD=m;
  document.getElementById('tab-pair').classList.toggle('on', m==='pair');
  document.getElementById('tab-qr').classList.toggle('on', m==='qr');
  show('pane-pair', m==='pair'); show('pane-qr', m==='qr');
}

function copyCode(){
  var t=document.getElementById('codeBox').textContent.replace(/[^A-Za-z0-9]/g,'');
  if(navigator.clipboard) navigator.clipboard.writeText(t).then(function(){ say('نُسخ الكود ✅','s'); });
}

async function startPair(){
  var phone=document.getElementById('ph').value.replace(/\D/g,'');
  if(phone.length<8){ say('أدخل الرقم بصيغة دولية بالأرقام فقط','e'); return; }
  if(!confirm('سيُمسح الربط الحالي ويتوقف البوت حتى تُدخل الكود. متابعة؟')) return;
  var b=document.getElementById('genBtn'); b.disabled=true; b.textContent='جاري التوليد…';
  say('',''); 
  try{
    var r=await fetch('/api/bot/link',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({method:'pair',phone:phone})});
    var d=await r.json();
    if(!d.ok){ say(d.error||'تعذّر البدء','e'); }
    else say('جاري الاتصال بواتساب… سيظهر الكود خلال ثوانٍ','s');
  }catch(_){ say('لا يوجد اتصال بالخادم','e'); }
  b.disabled=false; b.textContent='توليد كود الربط';
}

async function startQR(){
  if(!confirm('سيُمسح الربط الحالي. متابعة؟')) return;
  await fetch('/api/bot/link',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({method:'qr'})});
}

async function unlink(){
  if(!confirm('فك الربط ومسح الجلسة نهائياً؟')) return;
  await fetch('/api/bot/unlink',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
}

var PHASES = [
  ['db',      'تحميل البيانات من Firebase'],
  ['starting','قراءة جلسة واتساب'],
  ['version', 'جلب نسخة واتساب ويب'],
  ['socket',  'الاتصال بخوادم واتساب'],
  ['ready',   'الرمز أو الكود جاهز'],
  ['open',    'مرتبط ✅'],
];

function renderSteps(d){
  var cur = d.connected ? 'open'
    : (d.pairCode || d.qrAvailable) ? 'ready'
    : !d.dbReady ? 'db'
    : (d.phase === 'code' || d.phase === 'qr') ? 'ready'
    : (d.phase || 'starting');
  var idx = PHASES.findIndex(function(p){ return p[0] === cur; });
  if(idx < 0) idx = 1;

  var html = PHASES.map(function(p, i){
    var cls = i < idx ? 'done' : (i === idx ? 'now' : '');
    var ic  = i < idx ? '✓' : (i === idx ? '' : '');
    var t   = (i === idx && d.phaseAgeSec) ? ('<span class="t">' + d.phaseAgeSec + 'ث</span>') : '';
    return '<div class="step ' + cls + '"><span class="ic">' + ic + '</span>' + p[1] + t + '</div>';
  }).join('');

  // تنبيه إن طالت المرحلة الحالية
  if(!d.connected && d.phaseAgeSec > 45){
    html = '<div class="slow">⏳ <b>المرحلة الحالية تأخذ وقتاً أطول من المعتاد.</b><br>'
      + 'الخطة المجانية في Render تحتاج حتى دقيقة للاستيقاظ بعد الخمول. '
      + 'إن تجاوزت دقيقتين راجع سجل Render.</div>' + html;
  }
  document.getElementById('steps').innerHTML = html;
}

async function poll(){
  try{
    var r=await fetch('/api/bot/link');
    if(r.status===401){ location.href='/login'; return; }
    var d=await r.json();
    var dot=document.getElementById('dot'), st=document.getElementById('stateTxt');
    if(d.connected){ dot.className='dot ok'; st.textContent='متصل ويعمل ✅'; }
    else if(d.pairCode||d.qrAvailable){ dot.className='dot wait'; st.textContent='بانتظار إتمام الربط…'; }
    else { dot.className='dot off'; st.textContent='غير مرتبط'; }

    renderSteps(d);
    if(!window.__picked){ pick(d.method||'qr'); if(d.phone) document.getElementById('ph').value=d.phone; window.__picked=true; }

    show('codeCard', !!d.pairCode);
    if(d.pairCode) document.getElementById('codeBox').textContent=d.pairCode;

    if(METHOD==='qr'){
      var box=document.getElementById('qrBox');
      if(d.connected) box.innerHTML='<div class="hint">مرتبط بالفعل — لا حاجة لرمز.</div>';
      else if(d.qrAvailable) box.innerHTML='<img src="/qr-img?t='+Date.now()+'" width="260" height="260" alt="رمز QR">';
      else box.innerHTML='<div class="hint">جاري تجهيز الرمز…</div>';
    }
  }catch(_){ }
}
poll(); setInterval(poll, 3000);
</script>
</div></body></html>`;
}

function loginPage(){
  return `<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a0e1a"><title>دخول — مطعم O2</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Cairo',system-ui,Tahoma,sans-serif;background:#0a0e1a;color:#e6edf3;
  min-height:100dvh;display:grid;place-items:center;padding:20px}
.box{background:#111827;border:1px solid #1f2937;border-radius:20px;padding:28px 22px;width:100%;max-width:390px}
@media(min-width:480px){.box{padding:34px 30px}}
h1{font-size:23px;font-weight:800;text-align:center;color:#00d97e}
.sub{text-align:center;color:#8b98a5;font-size:12.5px;margin:4px 0 22px}
label{display:block;font-size:12.5px;font-weight:700;color:#8b98a5;margin:12px 0 5px}
input{width:100%;padding:12px;font-size:16px;font-family:inherit;border-radius:10px;
  border:1px solid #1f2937;background:#0a0e1a;color:#e6edf3}
input:focus{outline:2px solid #00d97e;outline-offset:-1px}
button{width:100%;margin-top:20px;padding:13px;font-size:15px;font-weight:700;font-family:inherit;
  border:0;border-radius:10px;background:#00d97e;color:#062b1c;cursor:pointer;min-height:48px}
button:disabled{opacity:.6}
.err{background:#3b1418;color:#ff8a80;border:1px solid #5b1f24;padding:10px 13px;
  border-radius:10px;font-size:13px;font-weight:600;margin-bottom:8px;display:none}
</style></head><body>
<form class="box" onsubmit="go(event)">
  <h1>مطعم O2</h1>
  <div class="sub">لوحة التحكم</div>
  <div class="err" id="err"></div>
  <label for="u">اسم المستخدم</label>
  <input id="u" autocomplete="username" required autofocus>
  <label for="p">كلمة المرور</label>
  <input id="p" type="password" autocomplete="current-password" required>
  <button id="btn" type="submit">دخول</button>
  <div id="dbwait" style="display:none;margin-top:14px;padding:12px 14px;border-radius:10px;
       font-size:12.5px;line-height:1.9;text-align:start"></div>
</form>
<script>
// يتابع جاهزية القاعدة — يمنع رسالة «كلمة مرور خاطئة» المضلّلة
function esc(x){ return String(x==null?'':x).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

async function checkDb(){
  try{
    var r = await fetch('/api/dbstatus');
    var d = await r.json();
    var box = document.getElementById('dbwait');
    var btn = document.getElementById('btn');
    if(d.ready){
      box.style.display='none';
      btn.disabled=false; btn.textContent='دخول';
      return;
    }
    btn.disabled=true; btn.textContent='بانتظار البيانات…';
    box.style.display='block';
    if(d.fatal){
      box.style.background='#3b1418'; box.style.border='1px solid #5b1f24'; box.style.color='#ffb4ad';
      box.innerHTML = '<b style="color:#ff6b60;font-size:13.5px">⛔ '+esc(d.short)+'</b>'
        + '<div style="margin-top:8px">' + d.steps.map(function(x){return esc(x);}).join('<br>') + '</div>'
        + '<div style="margin-top:8px;font-size:11px;opacity:.7">'+esc(d.error)+'</div>';
    } else {
      box.style.background='#3b2a08'; box.style.border='1px solid #5b471f'; box.style.color='#ffd32a';
      box.innerHTML = '⏳ <b>النظام يحمّل بياناته من Firebase…</b><br>'
        + 'الدخول سيعمل تلقائياً بعد اكتمال التحميل.';
    }
  }catch(_){}
}
checkDb(); setInterval(checkDb, 4000);

async function go(e){
  e.preventDefault();
  var btn=document.getElementById('btn'), err=document.getElementById('err');
  btn.disabled=true; btn.textContent='جاري الدخول…'; err.style.display='none';
  try{
    var r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username:document.getElementById('u').value,password:document.getElementById('p').value})});
    var d=await r.json();
    if(d.ok){ location.href='/'; return; }
    err.textContent=d.error||'تعذّر الدخول'; err.style.display='block';
    if(d.dbNotReady) checkDb();
  }catch(_){ err.textContent='لا يوجد اتصال بالخادم'; err.style.display='block'; }
  btn.disabled=false; btn.textContent='دخول';
}
</script></body></html>`;
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (url === '/ping') { res.writeHead(200); res.end('ok'); return; }
  if (url === '/qr-img') {
    if (!currentQR) { res.writeHead(404); res.end(); return; }
    QRCode.toBuffer(currentQR, {width:320, margin:1}, (err, buf) => {
      if (err) { res.writeHead(500); res.end(); return; }
      res.writeHead(200, {'Content-Type':'image/png','Cache-Control':'no-store'});
      res.end(buf);
    });
    return;
  }

  if (url === '/qr') {
    if (!currentQR) {
      res.writeHead(200, {'Content-Type':'text/html;charset=utf-8'});
      res.end('<html><head><meta charset="utf-8"><meta http-equiv="refresh" content="3"><style>body{font-family:Arial;text-align:center;padding:50px;background:#0a0e1a;color:#fff}</style></head><body><h2>⏳ جاري التحميل...</h2></body></html>');
      return;
    }
    QRCode.toDataURL(currentQR, {width:300}, (err, url2) => {
      res.writeHead(200, {'Content-Type':'text/html;charset=utf-8'});
      res.end(`<html><head><meta charset="utf-8"><meta http-equiv="refresh" content="55"><style>body{font-family:Arial;text-align:center;padding:30px;background:#0a0e1a;color:#fff}img{border:6px solid #25D366;border-radius:12px;margin:20px}h2{color:#25D366}</style></head><body><h2>📱 امسح الكود بواتساب</h2><img src="${url2}" width="280"/><p>واتساب ← الأجهزة المرتبطة ← ربط جهاز</p></body></html>`);
    });
    return;
  }

  // ─── عرض صورة مرفوعة ─────────────────────────────────────
  const imgMatch = url.match(/^\/api\/img\/([A-Za-z0-9_-]{6,40})(?:\.\w+)?$/);
  if (imgMatch && method === 'GET') {
    if (!IMG_COL) { res.writeHead(503); res.end(); return; }
    IMG_COL.doc(imgMatch[1]).get().then((snap) => {
      if (!snap.exists) { res.writeHead(404, {'Content-Type':'text/plain'}); res.end('not found'); return; }
      const d = snap.data();
      const buf = Buffer.from(d.data, 'base64');
      res.writeHead(200, {
        'Content-Type': d.contentType || 'image/jpeg',
        'Content-Length': buf.length,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(buf);
    }).catch((e) => { console.log('⚠️ img:', e.message); res.writeHead(500); res.end(); });
    return;
  }

  // ─── حالة قاعدة البيانات (متاحة بلا دخول) ────────────────
  if (url === '/api/dbstatus') {
    const why = stateLoaded ? null : explainFirebaseError(loadError);
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({
      ready: stateLoaded,
      error: loadError || '',
      short: why ? why.short : '',
      steps: why ? why.steps : [],
      fatal: why ? why.fatal : false,
    }));
    return;
  }

  // ─── صفحة الدخول ─────────────────────────────────────────
  if (url === '/login' && method === 'GET') {
    res.writeHead(200, {'Content-Type':'text/html;charset=utf-8'});
    res.end(loginPage());
    return;
  }
  if (url === '/logout') {
    res.writeHead(302, {'Location':'/login', 'Set-Cookie': auth.clearCookieHeader()});
    res.end();
    return;
  }

  // ─── صفحة ربط واتساب ──────────────────────────────────────
  if (url === '/link') {
    if (!auth.userFromReq(req)) { res.writeHead(302, {'Location':'/login'}); res.end(); return; }
    res.writeHead(200, {'Content-Type':'text/html;charset=utf-8'});
    res.end(linkPage());
    return;
  }

  // ─── حارس الدخول للداشبورد ────────────────────────────────
  if (url === '/' || url === '/dashboard') {
    if (!auth.userFromReq(req)) {
      res.writeHead(302, {'Location':'/login'});
      res.end();
      return;
    }
  }

  if (url === '/' || url === '/dashboard') {
    const dashPath = path.join(__dirname, 'dashboard.html');
    if (fs.existsSync(dashPath)) {
      res.writeHead(200, {'Content-Type':'text/html;charset=utf-8'});
      res.end(fs.readFileSync(dashPath));
    } else {
      res.writeHead(200, {'Content-Type':'text/html;charset=utf-8'});
      res.end(`<html><body style="font-family:Arial;text-align:center;padding:50px;background:#0a0e1a;color:#fff"><h2>${STATE.settings.name} ✅</h2><a href="/qr" style="background:#25D366;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none">عرض QR Code</a></body></html>`);
    }
    return;
  }

  if (url.startsWith('/api')) {
    let body = '';
    let tooBig = false;
    req.on('data', chunk => {
      if (tooBig) return;
      body += chunk;
      // 1.5 ميغابايت يكفي لأكبر صورة مسموحة (600 ك.ب + ترميز base64)
      if (body.length > 1.5 * 1024 * 1024) {
        tooBig = true;
        res.writeHead(413, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'حجم الطلب كبير جداً'}));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooBig) return;
      let parsed;
      try { parsed = body ? JSON.parse(body) : {}; }
      catch(e) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'Invalid JSON: ' + e.message}));
        return;
      }

      // ─── تسجيل الدخول والخروج ───────────────────────────
      if (url === '/api/auth/login' && method === 'POST') {
        // البيانات لم تُحمَّل ⇒ لا حسابات في الذاكرة. رسالة صادقة بدل
        // «كلمة المرور غير صحيحة» التي كانت تُوهم أن الحساب ضاع.
        if (!stateLoaded) {
          res.writeHead(503, {'Content-Type':'application/json'});
          res.end(JSON.stringify({
            error: 'النظام لم يُحمّل بياناته بعد من Firebase — انتظر ثوانٍ وأعد المحاولة.',
            dbNotReady: true, detail: loadError || '',
          }));
          return;
        }
        const u = auth.login(parsed.username, parsed.password);
        if (!u) {
          res.writeHead(401, {'Content-Type':'application/json'});
          res.end(JSON.stringify({error:'اسم المستخدم أو كلمة المرور غير صحيحة'}));
          return;
        }
        auth.audit(u, 'auth.login', 'لوحة التحكم', '', 'dashboard');
        res.writeHead(200, {'Content-Type':'application/json', 'Set-Cookie': auth.cookieHeader(auth.issue(u))});
        res.end(JSON.stringify({ok:true, user: auth.publicUser(u)}));
        return;
      }
      if (url === '/api/auth/logout') {
        res.writeHead(200, {'Content-Type':'application/json', 'Set-Cookie': auth.clearCookieHeader()});
        res.end(JSON.stringify({ok:true}));
        return;
      }

      // ─── التحقق من الهوية والصلاحية ─────────────────────
      const me = auth.userFromReq(req);
      if (url === '/api/auth/me') {
        res.writeHead(me ? 200 : 401, {'Content-Type':'application/json'});
        res.end(JSON.stringify(me ? {ok:true, user: auth.publicUser(me)} : {error:'غير مسجّل'}));
        return;
      }
      if (!me) {
        res.writeHead(401, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'يجب تسجيل الدخول', login:true}));
        return;
      }
      const needed = auth.permFor(url, method, parsed);
      if (needed && !auth.can(me, needed)) {
        res.writeHead(403, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'حسابك لا يملك صلاحية هذا الإجراء'}));
        return;
      }
      CURRENT_USER = me; // يستخدمه handleAPI لتسجيل من قام بالتغيير

      handleAPI(url, method, parsed, res).catch(e => {
        if (!res.writableEnded) {
          res.writeHead(500, {'Content-Type':'application/json'});
          res.end(JSON.stringify({error: e.message}));
        }
      });
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

/** يقبل روابط http/https فقط — يمنع javascript: و data: */
function cleanImageUrl(raw) {
  const u = String(raw || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) return '';
  if (u.length > 500) return '';
  return u;
}

async function handleAPI(url, method, body, res) {
  const json = (data, code = 200) => {
    if (res.writableEnded) return;
    res.writeHead(code, {'Content-Type':'application/json'});
    res.end(JSON.stringify(data));
  };

  // ---- READ ----
  if (url === '/api/state'  && method === 'GET') return json(STATE);
  if (url === '/api/status' && method === 'GET') return json({
      dbReady: stateLoaded, dbError: loadError,
    waStats: WA_STATS, waRetries,
    fbProject: FB_PROJECT_ID,
    imageBaseUrl: STATE.settings.imageBaseUrl || '',
    botConnected: STATE.botConnected,
    transferMode: STATE.settings.transferMode,
    botActive: STATE.settings.botActive,
    unknownsCount: (STATE.unknowns||[]).filter(u=>u.status==='new').length,
    queueCount: STATE.queue.length,
    ordersCount: STATE.orders.length,
    itemsCount: STATE.items.filter(i => i.active).length,
    activeSessions: Object.keys(sessions).length,
    qrAvailable: !!currentQR,
    pendingOrdersCount: Object.keys(STATE.pendingOrders || {}).length,
  });
  if (url === '/api/orders' && method === 'GET') return json(STATE.orders);
  if (url === '/api/logs'   && method === 'GET') return json(STATE.logs);
  if (url === '/api/queue'  && method === 'GET') return json(STATE.queue);

  // ---- الحسابات ----
  if (url === '/api/users' && method === 'GET')
    return json(auth.users().map(auth.publicUser));

  const userMatch = url.match(/^\/api\/users\/([\w-]+)$/);
  if (userMatch && method === 'PUT') {
    const target = auth.byId(userMatch[1]);
    if (!target) return json({error:'not found'}, 404);
    auth.updateUser(target.id, {
      displayName: body.displayName, username: body.username,
      whatsappNumber: body.whatsappNumber, active: body.active,
    });
    if (body.role && body.role !== target.role) {
      const rr = auth.setRole(target.id, body.role, CURRENT_USER ? CURRENT_USER.id : null);
      if (rr.error) return json({error: rr.error}, 400);
      auth.audit(CURRENT_USER, 'user.update', target.displayName,
        `تغيير الدور إلى ${auth.roleLabel(body.role)}`);
    }
    auth.audit(CURRENT_USER, 'user.update', target.displayName, 'تحديث بيانات الحساب');
    if (body.password && String(body.password).length >= 6) {
      auth.setPassword(target.id, body.password);
      auth.audit(CURRENT_USER, 'user.password', target.displayName, 'تغيير كلمة المرور');
    }
    return json({ok:true, user: auth.publicUser(auth.byId(target.id))});
  }

  if (url === '/api/users' && method === 'POST') {
    const r = auth.createUser(body);
    if (r.error) return json({error: r.error}, 400);
    auth.audit(CURRENT_USER, 'user.create', r.user.displayName,
      `حساب جديد بدور ${auth.roleLabel(r.user.role)}`);
    return json({ok: true, user: auth.publicUser(r.user)});
  }

  if (userMatch && method === 'DELETE') {
    const r = auth.deleteUser(userMatch[1], CURRENT_USER ? CURRENT_USER.id : null);
    if (r.error) return json({error: r.error}, 400);
    auth.audit(CURRENT_USER, 'user.delete', r.displayName, 'حذف الحساب');
    return json({ok: true});
  }

  // ---- سجل التغييرات ----
  if (url === '/api/audit' && method === 'GET')
    return json({ entries: auth.auditList({limit:300}), stats: auth.auditStats() });

  // ---- تبديل توفّر قسم كامل ----
  const catToggle = url.match(/^\/api\/cats\/toggle$/);
  if (catToggle && method === 'POST') {
    const cat = String(body.cat || '');
    const active = !!body.active;
    const affected = STATE.items.filter(i => i.cat === cat && i.active !== active);
    const stamp = CURRENT_USER ? CURRENT_USER.displayName : 'النظام';
    for (const it of affected) {
      it.active = active;
      it.updatedBy = stamp;
      it.updatedRole = CURRENT_USER ? CURRENT_USER.role : 'system';
      it.updatedAt = new Date().toISOString();
    }
    await saveStateNow();
    if (affected.length) {
      auth.audit(CURRENT_USER, active ? 'category.open' : 'category.close', cat,
        `${active ? 'تفعيل' : 'إغلاق'} ${affected.length} صنف`);
      addLog(`${active ? '✅' : '🚫'} ${cat}: ${affected.length} صنف — ${stamp}`);
    }
    return json({ok:true, affected: affected.length});
  }

  // ---- الرسائل المُهملة ولماذا ----
  if (url === '/api/dropped' && method === 'GET') {
    return json({
      dropped: DROPPED.slice(0, 25),
      settings: {
        botActive:      STATE.settings.botActive,
        requireTrigger: STATE.settings.requireTrigger,
        browseOnly:     STATE.settings.browseOnly,
        triggerWords:   STATE.settings.triggerWords || [],
      },
    });
  }

  // ---- رفع صورة من الجهاز ----
  if (url === '/api/images' && method === 'POST') {
    if (!IMG_COL) return json({error:'تخزين الصور غير مهيأ'}, 503);
    const raw = String(body.dataUrl || '');
    const m = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return json({error:'صيغة غير مدعومة — استخدم JPG أو PNG أو WebP'}, 400);

    const bytes = Buffer.from(m[2], 'base64');
    const MAX = 600 * 1024;   // مستند Firestore حده 1 ميغابايت، وbase64 يضخّم 33%
    if (bytes.length > MAX) {
      return json({error:`الصورة كبيرة (${(bytes.length/1024).toFixed(0)} ك.ب). الحد ${MAX/1024} ك.ب`}, 413);
    }

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try {
      await IMG_COL.doc(id).set({
        data: m[2],
        contentType: m[1],
        size: bytes.length,
        name: String(body.name || '').slice(0, 80),
        at: new Date().toISOString(),
        by: CURRENT_USER ? CURRENT_USER.displayName : 'النظام',
      });
    } catch (e) {
      console.log('⚠️ رفع صورة:', e.message);
      return json({error:'تعذّر الحفظ: ' + e.message}, 500);
    }

    auth.audit(CURRENT_USER, 'image.upload', body.name || 'صورة', `${(bytes.length/1024).toFixed(0)} ك.ب`);
    addLog(`🖼️ رُفعت صورة (${(bytes.length/1024).toFixed(0)} ك.ب) — ${CURRENT_USER ? CURRENT_USER.displayName : ''}`);
    return json({ ok: true, id, url: '/api/img/' + id, size: bytes.length });
  }

  // ---- ربط واتساب: QR أو كود ----
  if (url === '/api/bot/link' && method === 'GET') {
    const registered = !!(waSocket && waSocket.authState && waSocket.authState.creds && waSocket.authState.creds.registered);
    return json({
      method: STATE.settings.linkMethod || 'qr',
      phone: STATE.settings.pairPhone || '',
      connected: STATE.botConnected,
      registered,
      qrAvailable: !!currentQR,
      pairCode: pairCode ? (pairCode.match(/.{1,4}/g) || [pairCode]).join('-') : '',
      pairCodeAgeSec: pairCode ? Math.floor((Date.now() - pairCodeAt) / 1000) : 0,
      phase: WA_PHASE.name,
      phaseLabel: WA_PHASE.label,
      phaseAgeSec: Math.floor((Date.now() - WA_PHASE.at) / 1000),
      elapsedSec: WA_PHASE.startedAt ? Math.floor((Date.now() - WA_PHASE.startedAt) / 1000) : 0,
      dbReady: stateLoaded,
    });
  }

  if (url === '/api/bot/link' && method === 'POST') {
    const wanted = body.method === 'pair' ? 'pair' : 'qr';
    const phone  = String(body.phone || '').replace(/\D/g, '');
    if (wanted === 'pair' && phone.length < 8)
      return json({error: 'أدخل رقم الواتساب بصيغة دولية بالأرقام فقط، مثل 970567743979'}, 400);

    STATE.settings.linkMethod = wanted;
    STATE.settings.pairPhone  = phone;
    saveState();
    auth.audit(CURRENT_USER, 'settings.edit', 'ربط واتساب',
      wanted === 'pair' ? `التبديل إلى كود الربط (${phone})` : 'التبديل إلى QR');

    // كود الربط لا يُطلب إلا لجلسة غير مسجّلة — نمسح الجلسة القديمة
    const cleared = clearAuthFolder();
    pairCode = ''; currentQR = ''; pairRequested = false;
    STATE.botConnected = false;
    addLog(`🔗 إعادة ربط بطريقة ${wanted === 'pair' ? 'الكود' : 'QR'}${cleared ? ' (مُسحت الجلسة السابقة)' : ''}`);
    setTimeout(() => { try { startBaileys({force:true}); } catch(e){ console.log(e.message); } }, 1200);
    return json({ok: true, method: wanted, phone, cleared});
  }

  // فك الربط: مسح الجلسة وإعادة التشغيل
  if (url === '/api/bot/unlink' && method === 'POST') {
    try { if (waSocket) await waSocket.logout(); } catch(e) { /* غير متصل */ }
    const cleared = clearAuthFolder();
    pairCode = ''; currentQR = ''; pairRequested = false;
    STATE.botConnected = false;
    auth.audit(CURRENT_USER, 'settings.edit', 'ربط واتساب', 'فك الربط ومسح الجلسة');
    addLog('🔌 فُك الربط ومُسحت الجلسة');
    setTimeout(() => { try { startBaileys({force:true}); } catch(e){ console.log(e.message); } }, 1500);
    return json({ok: true, cleared});
  }

  // ---- BOT CONTROL ----
  if (url === '/api/bot/restart' && method === 'POST') {
    addLog('🔄 إعادة تشغيل من الداشبورد');
    STATE.botConnected = false;
    // كان يمرّر رقماً لدالة تتوقّع نصاً، فلا يُعاد الاتصال فعلياً
    setTimeout(() => { try { startBaileys({force:true}); } catch(e){ console.log(e.message); } }, 800);
    return json({ok: true});
  }
  if (url === '/api/bot/disconnect' && method === 'POST') {
    addLog('⏹️ قطع الاتصال من الداشبورد');
    STATE.botConnected = false;
    killSocket();
    if (waRetryTimer) { clearTimeout(waRetryTimer); waRetryTimer = null; }
    waConnecting = false;
    return json({ok: true});
  }

  // ---- SETTINGS ----
  // ── إيقاف/تشغيل البوت بدون قطع الاتصال ──
  if (url === '/api/bot/toggle' && method === 'POST') {
    const wasActive = STATE.settings.botActive;
    STATE.settings.botActive = body.active !== undefined ? !!body.active : !wasActive;
    saveState();
    addLog(STATE.settings.botActive ? '▶️ البوت شغّال' : '⏸️ البوت موقوف');
    return json({ ok: true, botActive: STATE.settings.botActive });
  }

  if (url === '/api/settings' && method === 'POST') {
    Object.assign(STATE.settings, body);
    saveState();
    addLog('⚙️ تم تحديث الإعدادات');
    return json({ok: true});
  }

  // ---- ORDERS ----
  const orderMatch = url.match(/^\/api\/orders\/(\d+)\/status$/);
  if (orderMatch && method === 'PUT') {
    const order = STATE.orders.find(o => o.id === parseInt(orderMatch[1]));
    if (!order) return json({error: 'not found'}, 404);
    order.status = body.status;
    saveState();
    addLog(`📦 طلب #${order.id} → ${body.status}`);
    return json({ok: true});
  }

  // إرسال رسالة للزبون من الداشبورد
  const orderMsgMatch = url.match(/^\/api\/orders\/(\d+)\/message$/);
  if (orderMsgMatch && method === 'POST') {
    const order = STATE.orders.find(o => o.id === parseInt(orderMsgMatch[1]));
    if (!order) return json({error: 'not found'}, 404);
    if (!waSocket) return json({error:'البوت غير متصل بواتساب'}, 503);
    waSocket.sendMessage(order.customerPhone, { text: body.text || '' }).then(() => {
      json({ok: true});
    }).catch(e => {
      json({error: e.message}, 500);
    });
    return;
  }

  // ---- ITEMS ----
  if (url === '/api/items' && method === 'POST') {
    if (!body.name || !body.cat || body.price === undefined) return json({error: 'name/cat/price required'}, 400);
    const item = {
      id: STATE.nextId++,
      name: body.name,
      cat: body.cat,
      price: Number(body.price),
      active: true,
      keys: body.keys || [body.name.toLowerCase()],
      image: cleanImageUrl(body.image),
    };
    item.updatedBy   = CURRENT_USER ? CURRENT_USER.displayName : 'النظام';
    item.updatedRole = CURRENT_USER ? CURRENT_USER.role : 'system';
    item.updatedAt   = new Date().toISOString();
    STATE.items.push(item);
    saveState();
    auth.audit(CURRENT_USER, 'item.create', item.name, `صنف جديد بسعر ${item.price} ₪`);
    addLog(`➕ أُضيف: ${item.name} — ${item.updatedBy}`);
    return json({ok: true, item});
  }
  const itemMatch = url.match(/^\/api\/items\/(\d+)$/);
  if (itemMatch && method === 'PUT') {
    const idx = STATE.items.findIndex(i => i.id === parseInt(itemMatch[1]));
    if (idx === -1) return json({error: 'not found'}, 404);
    const it     = STATE.items[idx];
    const before = { name: it.name, price: it.price, cat: it.cat, active: it.active };
    if (body.price !== undefined) body.price = Number(body.price);
    if (body.image !== undefined) body.image = cleanImageUrl(body.image);
    Object.assign(it, body);

    // ختم: من غيّر ومتى — يظهر لكل الحسابات
    it.updatedBy   = CURRENT_USER ? CURRENT_USER.displayName : 'النظام';
    it.updatedRole = CURRENT_USER ? CURRENT_USER.role : 'system';
    it.updatedAt   = new Date().toISOString();
    // تغيير التوفّر حرج: نحفظ فوراً بدل انتظار مؤقت الثلاث ثوانٍ،
    // فإيقاف الخدمة خلالها كان يبتلع التغيير ويعيد الصنف مُفعّلاً
    await saveStateNow();

    if (before.active !== it.active) {
      auth.audit(CURRENT_USER, it.active ? 'menu.open' : 'menu.close', it.name,
        it.active ? 'تفعيل الصنف' : 'إغلاق الصنف');
      addLog(`${it.active ? '✅ فُعّل' : '🚫 أُغلق'}: ${it.name} — ${it.updatedBy}`);
      notifyStaffAvailability(it, it.updatedBy).catch(()=>{});
    } else {
      const ch = [];
      if (before.name  !== it.name)  ch.push(`الاسم: ${before.name} ← ${it.name}`);
      if (before.price !== it.price) ch.push(`السعر: ${before.price} ← ${it.price} ₪`);
      if (before.cat   !== it.cat)   ch.push(`القسم: ${before.cat} ← ${it.cat}`);
      auth.audit(CURRENT_USER, 'item.edit', it.name, ch.join(' | ') || 'تحديث بيانات');
      addLog(`✏️ عُدّل: ${it.name} — ${it.updatedBy}`);
    }
    return json({ok: true, item: it});
  }
  if (itemMatch && method === 'DELETE') {
    const item = STATE.items.find(i => i.id === parseInt(itemMatch[1]));
    if (!item) return json({error: 'not found'}, 404);
    const delId = parseInt(itemMatch[1]);
    STATE.items = STATE.items.filter(i => i.id !== delId);
    if (!Array.isArray(STATE.deletedItemIds)) STATE.deletedItemIds = [];
    if (!STATE.deletedItemIds.includes(delId)) STATE.deletedItemIds.push(delId);
    await saveStateNow(); // حفظ فوري — لا ننتظر المؤقت
    auth.audit(CURRENT_USER, 'item.delete', item.name, 'حذف الصنف نهائياً');
    addLog(`🗑️ حُذف: ${item.name}`);
    return json({ok: true});
  }

  // ---- REPLIES ----
  if (url === '/api/replies' && method === 'POST') {
    const reply = {id: STATE.nextId++, ...body, active: true};
    STATE.replies.push(reply);
    saveState();
    return json({ok: true, reply});
  }
  if (url === '/api/replies' && method === 'POST') {
    const reply = { id: STATE.nextId++, keys: body.keys||[], text: body.text||'', active: body.active !== false };
    STATE.replies.push(reply);
    saveState(); addLog('💬 رد جديد: ' + (body.keys||[]).join('، '));
    return json({ ok: true, reply });
  }

  const replyMatch = url.match(/^\/api\/replies\/(\d+)$/);
  if (replyMatch && method === 'PUT') {
    const idx = STATE.replies.findIndex(r => r.id === parseInt(replyMatch[1]));
    if (idx === -1) return json({error: 'not found'}, 404);
    Object.assign(STATE.replies[idx], body);
    saveState();
    return json({ok: true});
  }
  if (replyMatch && method === 'DELETE') {
    const r = STATE.replies.find(r => r.id === parseInt(replyMatch[1]));
    if (!r) return json({error: 'not found'}, 404);
    STATE.replies = STATE.replies.filter(r => r.id !== parseInt(replyMatch[1]));
    saveState();
    return json({ok: true});
  }

  // ---- CATEGORIES ----
  const catMatch = url.match(/^\/api\/categories\/(.+)$/);
  if (catMatch && method === 'PUT') {
    const cat = STATE.categories.find(c => c.id === catMatch[1]);
    if (!cat) return json({error: 'not found'}, 404);
    Object.assign(cat, body);
    saveState();
    return json({ok: true});
  }

  // ---- DELIVERY ZONES ----
  const delMatch = url.match(/^\/api\/delivery\/(\d+)$/);
  if (delMatch && method === 'PUT') {
    const idx = parseInt(delMatch[1]);
    if (!STATE.deliveryZones[idx]) return json({error: 'not found'}, 404);
    Object.assign(STATE.deliveryZones[idx], body);
    saveState();
    return json({ok: true});
  }

  // ---- QUEUE ----
  const qMatch = url.match(/^\/api\/queue\/(\d+)$/);
  if (qMatch && method === 'DELETE') {
    STATE.queue.splice(parseInt(qMatch[1]), 1);
    saveState();
    return json({ok: true});
  }
  if (url === '/api/queue' && method === 'DELETE') {
    STATE.queue = [];
    saveState();
    return json({ok: true});
  }

  // رسالة مباشرة من الداشبورد لعميل في القائمة
  const qMsgMatch = url.match(/^\/api\/queue\/(\d+)\/message$/);
  if (qMsgMatch && method === 'POST') {
    const q = STATE.queue[parseInt(qMsgMatch[1])];
    if (!q) return json({error: 'not found'}, 404);
    if (!waSocket) return json({error:'البوت غير متصل بواتساب'}, 503);
    waSocket.sendMessage(q.phone, { text: body.text || '' }).then(() => {
      json({ok: true});
    }).catch(e => json({error: e.message}, 500));
    return;
  }

  // ---- GROUPS ----
  if (url === '/api/groups' && method === 'GET') {
    client.getChats().then(all => {
      const chats = all.filter(c => c.isGroup).map(g => ({id: g.id._serialized, name: g.name}));
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify(chats));
    }).catch(() => {
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end('[]');
    });
    return;
  }

  // ---- SIMULATE — يشغّل handleMessage الحقيقية للـ dashboard ----
  if (url === '/api/simulate' && method === 'POST') {
    try {
      const simPhone = 'sim_' + (body.sessionId || 'default');
      const simMsg = { from: simPhone, body: body.message || '' };
      const reply = await handleMessage(simMsg);
      const msgs = Array.isArray(reply) ? reply : (reply ? [reply] : ['...']);
      return json({ replies: msgs });
    } catch(e) {
      return json({ replies: ['خطأ: ' + e.message] });
    }
  }

  // ---- SIMULATE RESET ----
  if (url === '/api/simulate/reset' && method === 'POST') {
    const simPhone = 'sim_' + (body.sessionId || 'default');
    resetSession(simPhone);
    json({ ok: true });
    return;
  }

  // ---- SEND MESSAGE (debug) ----
  if (url === '/api/send' && method === 'POST') {
    if (!body.to || !body.text) return json({error: 'to/text required'}, 400);
    client.sendMessage(body.to, body.text).then(() => json({ok: true})).catch(e => json({error: e.message}, 500));
    return;
  }

  // ---- ORDER: ADDED TO SYSTEM ----
  const addedMatch = url.match(/^\/api\/orders\/(\d+)\/added$/);
  if (addedMatch && method === 'POST') {
    const order = STATE.orders.find(o => o.id === parseInt(addedMatch[1]));
    if (!order) return json({error:'not found'}, 404);
    order.status = 'added_to_system';
    order.addedAt = new Date().toLocaleString('ar');
    saveState();
    addLog(`✅ طلب #${order.id} — تم الإضافة للنظام`);
    // إرسال رسالة للزبون
    const msg = `✅ تم إضافة طلبك *#${order.id}* للنظام!\nسيتم تحضيره قريباً ⏱️`;
    client.sendMessage(order.customerPhone, msg).catch(()=>{});
    return json({ok:true});
  }

  // ================================================================
  // DRIVERS API
  // ================================================================
  if (url === '/api/drivers' && method === 'GET') {
    // أضف معلومات الـ score الحالي لكل سائق
    const today = new Date().toLocaleDateString('ar-SA');
    if (STATE.driverDailyDate !== today) {
      STATE.driverDailyDate = today;
      (STATE.drivers||[]).forEach(d => { d.ordersToday=0; d.currentOrders=[]; });
      saveState();
    }
    return json(STATE.drivers || []);
  }

  if (url === '/api/drivers' && method === 'POST') {
    if (!STATE.drivers) STATE.drivers = [];
    const d = {
      id: STATE.nextId++,
      name:       body.name  || 'سائق جديد',
      phone:      body.phone || '',
      shift:      body.shift || 'both',
      zones:      body.zones || [],
      maxActive:  Number(body.maxActive) || 3,
      active:     true,
      ordersToday: 0,
      currentOrders: [],
    };
    STATE.drivers.push(d);
    saveState();
    addLog(`➕ سائق: ${d.name}`);
    return json({ ok: true, driver: d });
  }

  const driverMatch = url.match(/^\/api\/drivers\/(\d+)$/);
  if (driverMatch && method === 'PUT') {
    const d = (STATE.drivers||[]).find(d => d.id === parseInt(driverMatch[1]));
    if (!d) return json({ error:'not found' }, 404);
    if (body.zones !== undefined) body.zones = Array.isArray(body.zones) ? body.zones : [];
    if (body.maxActive !== undefined) body.maxActive = Number(body.maxActive) || 3;
    Object.assign(d, body);
    saveState();
    return json({ ok: true, driver: d });
  }

  if (driverMatch && method === 'DELETE') {
    const d = (STATE.drivers||[]).find(d => d.id === parseInt(driverMatch[1]));
    if (!d) return json({ error:'not found' }, 404);
    STATE.drivers = STATE.drivers.filter(dr => dr.id !== d.id);
    saveState();
    addLog(`🗑️ حذف سائق: ${d.name}`);
    return json({ ok: true });
  }

  // إعادة ضبط عدادات اليوم
  if (url === '/api/drivers/reset' && method === 'POST') {
    (STATE.drivers||[]).forEach(d => { d.ordersToday=0; d.currentOrders=[]; });
    STATE.driverDailyDate = new Date().toLocaleDateString('ar-SA');
    saveState();
    addLog('🔄 reset يدوي لعدادات الديلفري');
    return json({ ok: true });
  }

  // معاينة قرار التعيين لطلب (بدون تطبيق)
  const previewMatch = url.match(/^\/api\/orders\/(\d+)\/assign-preview$/);
  if (previewMatch && method === 'GET') {
    const order = STATE.orders.find(o => o.id === parseInt(previewMatch[1]));
    if (!order) return json({ error:'not found' }, 404);
    const result = selectDriver(order);
    return json({
      recommended: result.driver ? {
        id: result.driver.id, name: result.driver.name,
        score: result.score, reason: result.reason, warning: result.warning,
      } : null,
      allScored: (result.scored||[]).map(s => ({
        id: s.driver.id, name: s.driver.name, score: s.score,
        flags: s.flags, active_orders: s.active_orders,
      })),
    });
  }

  // تعيين (يدوي أو تلقائي) مع إشعار
  const assignMatch = url.match(/^\/api\/orders\/(\d+)\/assign$/);
  if (assignMatch && method === 'POST') {
    const order = STATE.orders.find(o => o.id === parseInt(assignMatch[1]));
    if (!order) return json({ error:'not found' }, 404);
    if (order.driverId) releaseDriver(order.id);

    let driver = null;
    if (body.driverId) {
      driver = (STATE.drivers||[]).find(d => d.id === parseInt(body.driverId));
    } else {
      const result = selectDriver(order);
      driver = result.driver;
    }
    if (!driver) return json({ error:'no driver available' }, 422);

    applyDriverAssignment(order, driver);
    order.status = 'out_for_delivery';
    if (order.timeline) order.timeline.push({
      status:'out_for_delivery', label:`🚗 مع السائق ${driver.name}`,
      time: new Date().toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'}),
      date: new Date().toLocaleDateString('ar-SA',{month:'2-digit',day:'2-digit'}),
      timestamp: Date.now(), note: body.note || '',
    });
    saveState();
    addLog(`✅ تعيين: طلب #${order.id} → ${driver.name}`);

    client.sendMessage(order.customerPhone,
      `🚗 طلبك *#${order.id}* مع السائق *${driver.name}* في الطريق إليك!\n\nاكتب *#${order.id}* لمتابعة طلبك 📍`
    ).catch(()=>{});

    return json({ ok:true, driverName: driver.name });
  }

  // زر "انتهى التجميع" — تعيين تلقائي فوري
  const readyMatch = url.match(/^\/api\/orders\/(\d+)\/ready$/);
  if (readyMatch && method === 'POST') {
    const order = STATE.orders.find(o => o.id === parseInt(readyMatch[1]));
    if (!order) return json({ error:'not found' }, 404);

    if (order.deliveryType !== 'توصيل') {
      // استلام من المطعم
      order.status = 'ready_pickup';
      if (order.timeline) order.timeline.push({
        status:'ready_pickup', label:'🔔 جاهز للاستلام',
        time: new Date().toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'}),
        date: new Date().toLocaleDateString('ar-SA',{month:'2-digit',day:'2-digit'}),
        timestamp: Date.now(), note:'',
      });
      saveState();
      client.sendMessage(order.customerPhone,
        `🔔 طلبك *#${order.id}* جاهز! تفضّل بالاستلام من المطعم 🏪`
      ).catch(()=>{});
      addLog(`✅ جاهز للاستلام: #${order.id}`);
      return json({ ok:true, type:'pickup' });
    }

    // ── اختيار تلقائي ذكي ──
    const result = selectDriver(order);
    if (!result.driver) {
      // لا يوجد سائق — أشعر الداشبورد يتدخل
      order.status = 'ready'; // جاهز لكن ينتظر
      if (order.timeline) order.timeline.push({
        status:'ready', label:'🔔 جاهز — ينتظر سائق',
        time: new Date().toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'}),
        date: new Date().toLocaleDateString('ar-SA',{month:'2-digit',day:'2-digit'}),
        timestamp: Date.now(), note:'لا يوجد سائق متاح',
      });
      saveState();
      addLog(`⚠️ طلب #${order.id} جاهز لكن لا سائق متاح`);
      return json({ ok:true, warning:'no_driver', needsManual:true, reason:'لا يوجد سائق متاح' });
    }

    applyDriverAssignment(order, result.driver);
    order.status = 'out_for_delivery';
    if (order.timeline) order.timeline.push({
      status:'out_for_delivery', label:`🚗 مع ${result.driver.name}`,
      time: new Date().toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'}),
      date: new Date().toLocaleDateString('ar-SA',{month:'2-digit',day:'2-digit'}),
      timestamp: Date.now(), note: result.reason,
    });
    saveState();
    addLog(`🚗 تعيين تلقائي: #${order.id} → ${result.driver.name} (${result.reason})`);

    client.sendMessage(order.customerPhone,
      `🚗 طلبك *#${order.id}* مع السائق *${result.driver.name}* في الطريق!\n📍 اكتب *#${order.id}* لمتابعة طلبك`
    ).catch(()=>{});

    return json({
      ok:true,
      driverName: result.driver.name,
      reason:     result.reason,
      warning:    result.warning || null,
    });
  }

  // تأكيد التوصيل وتحرير السائق
  const deliveredMatch = url.match(/^\/api\/orders\/(\d+)\/delivered$/);
  if (deliveredMatch && method === 'POST') {
    const order = STATE.orders.find(o => o.id === parseInt(deliveredMatch[1]));
    if (!order) return json({ error:'not found' }, 404);
    releaseDriver(order.id);
    order.status = 'delivered';
    if (order.timeline) order.timeline.push({
      status:'delivered', label:'🎉 تم التوصيل',
      time: new Date().toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'}),
      date: new Date().toLocaleDateString('ar-SA',{month:'2-digit',day:'2-digit'}),
      timestamp: Date.now(), note:'',
    });
    saveState();
    addLog(`🎉 تم التوصيل: #${order.id}`);
    client.sendMessage(order.customerPhone,
      `🎉 وصل طلبك *#${order.id}*!\nنتمنى تكون عجبك 😊 شكراً لثقتك بـ${STATE.settings.name} ❤️`
    ).catch(()=>{});
    return json({ ok:true });
  }

  // ================================================================
  // DRIVER BOARD APIs — pickup + returned + driver-board
  // ================================================================
  const pickupM = url.match(/^\/api\/orders\/(\d+)\/pickup$/);
  if (pickupM && method==='POST') {
    const order = STATE.orders.find(o=>o.id===parseInt(pickupM[1]));
    if (!order) return json({error:'not found'},404);
    order.pickedUpAt = Date.now(); order.status = 'out_for_delivery';
    if (!order.timeline) order.timeline = [];
    order.timeline.push({status:'out_for_delivery',label:`🚗 ${order.driverName} أخذ الطلب`,
      time:new Date().toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'}),
      date:new Date().toLocaleDateString('ar-SA',{month:'2-digit',day:'2-digit'}),timestamp:Date.now()});
    saveState(); addLog(`🚗 #${order.id} → ${order.driverName} خرج`);
    client.sendMessage(order.customerPhone,
      `🚗 طلبك *#${order.id}* مع السائق *${order.driverName}* في الطريق!\n📍 اكتب *#${order.id}* لمتابعة طلبك`
    ).catch(()=>{});
    return json({ok:true,pickedUpAt:order.pickedUpAt});
  }

  const returnM = url.match(/^\/api\/orders\/(\d+)\/returned$/);
  if (returnM && method==='POST') {
    const order = STATE.orders.find(o=>o.id===parseInt(returnM[1]));
    if (!order) return json({error:'not found'},404);
    const delivered = body.delivered!==false;
    order.status = delivered?'delivered':'cancelled'; order.returnedAt = Date.now();
    if (!order.timeline) order.timeline=[];
    order.timeline.push({status:order.status,label:delivered?'🎉 تم التوصيل':'❌ لم يُسلَّم',
      time:new Date().toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'}),
      date:new Date().toLocaleDateString('ar-SA',{month:'2-digit',day:'2-digit'}),
      timestamp:Date.now(),note:body.note||''});
    (STATE.drivers||[]).forEach(d=>{if(d.currentOrders)d.currentOrders=d.currentOrders.filter(id=>id!==order.id);});
    saveState(); addLog(`${delivered?'🎉':'❌'} #${order.id} → ${order.driverName} ${delivered?'سلّم':'لم يسلّم'}`);
    const elapsed = order.pickedUpAt?Math.round((Date.now()-order.pickedUpAt)/60000):null;
    if (delivered) client.sendMessage(order.customerPhone,
      `🎉 وصل طلبك *#${order.id}*!\nنتمنى تكون عجبك 😊 شكراً لثقتك بـ${STATE.settings.name} ❤️`
    ).catch(()=>{});
    return json({ok:true,elapsed});
  }

  const dbBM = url.match(/^\/api\/driver-board\/(\d+)$/);
  if (dbBM && method==='GET') {
    const driver = (STATE.drivers||[]).find(d=>d.id===parseInt(dbBM[1]));
    if (!driver) return json({error:'not found'},404);
    const today = new Date().toLocaleDateString('ar-SA',{year:'numeric',month:'2-digit',day:'2-digit'});
    const active = STATE.orders.filter(o=>o.driverId===driver.id&&['ready','out_for_delivery'].includes(o.status));
    const done   = STATE.orders.filter(o=>o.driverId===driver.id&&o.status==='delivered'&&o.dateKey===today);
    return json({driver,activeOrders:active,todayDelivered:done.length});
  }

  // ================================================================
  // LEARNING + CHAT ANALYZER APIs
  // ================================================================
  // إحصائيات التعلم
  if (url==='/api/learning-stats'&&method==='GET') {
    const aliases = STATE.learnedAliases || {};
    const total     = Object.keys(aliases).length;
    const permanent = Object.values(aliases).filter(a=>a.permanent).length;
    const pending   = total - permanent;
    const recent    = Object.values(aliases)
      .sort((a,b) => (b.count||0)-(a.count||0))
      .slice(0,20)
      .map(a => ({raw:a.raw, itemName:a.itemName, count:a.count, permanent:a.permanent}));
    return json({ total, permanent, pending, recent, threshold: CONFIRM_THRESHOLD });
  }

  if (url==='/api/unknowns'&&method==='GET')
    return json((STATE.unknowns||[]).filter(u=>u.status==='new').sort((a,b)=>(b.count||1)-(a.count||1)).slice(0,50));

  if (url==='/api/unknowns/apply'&&method==='POST') {
    const item = STATE.items.find(i=>i.id===parseInt(body.targetId));
    if (item&&body.alias&&!item.keys.includes(body.alias)) item.keys.push(body.alias);
    const entry = (STATE.unknowns||[]).find(u=>u.raw===body.raw);
    if (entry) entry.status='added';
    saveState(); addLog(`📚 تعلّم: "${body.alias||body.raw}" → ${item?.name||'؟'}`);
    return json({ok:true});
  }

  if (url==='/api/unknowns/dismiss'&&method==='POST') {
    const entry=(STATE.unknowns||[]).find(u=>u.raw===body.raw);
    if(entry)entry.status='dismissed';
    saveState(); return json({ok:true});
  }

  // ── حذف alias مُتعلَّم ──────────────────────────────────
  if (url==='/api/learn/remove'&&method==='POST') {
    const { raw, itemName, type } = body;
    const rawNorm = normalize(raw||'');

    if (type === 'alias' && itemName) {
      // أزل من item.keys
      const item = STATE.items.find(i => normalize(i.name) === normalize(itemName));
      if (item) {
        item.keys = item.keys.filter(k => normalize(k) !== rawNorm);
      }
      // أزل من runtimeAliases
      if (STATE.runtimeAliases?.[rawNorm]) delete STATE.runtimeAliases[rawNorm];
      // أزل من learnedAliases
      const lKey = rawNorm + '→' + normalize(itemName||'');
      if (STATE.learnedAliases?.[lKey]) delete STATE.learnedAliases[lKey];
    }

    if (type === 'runtime') {
      // أزل من runtimeAliases فقط
      if (STATE.runtimeAliases?.[rawNorm]) delete STATE.runtimeAliases[rawNorm];
    }

    if (type === 'cat') {
      // أزل alias قسم
      const catKey = '__cat__' + rawNorm;
      if (STATE.runtimeAliases?.[catKey]) delete STATE.runtimeAliases[catKey];
    }

    if (type === 'reply') {
      // أزل رد ثابت
      const replyId = parseInt(body.id);
      STATE.replies = STATE.replies.filter(r => r.id !== replyId);
    }

    saveState();
    addLog('🗑️ أُزيل تعلّم: "' + raw + '"');
    return json({ ok: true });
  }

  if (url==='/api/unknowns/alias'&&method==='POST') {
    const aliasFrom = (body.from||'').trim();
    const aliasTo   = (body.to||'').trim();
    if (!aliasFrom || !aliasTo) return json({error:'missing params'},400);

    // تحقق: الـ "to" يجب أن يكون اسم صنف موجود في القائمة
    const targetItem = STATE.items.find(i =>
      normalize(i.name) === normalize(aliasTo) ||
      i.keys.some(k => normalize(k) === normalize(aliasTo))
    );

    if (targetItem) {
      // أضف كـ key في الصنف مباشرة (الأفضل)
      if (!targetItem.keys.some(k => normalize(k) === normalize(aliasFrom))) {
        targetItem.keys.push(aliasFrom);
      }
      if (!STATE.runtimeAliases) STATE.runtimeAliases = {};
      STATE.runtimeAliases[normalize(aliasFrom)] = targetItem.name;
      saveState();
      addLog(`🔗 alias: "${aliasFrom}" → ${targetItem.name}`);
      return json({ ok: true, linkedTo: targetItem.name });
    }

    // إذا الـ "to" مش صنف — ممكن يكون alias لـ alias (مثلاً لقسم)
    if (!STATE.runtimeAliases) STATE.runtimeAliases = {};
    STATE.runtimeAliases[normalize(aliasFrom)] = aliasTo;
    saveState();
    addLog(`🔗 alias: "${aliasFrom}" → "${aliasTo}"`);
    return json({ ok: true });
  }

  if (url==='/api/analyze-chat'&&method==='POST') {
    if(!body.text)return json({error:'no text'},400);
    return json(analyzeChatExport(body.text));
  }

  if (url==='/api/analyze-chat/apply'&&method==='POST') {
    let appliedAliases=0, addedItems=0;
    for(const a of (body.aliases||[])) {
      const item=STATE.items.find(i=>i.id===a.itemId);
      if(item&&a.alias&&!item.keys.some(k=>normalize(k)===normalize(a.alias))){
        item.keys.push(a.alias);
        // أضف للـ runtimeAliases كمان
        if(!STATE.runtimeAliases)STATE.runtimeAliases={};
        STATE.runtimeAliases[normalize(a.alias)]=item.name;
        appliedAliases++;
      }
    }
    for(const ni of (body.newItems||[])) {
      if(!ni.name||!ni.cat||!ni.price)continue;
      const keys=[ni.name,...(ni.aliases||[])];
      STATE.items.push({id:STATE.nextId++,name:ni.name,cat:ni.cat,price:Number(ni.price)||0,active:false,keys});
      addedItems++;
    }
    saveState(); addLog(`📚 تحليل محادثات: ${appliedAliases} alias + ${addedItems} صنف جديد`);
    return json({ok:true,appliedAliases,addedItems});
  }

  // ---- CUSTOMER PROFILES ----
  if (url === '/api/customers' && method === 'GET') {
    const profiles = Object.entries(STATE.customerProfiles || {}).map(([phone, p]) => ({ phone, ...p }));
    return json(profiles);
  }
  const custMatch = url.match(/^\/api\/customers\/(.+)$/);
  if (custMatch && method === 'DELETE') {
    delete STATE.customerProfiles[custMatch[1]];
    saveState();
    return json({ ok: true });
  }

  json({error: 'not found'}, 404);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ السيرفر شغال: http://localhost:${PORT}`));

// ============================================================
// BAILEYS WHATSAPP CLIENT (بدون Chromium — يعمل على Render مجاناً)
// ============================================================
let waSocket = null;

// client.sendMessage — متوافق مع بقية الكود
const client = {
  sendMessage: async (to, text) => {
    if (!waSocket) {
      console.log('⚠️ لا اتصال بواتساب — لم تُرسل رسالة إلى ' + to);
      addLog('⚠️ رسالة لم تُرسل (البوت غير متصل)');
      return false;
    }
    const jid = to.includes('@') ? to : to.replace(/\D/g,'') + '@s.whatsapp.net';
    try { await waSocket.sendMessage(jid, { text }); return true; }
    catch(e) {
      console.log('⚠️ فشل إرسال إلى ' + jid + ': ' + e.message);
      addLog('⚠️ فشل إرسال رسالة: ' + e.message);
      return false;
    }
  },
};

// ══════════════════════════════════════════════════════════
// حالة الاتصال بواتساب
// بدون حارس، كل انقطاع كان ينشئ سوكيت جديداً دون إغلاق القديم،
// فتتراكم اتصالات تتنافس على نفس الجلسة وتُنتج 408 متتالية.
// ══════════════════════════════════════════════════════════
// مراحل الاتصال — تُعرض في صفحة /link ليعرف المستخدم أين وصل
const WA_PHASE = { name: 'idle', label: 'في الانتظار', at: Date.now(), startedAt: null };
function setPhase(name, label) {
  WA_PHASE.name = name;
  WA_PHASE.label = label;
  WA_PHASE.at = Date.now();
  if (name === 'starting') WA_PHASE.startedAt = Date.now();
  console.log(`   ⏱️  ${label}`);
}

let waConnecting   = false;   // محاولة اتصال جارية
let waConnectingAt = 0;       // متى رُفع الحارس — لكشف العلوق
const WA_CONNECT_TIMEOUT = 75000;   // بعدها نعتبر المحاولة ميتة

/** يفك الحارس إن علق — بدونه يستحيل الربط بعد محاولة صامتة */
function guardStuck() {
  if (!waConnecting) return false;
  if (Date.now() - waConnectingAt < WA_CONNECT_TIMEOUT) return false;
  console.log('🔓 محاولة اتصال عالقة منذ ' +
    Math.round((Date.now() - waConnectingAt) / 1000) + 'ث — فُكّ الحارس');
  waConnecting = false;
  return true;
}
setInterval(() => { if (guardStuck()) startBaileys(); }, 30000).unref?.();
let waRetries      = 0;       // عدّاد المحاولات المتتالية
let waRetryTimer   = null;    // مؤقّت إعادة المحاولة المعلّق
const WA_STATS = {
  disconnects: 0, reconnects: 0,
  lastCode: null, lastAt: null, lastReason: '',
  connectedSince: null,        // متى بدأ الاتصال الحالي
  linkedAt: null,              // متى رُبط الجهاز أول مرة (لقاعدة الـ14 يوماً)
  history: [],                 // آخر 20 انقطاعاً
};

/** يسجّل انقطاعاً في السجل الدوّار */
function recordDisconnect(code, reason) {
  WA_STATS.disconnects++;
  WA_STATS.lastCode = code;
  WA_STATS.lastReason = reason;
  WA_STATS.lastAt = new Date().toISOString();
  WA_STATS.connectedSince = null;
  WA_STATS.history.unshift({ at: WA_STATS.lastAt, code, reason });
  if (WA_STATS.history.length > 20) WA_STATS.history.length = 20;
}

/** يغلق السوكيت الحالي ويزيل مستمعيه — يمنع تراكم الاتصالات */
function killSocket() {
  if (!waSocket) return;
  try { waSocket.ev.removeAllListeners(); } catch { /* تجاهل */ }
  try { waSocket.end(undefined); } catch { /* تجاهل */ }
  waSocket = null;
}

/** إعادة اتصال واحدة مجدولة بتراجع تدريجي: 5 ← 10 ← 20 ← 40 ← 60 ثانية */
function scheduleReconnect(reason) {
  if (waRetryTimer) return;              // محاولة مجدولة بالفعل
  waRetries = Math.min(waRetries + 1, 5);
  const delay = Math.min(5000 * 2 ** (waRetries - 1), 60000);
  console.log(`🔄 إعادة اتصال بعد ${delay / 1000} ثانية (محاولة ${waRetries}) — ${reason}`);
  waRetryTimer = setTimeout(() => {
    waRetryTimer = null;
    startBaileys();
  }, delay);
  waRetryTimer.unref?.();
}

// ══════════════════════════════════════════════════════════
// سجل الرسائل المُهملة — يجيب على «لماذا لم يرد البوت؟»
// كل نقاط الإسقاط كانت صامتة، فيبدو البوت معطّلاً بلا تفسير.
// ══════════════════════════════════════════════════════════
const DROPPED = [];

function dropMsg(from, text, reason, hint) {
  const num = String(from || '').split('@')[0];
  DROPPED.unshift({
    at: new Date().toISOString(),
    from: num.length > 6 ? num.slice(0, 5) + '***' + num.slice(-3) : num,
    text: String(text || '').slice(0, 60),
    reason, hint: hint || '',
  });
  if (DROPPED.length > 40) DROPPED.length = 40;
  return null;
}

// ══════════════════════════════════════════════════════════
// نسخة واتساب ويب
// fetchLatestBaileysVersion يطلبها من الإنترنت في كل اتصال.
// كانت تُنتظَر بلا مهلة، فتؤخّر ظهور QR ثوانيَ أو تعلّق تماماً.
// ══════════════════════════════════════════════════════════
const WA_VERSION_FALLBACK = [2, 3000, 1015901307];
let waVersionCache = null;   // { version, at }
const WA_VERSION_TTL = 6 * 3600 * 1000;

async function getWaVersion() {
  if (waVersionCache && Date.now() - waVersionCache.at < WA_VERSION_TTL) {
    return waVersionCache.version;
  }
  const t0 = Date.now();
  try {
    const res = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('مهلة 8 ثوانٍ')), 8000)),
    ]);
    waVersionCache = { version: res.version, at: Date.now() };
    console.log(`   نسخة واتساب ${res.version.join('.')} (${Date.now() - t0}ms)`);
    return res.version;
  } catch (e) {
    const v = (waVersionCache && waVersionCache.version) || WA_VERSION_FALLBACK;
    console.log(`   ⚠️ تعذّر جلب نسخة واتساب (${e.message}) — استُخدمت ${v.join('.')}`);
    return v;
  }
}

/** مؤشر الكتابة — يُطلق ولا يُنتظَر، وفشله لا يعني شيئاً */
function presence(jid, state) {
  if (!waSocket) return;
  try { waSocket.sendPresenceUpdate(state, jid).catch(() => {}); } catch { /* تجاهل */ }
}

/** إرسال رسالة مع محاولة ثانية — لا يضيع رد بسبب تعثّر لحظي */
async function sendText(jid, text, attempt = 1) {
  if (!waSocket) { console.log('⚠️ لا سوكيت — لم تُرسل الرسالة'); return false; }
  try {
    await waSocket.sendMessage(jid, { text });
    return true;
  } catch (e) {
    if (attempt === 1) {
      console.log(`⚠️ فشل الإرسال (${e.message}) — إعادة محاولة بعد ثانيتين`);
      await new Promise(r => setTimeout(r, 2000));
      return sendText(jid, text, 2);
    }
    console.error('❌ ضاع رد لـ ' + jid + ': ' + e.message);
    addLog('❌ تعذّر إرسال رد — ' + e.message);
    return false;
  }
}

async function startBaileys(opts = {}) {
  if (opts.force) {
    // طلب صريح من المستخدم — يتجاوز أي محاولة جارية
    waConnecting = false;
    if (waRetryTimer) { clearTimeout(waRetryTimer); waRetryTimer = null; }
    waRetries = 0;
  } else {
    guardStuck();
    if (waConnecting) {
      console.log('⏭️  محاولة اتصال جارية منذ ' +
        Math.round((Date.now() - waConnectingAt) / 1000) + 'ث — تُجوهلت');
      return;
    }
  }
  if (!stateLoaded) { console.log('⏭️  البيانات لم تُحمّل — تأجّل الاتصال'); return; }
  waConnecting = true;
  waConnectingAt = Date.now();
  if (waRetryTimer) { clearTimeout(waRetryTimer); waRetryTimer = null; }
  killSocket();   // أغلق أي اتصال سابق قبل فتح جديد
  setPhase('starting', 'قراءة جلسة واتساب المحفوظة');

  try {
    // حفظ جلسة واتساب في مجلد baileys_auth
    pairRequested = false; // كل محاولة اتصال جديدة تبدأ بعلم نظيف
    const { state: authState, saveCreds } = await useMultiFileAuthState('./baileys_auth');
    setPhase('version', 'جلب نسخة واتساب ويب');
    const version = await getWaVersion();
    setPhase('socket', 'فتح الاتصال بخوادم واتساب');

    waSocket = makeWASocket({
      version,
      auth:                  authState,
      logger:                pino({ level: 'silent' }),
      browser:               Browsers.ubuntu('Chrome'),
      printQRInTerminal:     false,
      connectTimeoutMs:      60000,
      keepAliveIntervalMs:   25000,
      retryRequestDelayMs:   1000,
      // بلا مهلة على الاستعلامات — المهلة القصيرة أشيع سبب لأخطاء 408
      defaultQueryTimeoutMs: undefined,
      markOnlineOnConnect:   false,  // لا تسحب كل إشعارات عدم الاتصال دفعة واحدة
      syncFullHistory:       false,  // لا نحتاج تاريخ المحادثات — يوفّر ذاكرة ووقتاً
      emitOwnEvents:         false,
    });

    // حفظ بيانات الجلسة عند كل تحديث
    waSocket.ev.on('creds.update', saveCreds);

    // ── QR + اتصال + قطع ──────────────────────────────────
    waSocket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        STATE.botConnected = false;

        // ── وضع كود الربط ──────────────────────────────────
        // حدث qr يُطلق أيضاً في وضع الكود، ونستخدمه كمُحفِّز لأن
        // السوكيت قد لا يكون جاهزاً فور إنشائه (توثيق Baileys)
        const wantPair = STATE.settings.linkMethod === 'pair';
        const phone = String(STATE.settings.pairPhone || '').replace(/\D/g, '');
        const registered = !!(waSocket.authState && waSocket.authState.creds && waSocket.authState.creds.registered);

        if (wantPair && phone.length >= 8 && !registered && !pairRequested) {
          pairRequested = true;
          try {
            const code = await waSocket.requestPairingCode(phone);
            pairCode   = String(code || '').replace(/\W/g, '');
            pairCodeAt = Date.now();
            currentQR  = '';
            setPhase('code', 'كود الربط جاهز');
            const pretty = pairCode.match(/.{1,4}/g)?.join('-') || pairCode;
            const issued = pairCode;
            // ينتهي الكود بعد 3 دقائق فتطلب الواجهة توليد غيره
            setTimeout(() => {
              if (pairCode === issued && !STATE.botConnected) {
                pairCode = '';
                pairRequested = false;
                addLog('⏱️ انتهت صلاحية كود الربط');
              }
            }, 3 * 60 * 1000);
            addLog(`🔗 كود الربط: ${pretty}`);
            console.log('🔗 كود الربط:', pretty, '— واتساب ← الأجهزة المرتبطة ← ربط برقم الهاتف');
          } catch (e) {
            pairRequested = false;
            pairCode = '';
            addLog('⚠️ فشل توليد كود الربط: ' + e.message);
            console.log('⚠️ فشل كود الربط:', e.message, '— الرجوع إلى QR');
            currentQR = qr;
          }
          return;
        }

        // كود صالح معروض بالفعل — تجاهل أحداث qr المتكررة
        // (واتساب يبعثها كل ~20 ثانية وستملأ الواجهة بلا داع)
        if (wantPair && pairCode) return;

        currentQR = qr;
        setPhase('qr', 'الرمز جاهز — امسحه من هاتفك');
        console.log('📱 QR جاهز — افتح /qr في الداشبورد');
        // ينتهي QR بعد دقيقة
        setTimeout(() => { if (currentQR === qr) currentQR = ''; }, 60000);
      }

      if (connection === 'open') {
        currentQR = '';
        pairCode = '';
        pairRequested = false;
        waConnecting = false;
        setPhase('open', 'متصل ✅');
        WA_STATS.connectedSince = new Date().toISOString();
        if (!WA_STATS.linkedAt) {
          if (!STATE.waLinkedAt) { STATE.waLinkedAt = WA_STATS.connectedSince; saveState(); }
          WA_STATS.linkedAt = STATE.waLinkedAt;
        }
        if (waRetries) { WA_STATS.reconnects++; console.log(`✅ عاد الاتصال بعد ${waRetries} محاولة`); }
        waRetries = 0;
        if (waRetryTimer) { clearTimeout(waRetryTimer); waRetryTimer = null; }
        STATE.botConnected = true;
        addLog('✅ البوت اتصل بواتساب (Baileys)');
        console.log('✅ Baileys متصل!');
      }

      if (connection === 'close') {
        STATE.botConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut  = statusCode === DisconnectReason.loggedOut;
        waConnecting = false;
        const REASONS = {
          408: 'انتهت مهلة الاتصال',
          428: 'أُغلق الاتصال',
          440: 'بدأت جلسة أخرى بنفس الرقم',
          401: 'تسجيل خروج من الهاتف',
          500: 'خطأ في خادم واتساب',
          515: 'يحتاج إعادة تشغيل',
        };
        const why = REASONS[statusCode] || 'سبب غير معروف';
        recordDisconnect(statusCode, why);
        addLog(`⚠️ انقطع الاتصال (${statusCode}) — ${why}`);
        console.log(`⚠️ انقطع: ${statusCode} — ${why}`);

        if (loggedOut) {
          STATE.waLinkedAt = null; saveState();
          WA_STATS.linkedAt = null;
          killSocket();
          addLog('❌ تسجيل خروج — افتح /link وأعد الربط');
          console.log('❌ الجلسة انتهت. افتح صفحة /link وأعد الربط بـ QR أو كود.');
          return;
        }

        if (statusCode === 440) {
          // نفس الرقم مرتبط في مكان آخر — الإلحاح يطرد الجلستين
          killSocket();
          addLog('⚠️ الرقم مستخدم في جلسة أخرى — أوقف النسخة الثانية');
          console.log('⚠️ نفس رقم واتساب مرتبط بخدمة أخرى. أوقف إحداهما وإلا تنقطعان معاً.');
          scheduleReconnect('جلسة مزدوجة');
          return;
        }

        scheduleReconnect(why);
      }
    });

    // ── استقبال الرسائل ───────────────────────────────────
    waSocket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        try {
          const jid = msg.key.remoteJid;

          // استخراج النص من أنواع الرسائل المختلفة
          const body = msg.message?.conversation
            || msg.message?.extendedTextMessage?.text
            || msg.message?.buttonsResponseMessage?.selectedDisplayText
            || msg.message?.listResponseMessage?.title
            || '';

          if (msg.key.fromMe) {
            dropMsg(jid, body, 'رسالة صادرة من الرقم المربوط نفسه',
              'البوت لا يرد على رسائلك أنت. اختبره من هاتف آخر.');
            continue;
          }
          if (!jid) { dropMsg('', body, 'بلا معرّف مرسل', ''); continue; }
          if (jid.endsWith('@g.us')) {
            dropMsg(jid, body, 'رسالة من مجموعة', 'البوت يتجاهل المجموعات عمداً.');
            continue;
          }
          if (!body.trim()) {
            dropMsg(jid, '', 'رسالة بلا نص',
              'صورة أو صوت أو ملصق — البوت يقرأ النص فقط.');
            continue;
          }

          // مؤشر الكتابة تجميلي — لا يُنتظَر ولا يُسمح له بإسقاط الرد
          presence(jid, 'composing');
          await new Promise(r => setTimeout(r, 400 + Math.random() * 400));

          // بناء msgObj متوافق مع handleMessage
          const msgObj = {
            from:  jid,
            body:  body,
            reply: (text) => sendText(jid, text),
          };

          const reply = await handleMessage(msgObj);
          presence(jid, 'paused');
          if (!reply) continue;

          if (Array.isArray(reply)) {
            for (let i = 0; i < reply.length; i++) {
              if (i > 0) {
                await new Promise(r => setTimeout(r, 700 + Math.random() * 400));
                presence(jid, 'composing');
                await new Promise(r => setTimeout(r, 400));
                presence(jid, 'paused');
              }
              await sendText(jid, reply[i]);
            }
          } else {
            await sendText(jid, reply);
          }
        } catch(err) {
          console.error('خطأ رسالة:', err.message, err.stack ? err.stack.split('\n')[1] : '');
        }
      }
    });

  } catch(err) {
    waConnecting = false;
    console.error('❌ Baileys startError:', err.message);
    scheduleReconnect('فشل بدء الاتصال: ' + err.message);
  }
}


// ============================================================
// AUTO-LEARNING CRON — كل ساعة يحلل unknowns بـ Groq
// ============================================================
async function autoLearnCron() {
  if (!GROQ_KEY) return;
  const unknowns = (STATE.unknowns || []).filter(u => u.status === 'new' && u.count >= 2);
  if (!unknowns.length) { console.log('🤖 AutoLearn: لا شيء جديد'); return; }

  console.log('🤖 AutoLearn: ' + unknowns.length + ' unknown بانتظار...');
  const itemsList = STATE.items.filter(i => i.active).map(i => i.name).join('، ');

  // حلّل أول 10 فقط (حد Groq المجاني)
  const batch = unknowns.slice(0, 10);
  const batchText = batch.map((u, i) => (i + 1) + '. "' + u.raw + '" (' + u.count + 'x)').join('\n');

  const prompt = `أنت خبير بمنيو مطعم في غزة. الأصناف المتاحة: ${itemsList}

هذه رسائل زبائن لم يفهمها البوت. لكل رسالة حدد:
- إذا تعني صنف من القائمة → ALIAS:رقم:اسم_الصنف
- إذا تحية أو ثرثرة → SKIP:رقم
- إذا غير واضحة → UNKNOWN:رقم

الرسائل:
${batchText}

أجب بأسطر فقط بدون شرح.`;

  try {
    const result = await askGroq(prompt, '');
    if (!result) return;

    let learned = 0;
    for (const line of result.split('\n')) {
      const aliasM = line.match(/^ALIAS:(\d+):(.+)$/);
      if (aliasM) {
        const idx = parseInt(aliasM[1]) - 1;
        const itemName = aliasM[2].trim();
        if (idx < batch.length) {
          const item = STATE.items.find(i => normalize(i.name) === normalize(itemName));
          if (item) {
            learnAlias(batch[idx].raw, item.name);
            batch[idx].status = 'added';
            batch[idx].aiLearned = true;
            learned++;
          }
        }
      }
      const skipM = line.match(/^SKIP:(\d+)$/);
      if (skipM) {
        const idx = parseInt(skipM[1]) - 1;
        if (idx < batch.length) batch[idx].status = 'dismissed';
      }
    }

    if (learned > 0) {
      addLog('🤖 AutoLearn: تعلّم ' + learned + ' alias جديد');
      saveState();
    }
    console.log('🤖 AutoLearn: ' + learned + ' learned, ' + batch.filter(b => b.status === 'dismissed').length + ' dismissed');
  } catch(e) {
    console.log('⚠️ AutoLearn error:', e.message);
  }
}

// تشغيل AutoLearn كل ساعة + عند البدء بعد 5 دقائق
setTimeout(autoLearnCron, 5 * 60 * 1000);
setInterval(autoLearnCron, 60 * 60 * 1000);

// ============================================================
// KEEP-ALIVE — يمنع Render من النوم كل 14 دقيقة
// ============================================================
// كان يستخدم http.get مع رابط https فيفشل صامتاً على Render،
// فتنام الخدمة بعد 15 دقيقة وينقطع واتساب بخطأ 408 عند الإيقاظ.
const SELF_URL = process.env.RENDER_EXTERNAL_URL
  ? process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '')
  : `http://localhost:${PORT}`;

let pingFails = 0;
function keepAlivePing() {
  const lib = SELF_URL.startsWith('https:') ? https : http;   // ← الوحدة الصحيحة للبروتوكول
  const req = lib.get(SELF_URL + '/ping', (res) => {
    res.resume();
    if (res.statusCode === 200) { pingFails = 0; }
    else { pingFails++; console.log(`⚠️ نداء ذاتي: HTTP ${res.statusCode}`); }
  });
  req.setTimeout(15000, () => req.destroy(new Error('انتهت المهلة')));
  req.on('error', (e) => {
    pingFails++;
    console.log(`⚠️ نداء ذاتي فشل (${pingFails}): ${e.message}`);
    if (pingFails === 3) console.log('   ← إن تكرر، اضبط RENDER_EXTERNAL_URL يدوياً برابط خدمتك');
  });
}

// 12 دقيقة — أقل من حد الـ15 دقيقة بهامش أمان
setInterval(keepAlivePing, 12 * 60 * 1000);
setTimeout(keepAlivePing, 60 * 1000);
console.log('⏰ نداء ذاتي كل 12 دقيقة: ' + SELF_URL);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
async function shutdown() {
  console.log('\n🛑 إيقاف...');
  await saveStateNow();
  try { waSocket?.end(undefined, true); } catch(e) {}
  process.exit(0);
}
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', r  => console.log('⚠️ unhandled:', r?.message || r));
process.on('uncaughtException',  e  => console.log('⚠️ uncaught:', e.message));

// ============================================================
// START — تحميل Firebase ثم بدء Baileys
// ============================================================
(async () => {
  console.log('🚀 O2 Bot يبدأ...');
  const t0 = Date.now();
  const ok = await loadStateWithRetry();
  if (!ok) return;   // الكتابة مقفلة والبوت متوقف — تستمر المحاولة في الخلفية
  console.log(`✅ state محمّل من Firebase (${Date.now() - t0}ms)`);

  // ══ نطاق الصور: يُستنتج تلقائياً من مشروع Firebase ══
  // المسارات نسبية (/menu/…) ولا تظهر بلا نطاق، واستضافة Firebase
  // تكون دائماً على <project_id>.web.app.
  // يُضبط هنا لا داخل loadState لأن مسار «أول تشغيل» يعود مبكراً.
  if (!STATE.settings.imageBaseUrl && FB_PROJECT_ID) {
    STATE.settings.imageBaseUrl = `https://${FB_PROJECT_ID}.web.app`;
    console.log(`🖼️  نطاق الصور ضُبط تلقائياً: ${STATE.settings.imageBaseUrl}`);
    console.log('   (غيّره من الإعدادات إن كانت صورك في مكان آخر)');
    saveState();
  }

  auth.init(STATE, saveState);

  // البوت يبدأ فوراً؛ كتابة الترحيل تجري في الخلفية حتى لا تؤخّر ظهور QR
  startBaileys();

  if (migrationPending) {
    saveStateNow().then(() => {
      migrationPending = false;
      console.log('💾 حُفظ المنيو الجديد (في الخلفية)');
    });
  }
})();
