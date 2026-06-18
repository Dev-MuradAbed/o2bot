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
    defaultReply: 'هههه مش فاهم قصدك كتير 😄 بدك تطلب ولا بدك تشوف الأسعار؟',
    bankName: 'فادي أبو شرخ',
    bank: 'بنك فلسطين',
    bankPhone: '0567743979',
    iban: 'PS43PALS045411071670993000000',
    transferMode: false,
    botActive: true,
    groupId: '',
    sessionTimeoutMins: 30, // انتهاء الجلسة بعد X دقيقة من آخر رسالة
  },
  deliveryZones: [
    { label: 'النصيرات (مستشفى العودة)', keys: ['العودة', 'مستشفى العودة'], fee: 5 },
    { label: 'النصيرات عام', keys: ['النصيرات'], fee: 10 },
    { label: 'السوارحة والبريج', keys: ['السوارحة', 'البريج'], fee: 15 },
    { label: 'الزوايدة والمغازي', keys: ['الزوايدة', 'المغازي'], fee: 20 },
    { label: 'دير البلح', keys: ['دير البلح'], fee: 35 },
  ],
  categories: [
    { id: 'شاورما',  label: '🥙 الشاورما',   active: true },
    { id: 'ايطالي',  label: '🍕 الإيطالي',    active: true },
    { id: 'ساندويش', label: '🍔 الساندويشات', active: true },
    { id: 'سلطة',    label: '🥗 السلطات',     active: true },
    { id: 'مشروبات', label: '☕ المشروبات',   active: true },
    { id: 'حلويات',  label: '🍰 الحلويات',    active: true },
  ],
  items: [
    { id:1,  name:'فرشوحة عادي',        cat:'شاورما',  price:20, active:true, keys:['فرشوحة عادي','فرشوحة','فراشيح عادي','فراشيح عادية','فرشوحات عادي'] },
    { id:2,  name:'فرشوحة دبل',         cat:'شاورما',  price:22, active:true, keys:['فرشوحة دبل','فرشوحات دبل','فراشيح دبل'] },
    { id:3,  name:'فرشوحة دبل لحمة',    cat:'شاورما',  price:28, active:true, keys:['فرشوحة دبل لحمة','دبل لحمة','فرشوحة دوبل لحمة','دوبل لحمة','فراشيح دبل لحمة','فراشيح دوبل لحمة'] },
    { id:4,  name:'فرشوحة دبل دبل',     cat:'شاورما',  price:30, active:true, keys:['فرشوحة دبل دبل','دبل دبل'] },
    { id:5,  name:'سوري',               cat:'شاورما',  price:32, active:true, keys:['سوري','شاورما سوري'] },
    { id:6,  name:'صفيحة',              cat:'شاورما',  price:38, active:true, keys:['صفيحة','صفيحه','صفايح','صفيحة شاورما'] },
    { id:7,  name:'باشكا',              cat:'شاورما',  price:45, active:true, keys:['باشكا'] },
    { id:8,  name:'شاورما عربي',        cat:'شاورما',  price:38, active:true, keys:['شاورما عربي','عربي','الشاورما العربي'] },
    { id:9,  name:'شاورما إيطالي',      cat:'شاورما',  price:38, active:true, keys:['شاورما ايطالي','شاورما إيطالي'] },
    { id:10, name:'صحن شاورما',         cat:'شاورما',  price:30, active:true, keys:['صحن شاورما','صحن','الصحن'] },
    { id:11, name:'كالزوني دجاج',       cat:'ايطالي',  price:35, active:true, keys:['كالزوني دجاج','كاليزوني دجاج','كالزوني','كاليزوني','كلزوني','الكلزوني','الكالزوني'] },
    { id:12, name:'كالزوني خضار',       cat:'ايطالي',  price:20, active:true, keys:['كالزوني خضار','كاليزوني خضار'] },
    { id:13, name:'بيتزا مكسيكي دجاج', cat:'ايطالي',  price:25, active:true, keys:['بيتزا مكسيكي','مكسيكي','تشكن بيتزا','تشيكن بيتزا','بيتزا دجاج'] },
    { id:14, name:'بيتزا خضار وذرة',    cat:'ايطالي',  price:20, active:true, keys:['بيتزا خضار','خضار وذرة'] },
    { id:15, name:'بيتزا ماما روزا',    cat:'ايطالي',  price:20, active:true, keys:['ماما روزا','ماما'] },
    { id:16, name:'نابولي',             cat:'ايطالي',  price:20, active:true, keys:['نابولي'] },
    { id:17, name:'مارغريتا',           cat:'ايطالي',  price:20, active:true, keys:['مارغريتا','مرغريتا'] },
    { id:18, name:'علبة صوص إكسترا',   cat:'ايطالي',  price:3,  active:true, keys:['صوص إكسترا','اكسترا صوص','علبة صوص','صوص'] },
    { id:19, name:'زنجر',               cat:'ساندويش', price:30, active:true, keys:['زنجر','الزنجر','زينجر'] },
    { id:20, name:'بيج زنجر',           cat:'ساندويش', price:40, active:true, keys:['بيج زنجر','بيغ زنجر'] },
    { id:21, name:'بيف برجر',           cat:'ساندويش', price:30, active:true, keys:['بيف برجر','بيف'] },
    { id:22, name:'تشيكن برجر',         cat:'ساندويش', price:30, active:true, keys:['تشيكن برجر','تشيكن','تشكن برجر','دجاج برجر'] },
    { id:23, name:'بيج ماك',            cat:'ساندويش', price:40, active:true, keys:['بيج ماك','بيغ ماك','البيج ماك'] },
    { id:24, name:'شيش طاووق',          cat:'ساندويش', price:30, active:true, keys:['شيش طاووق','شيش','الشيش'] },
    { id:25, name:'فطيرة ذهبية',        cat:'ساندويش', price:30, active:true, keys:['فطيرة ذهبية','فطيره ذهبيه','فطيرة','فطيره','الفطيرة الذهبية'] },
    { id:26, name:'بانسية',             cat:'ساندويش', price:30, active:true, keys:['بانسية','بانسيه','بانيه','دجاج بانيه','بانه'] },
    { id:27, name:'باربكيو',            cat:'ساندويش', price:30, active:true, keys:['باربكيو'] },
    { id:28, name:'ستيك دجاج مشوي',    cat:'ساندويش', price:30, active:true, keys:['ستيك','ستيك دجاج','الصاروخ','صاروخ'] },
    { id:29, name:'بطاطا كبير',         cat:'سلطة',    price:10, active:true, keys:['بطاطا كبير','بطاطا','علبة بطاطا','صحن بطاطا','شيبس'] },
    { id:30, name:'سلطات وسط',          cat:'سلطة',    price:10, active:true, keys:['سلطة وسط','سلطة','سلطات وسط'] },
    { id:31, name:'سلطات كبيرة',        cat:'سلطة',    price:15, active:true, keys:['سلطة كبيرة','سلطات كبيرة'] },
    { id:32, name:'نسكافيه',            cat:'مشروبات', price:5,  active:true, keys:['نسكافيه','نسكفيه'] },
    { id:33, name:'كابتشينو',           cat:'مشروبات', price:5,  active:true, keys:['كابتشينو'] },
    { id:34, name:'إسبريسو سنجل',      cat:'مشروبات', price:5,  active:true, keys:['اسبريسو سنجل','اسبريسو','إسبريسو'] },
    { id:35, name:'إسبريسو دبل',       cat:'مشروبات', price:10, active:true, keys:['اسبريسو دبل','إسبريسو دبل'] },
    { id:36, name:'قهوة تركي سنجل',    cat:'مشروبات', price:5,  active:true, keys:['قهوة تركي','تركي'] },
    { id:37, name:'قهوة تركي دبل',     cat:'مشروبات', price:10, active:true, keys:['تركي دبل'] },
    { id:38, name:'شاي',               cat:'مشروبات', price:3,  active:true, keys:['شاي'] },
    { id:39, name:'عصير الموسم',       cat:'مشروبات', price:12, active:true, keys:['عصير موسم','موسم','عصير'] },
    { id:40, name:'عصير ليمون ونعناع', cat:'مشروبات', price:12, active:true, keys:['ليمون نعناع','ليمون'] },
    { id:41, name:'عصير أفوكاتو',      cat:'مشروبات', price:15, active:true, keys:['افوكاتو','أفوكاتو'] },
    { id:42, name:'ميلك شيك سبيشل',   cat:'مشروبات', price:20, active:true, keys:['ميلك شيك','ملك شيك'] },
    { id:43, name:'موهيتو',            cat:'مشروبات', price:20, active:true, keys:['موهيتو','موهيطو'] },
    { id:44, name:'كنافة نوتيلا',      cat:'حلويات',  price:15, active:true, keys:['كنافة نوتيلا','كنافه نوتيلا'] },
    { id:45, name:'كنافة دبي',         cat:'حلويات',  price:20, active:true, keys:['كنافة دبي','كنافه دبي'] },
    { id:46, name:'مولتن كيك',         cat:'حلويات',  price:20, active:true, keys:['مولتن','مولتن كيك','موتلن'] },
    { id:47, name:'وافل سنيك',         cat:'حلويات',  price:25, active:true, keys:['وافل','وافله','وافلة'] },
    { id:48, name:'كريب دبي',          cat:'حلويات',  price:30, active:true, keys:['كريب دبي','كريبة دبي'] },
    { id:49, name:'تشيز كيك',          cat:'حلويات',  price:10, active:true, keys:['تشيز كيك','تشيزكيك'] },
    { id:50, name:'جيلاتو لوتس',       cat:'حلويات',  price:15, active:true, keys:['لوتس','جيلاتو لوتس','جيلاتو'] },
    { id:51, name:'كنافة عربية',       cat:'حلويات',  price:40, active:true, keys:['كنافة عربية','كنافه عربيه'] },
    { id:52, name:'بقلاوة لوز',        cat:'حلويات',  price:48, active:true, keys:['بقلاوة لوز','بقلاوه لوز'] },
    { id:53, name:'بان كيك نوتيلا',    cat:'حلويات',  price:25, active:true, keys:['بان كيك نوتيلا','بانكيك نوتيلا','بان كيك','بانكيك','pancake nutella'] },
    { id:54, name:'بان كيك لوتس',      cat:'حلويات',  price:25, active:true, keys:['بان كيك لوتس','بانكيك لوتس'] },
    { id:55, name:'لقيمات نوتيلا',     cat:'حلويات',  price:25, active:true, keys:['لقيمات نوتيلا','لقيمة نوتيلا','لقيمات','لقيمه نوتيلا','لقيمات نوتيلا ب'] },
    { id:56, name:'لقيمات لوتس',       cat:'حلويات',  price:25, active:true, keys:['لقيمات لوتس','لقيمة لوتس'] },
    { id:57, name:'كنافة نابلسية',     cat:'حلويات',  price:30, active:true, keys:['كنافة نابلسية','كنافه نابلسيه','كنافة نابلسيه','نابلسية','نابلسيه','كنافة نابلسية ب'] },
    { id:58, name:'آيس كافي كراميل',   cat:'مشروبات', price:12, active:true, keys:['ايس كافي كراميل','آيس كافي كراميل','كافي كراميل','ايس كافي','آيس كافي','ايس كوفي','ايس كوفيه','آيس كوفي','ايس كافيه'] },
    { id:59, name:'آيس كافي نوتيلا',   cat:'مشروبات', price:12, active:true, keys:['ايس كافي نوتيلا','آيس كافي نوتيلا','كافي نوتيلا','ايس كافي نوتيلا'] },
    { id:60, name:'كولا كبير',         cat:'مشروبات', price:10, active:true, keys:['كولا كبير','كولا','كوكاكولا','كوكا','كوكا كولا'] },
    { id:61, name:'سبرايت',            cat:'مشروبات', price:10, active:true, keys:['سبرايت','سبريت'] },
    { id:62, name:'بيبسي',             cat:'مشروبات', price:10, active:true, keys:['بيبسي','بيبسى'] },
    { id:63, name:'ميرندا',            cat:'مشروبات', price:10, active:true, keys:['ميرندا'] },
    { id:64, name:'كول سلو',           cat:'سلطة',    price:10, active:true, keys:['كول سلو','كولسلو','كولسلاو','سلطة كول سلو'] },
    { id:65, name:'ذرة بمايونيز',      cat:'سلطة',    price:10, active:true, keys:['ذرة بمايونيز','ذرة مايونيز','ذرة','سلطة ذرة','ذره بمايونيز'] },
    { id:66, name:'بيكانتي',           cat:'سلطة',    price:10, active:true, keys:['بيكانتي','بيكانتى','بيكانتو','سلطة بيكانتي','صحن بيكانتي'] },
    { id:67, name:'بيتا شاورما',       cat:'شاورما',  price:25, active:true, keys:['بيتا شاورما','بيتا','فراشيح شاورما'] },
    { id:68, name:'فرشوحة شاورما',     cat:'شاورما',  price:25, active:true, keys:['فرشوحة شاورما','فرشوحه شاورما','فرشوحة الشاورما'] },
    { id:69, name:'ميجا شاورما',       cat:'شاورما',  price:50, active:true, keys:['ميجا شاورما','ميجا'] },
  ],
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
  nextId: 100,
  nextOrderNum: 10001,
  botConnected: false,
  customerProfiles: {}, // بيانات الزبائن المتكررين
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
};

// ============================================================
// PERSISTENCE — Firebase Firestore
// ============================================================
const { initializeApp, cert }  = require('firebase-admin/app');
const { getFirestore }         = require('firebase-admin/firestore');

// قراءة Service Account من متغير البيئة
const _sa = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!_sa) { console.error('❌ FIREBASE_SERVICE_ACCOUNT غير موجود!'); process.exit(1); }
initializeApp({ credential: cert(JSON.parse(_sa)) });
const db        = getFirestore();
const STATE_DOC = db.collection('o2bot').doc('state');

// debounce — لا نكتب لـ Firebase أكثر من مرة كل 3 ثواني
let saveTimer = null;
function saveState() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try { await STATE_DOC.set(STATE); }
    catch(e) { console.log('⚠️ Firebase save:', e.message); }
  }, 3000);
}
async function saveStateNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try { await STATE_DOC.set(STATE); }
  catch(e) { console.log('⚠️ Firebase saveNow:', e.message); }
}

async function loadState() {
  try {
    const snap = await STATE_DOC.get();
    if (!snap.exists) {
      console.log('📝 Firebase: أول تشغيل — حفظ البيانات الافتراضية');
      await saveStateNow();
      return;
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
    if (saved.categories    && saved.categories.length)    STATE.categories    = saved.categories;
    if (saved.replies       && saved.replies.length)       STATE.replies       = saved.replies;
    if (saved.deliveryZones && saved.deliveryZones.length) STATE.deliveryZones = saved.deliveryZones;
    const CODE_COUNT = STATE.items.length;
    if (saved.items && saved.items.length >= CODE_COUNT) {
      STATE.items = saved.items;
      console.log('✅ Firebase: ' + saved.items.length + ' صنف محمّل');
    } else if (saved.items) {
      const custom = saved.items.filter(i => i.id >= 100);
      if (custom.length) STATE.items.push(...custom);
    }
    console.log('✅ Firebase: state محمّل (' + STATE.orders.length + ' طلب)');
  } catch(e) { console.log('⚠️ Firebase loadState:', e.message); }
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
  };
}

function getSession(from) {
  if (!sessions[from]) sessions[from] = makeSession(from);
  return sessions[from];
}

function resetSession(from) {
  sessions[from] = makeSession(from);
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

// ============================================================
// إعادة الاتصال — الطريقة الصحيحة
// ============================================================
let isRestarting = false;
let reconnectAttempts = 0;

function scheduleReconnect(delayMs = 5000) {
  if (isRestarting) return;
  isRestarting = true;
  reconnectAttempts++;
  const delay = Math.min(delayMs * reconnectAttempts, 60000); // max دقيقة
  console.log(`🔄 إعادة الاتصال خلال ${delay / 1000}s (محاولة ${reconnectAttempts})`);
  setTimeout(async () => {
    isRestarting = false;
    try {
      await client.destroy();
    } catch(e) {}
    try {
      await client.initialize();
    } catch(e) {
      console.log('فشلت إعادة الاتصال:', e.message);
      scheduleReconnect(10000);
    }
  }, delay);
}

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
const ITEM_ALIASES = {
  'الصاروخ':'ستيك دجاج مشوي','صاروخ':'ستيك دجاج مشوي',
  'دوبل لحمة':'فرشوحة دبل لحمة','دبل لحمة':'فرشوحة دبل لحمة',
  'الكلزوني':'كالزوني دجاج','كلزوني':'كالزوني دجاج',
  'وقية شيش':'شيش طاووق',
  'شيبس بطاطس':'بطاطا كبير','علبة بطاطا':'بطاطا كبير',
  'تشكن بيتزا':'بيتزا مكسيكي دجاج','تشيكن بيتزا':'بيتزا مكسيكي دجاج',
  'فراشيح عادية':'فرشوحة عادي','فراشيح عادي':'فرشوحة عادي',
  'فراشيح شاورما':'فرشوحة شاورما',
  'شاورما عادي':'صحن شاورما','صحن شاورما ب ٣٠':'صحن شاورما',
  'سلطة مشكلة':'سلطات وسط','صحن سلطه مشكل':'سلطات وسط',
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

      // مطابقة كلمة واحدة من عدة كلمات (مثل "ستيك" من "ستيك دجاج مشوي")
      const qWords = q.split(' ');
      for (const w of kn.split(' ')) {
        if (w.length < 4) continue; // تجاهل الكلمات القصيرة جداً
        const wd = levenshtein(qWords[0] || q, w);
        // نفس الحرف الأول + طول متقارب
        if (wd > 0 && (qWords[0]||q)[0] !== w[0]) continue;
        const wLen = Math.min((qWords[0]||q).length, w.length);
        const wThreshold = wLen <= 4 ? 0 : wLen <= 6 ? 1 : 2;
        if (wd <= wThreshold && wd < bestScore) { bestScore = wd; best = item; }
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
// GROQ AI — فهم الرسائل الصعبة مجاناً
// ============================================================
// groq.com → مجاني → Create API Key → انسخه في Render Environment
const GROQ_KEY = process.env.GROQ_API_KEY || '';

async function askGroq(systemPrompt, userMsg) {
  if (!GROQ_KEY) return null;
  try {
    const res = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMsg },
        ],
        max_tokens: 200,
        temperature: 0.1,
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

  const systemPrompt = `أنت مساعد ذكي لمطعم "${STATE.settings.name}" في غزة.
مهمتك: فهم رسائل الزبائن باللهجة الفلسطينية/العامية وتحويلها لأوامر واضحة.

قائمة الأصناف المتاحة:
${itemsList}

${cartInfo}

قواعد مهمة:
- إذا الزبون طلب صنف موجود في القائمة (بأي طريقة كتابة أو لهجة) → أجب بـ: ORDER:اسم_الصنف_بالضبط:الكمية
- إذا يسأل عن سعر → أجب بـ: PRICE:اسم_الصنف
- إذا يريد حذف صنف من السلة → أجب بـ: REMOVE:اسم_الصنف
- إذا يريد تأكيد الطلب → أجب بـ: CONFIRM
- إذا يريد إلغاء → أجب بـ: CANCEL
- إذا الزبون يسأل عن قسم كامل مش صنف محدد (مثل "شاورما" وحدها أو "بيتزا" أو "حلويات") → أجب بـ: MENU_CAT:اسم_القسم
  الأقسام المتاحة: شاورما، ايطالي، ساندويش، سلطة، مشروبات، حلويات
- إذا ثرثرة أو تحية → أجب بـ: SKIP
- إذا ما فهمت → أجب بـ: UNKNOWN

أمثلة:
"بدي صاروخ" → ORDER:ستيك دجاج مشوي:1
"كلزوني" → ORDER:كالزوني دجاج:1
"دوبل لحمة" → ORDER:فرشوحة دبل لحمة:1
"وقية شيش" → ORDER:شيش طاووق:1
"بكم الزنجر" → PRICE:زنجر
"شيل الزنجر" → REMOVE:زنجر
"تمام" → CONFIRM
"مرحبا" → SKIP

أجب بسطر واحد فقط بدون شرح.`;

  const aiResponse = await askGroq(systemPrompt, rawMsg);
  if (!aiResponse) return null;

  console.log(`🤖 Groq: "${rawMsg}" → "${aiResponse}"`);

  // تعلّم تلقائياً من إجابة AI
  if (aiResponse.startsWith('ORDER:')) {
    const parts    = aiResponse.split(':');
    const itemName = parts[1]?.trim();
    const qty      = parseInt(parts[2]) || 1;
    const item     = STATE.items.find(i => normalize(i.name) === normalize(itemName || ''));

    if (item && item.active) {
      // ✅ AI فهم — أضف للسلة
      if (!session.cart) session.cart = [];
      addToCart(session, item, qty);

      // تعلّم: أضف alias تلقائياً
      const rawNorm = normalize(rawMsg);
      if (!item.keys.some(k => normalize(k) === rawNorm) && rawMsg.length > 1) {
        item.keys.push(rawMsg);
        addLog(`🤖 AI تعلّم: "${rawMsg}" → ${item.name}`);
        // علّم entry في unknowns
        const entry = (STATE.unknowns||[]).find(u => u.raw === rawMsg);
        if (entry) { entry.status = 'added'; entry.aiLearned = true; }
        saveState();
      }

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

  if (aiResponse === 'SKIP') return null; // تجاهل بدون رد

  // UNKNOWN — AI ما فهم
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
  const icons = { شاورما:'🥙', ايطالي:'🍕', ساندويش:'🍔', سلطة:'🥗', مشروبات:'☕', حلويات:'🍰' };
  return `${icons[cat]||'🍽️'} *${cat}*\n─────────────\n${items.map(i => `${i.name} ... ${i.price} ₪`).join('\n')}`;
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
  const exactItem = STATE.items.find(i => i.active && i.keys.some(k => normalize(k) === t));
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
  const REPLACE_FULL = /^(?:بدل(?:ها|ه|و)?|غير(?:ها|ه)?|حول(?:ها|ه)?|عوّ?ض(?:ها|ه)?)\s+(.+?)\s+(?:بـ?|بـ|ب|بدالها?|بدالو?|ببدل(?:ها|ه)?)\s*(.+)$/i;
  const replFull = t.match(REPLACE_FULL);
  if (replFull) {
    actions.push({ type: 'replace', from: replFull[1].trim(), to: replFull[2].trim() });
    return actions;
  }

  // "بدلها Y" / "بدله Y" — بدون بـ (يأخذ آخر صنف)
  const REPLACE_NOFROM_NOB = /^(?:بدل(?:ها|ه|و)?|غير(?:ها|ه)?)\s+(?!بـ|ب\s)(.+)$/i;
  const noFromNoBMatch = t.match(REPLACE_NOFROM_NOB);
  if (noFromNoBMatch) {
    const candidate = noFromNoBMatch[1].trim();
    // تأكد إنه مش "بدل X بـ Y" (تم التعامل معه فوق)
    if (!/\s+(?:بـ?|بـ|ب)\s+/.test(candidate)) {
      actions.push({ type: 'replace', from: '__last__', to: candidate });
      return actions;
    }
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
      const inCart = session.cart.find(c => c.name === item.name);
      if (!inCart) { notFound.push(action.name); continue; }
      removeFromCart(session, item.name);
      removed.push(item.name);
    } else if (action.type === 'replace') {
      const toItem = findItem(cleanItemQuery(action.to));
      if (!toItem) { notFound.push(action.to); continue; }
      if (!toItem.active) { unavailable.push(toItem.name); continue; }

      let fromItem = null;
      let fromQty = 1;
      if (action.from === '__last__') {
        // خلّيها/بدله بـ — يأخذ آخر صنف أُضيف للسلة
        const lastEntry = session.cart[session.cart.length - 1];
        if (lastEntry) { fromItem = { name: lastEntry.name }; fromQty = lastEntry.qty; }
      } else {
        fromItem = findItem(cleanItemQuery(action.from));
        const inCart = session.cart.find(c => c.name === fromItem?.name);
        fromQty = inCart?.qty || 1;
      }
      if (!fromItem) { notFound.push(action.from); continue; }
      const fromInCart = session.cart.find(c => c.name === fromItem.name);
      if (!fromInCart) { notFound.push(fromItem.name); continue; }
      removeFromCart(session, fromItem.name);
      addToCart(session, toItem, fromQty);
      replaced.push(`${fromItem.name} → ${toItem.name}`);

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
  const lines = raw.split(/\n/).map(l => l.trim()).filter(l => l.length > 1);
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
    return await client.sendMessage(chatId, text);
  } catch(e) {
    console.log('خطأ في القروب:', e.message);
    return null;
  }
}

// ============================================================
// MAIN MESSAGE HANDLER
// ============================================================
async function handleMessage(msg) {
  const from = msg.from;
  const rawOriginal = msg.body?.trim() || '';
  if (!rawOriginal) return null;

  const session = getSession(from);
  session.from = from;
  session.lastActivity = Date.now();

  if (!STATE.settings.botActive) return null;

  const raw = fixSpelling(translateEN(rawOriginal));
  const text = raw.toLowerCase();

  // وضع الموظف البشري
  if (STATE.settings.transferMode) {
    let q = STATE.queue.find(q => q.phone === from);
    if (!q) {
      q = { phone: from, time: new Date().toLocaleTimeString('ar'), msgs: [] };
      STATE.queue.push(q);
      addLog(`👨‍💼 زبون في الانتظار: ${from}`);
    }
    q.msgs.push(rawOriginal);
    if (q.msgs.length > 50) q.msgs = q.msgs.slice(-50);
    saveState();
    return `شكراً! أحد موظفينا سيتواصل معك قريباً 👨‍💼\nأوقات الدوام: ${STATE.settings.hours}`;
  }

  // إلغاء
  if (/^(الغاء|إلغاء|كنسل|بطل|وقف)$/.test(text)) {
    clearPendingOrder(from);
    resetSession(from);
    return 'تم الإلغاء ❌ أهلاً بك في أي وقت 🌿';
  }

  // ====== طلب معلق — تحقق عند أول رسالة للزبون ======
  if (!session.state && !session.cart.length) {
    const po = getPendingOrder(from);
    if (po) {
      // زبون عنده طلب معلق — نسأله
      session.state = 'pending_order_choice';
      session._pendingOrder = po;
      const age = Math.round((Date.now() - po.savedAt) / 60000);
      const ageText = age < 60 ? `منذ ${age} دقيقة` : `منذ ${Math.round(age/60)} ساعة`;
      return `مرحباً! 👋 عندك طلب غير مكتمل (${ageText}):

${pendingOrderSummary(po)}

1️⃣ *أكمل التحويل للطلب القديم*
2️⃣ *اطلب جديد*
3️⃣ *إلغاء الطلب القديم*`;
    }
  }

  // استئناف طلب معلق
  if (session.state === 'pending_order_choice') {
    const po = session._pendingOrder;
    if (/^(1|أكمل|اكمل|نفس الطلب|الطلب القديم|نفسو|أكملو|اكملو)$/i.test(text)) {
      // استئناف — اعادة بناء السلة وانتقل لـ transfer_name
      session.cart       = po.cart;
      session.name       = po.name;
      session.phone      = po.phone;
      session.address    = po.address || '';
      session.deliveryType = po.deliveryType;
      session.deliveryFee  = po.deliveryFee || 0;
      session.note       = po.note || '';
      session.orderNum   = po.orderNum;
      session.state      = 'transfer_name';
      clearPendingOrder(from);
      return `تمام! 😊 نكمل طلبك #${po.orderNum}

${pendingOrderSummary(po)}

أرسل *الاسم اللي حوّلت منه* 👇

بيانات التحويل:
الاسم: *${STATE.settings.bankName}*
البنك: *${STATE.settings.bank}*
جوال: *${STATE.settings.bankPhone}*`;
    }
    if (/^(2|جديد|طلب جديد|بدي اطلب|اطلب)$/i.test(text)) {
      clearPendingOrder(from);
      session.state = null; session._pendingOrder = null;
      return `تمام! 🛒 قولي شو بدك تطلب 😊`;
    }
    if (/^(3|الغاء|إلغاء|لا|لأ)$/i.test(text)) {
      clearPendingOrder(from);
      session.state = null; session._pendingOrder = null;
      return `تم إلغاء الطلب القديم ✅ أهلاً بك في أي وقت 🌿`;
    }
    return `اختار:
1️⃣ أكمل التحويل
2️⃣ طلب جديد
3️⃣ إلغاء الطلب القديم`;
  }

  // ====== تتبع الطلب ======
  const isTrack = /وين طلبي|وين الطلب|حالة الطلب|شو صار|طلع الطلب|تحرك الطلب|وصل طلبي/i.test(text)
    || /^#?\d{1,6}$/.test(text.trim());
  if (isTrack) {
    const tOrd = (STATE.orders||[]).find(o=>o.customerPhone===from&&!['delivered','picked_up','cancelled'].includes(o.status));
    const stMap = {
      pending_payment:'⏳ انتظار تأكيد التحويل',
      payment_confirmed:'✅ تم تأكيد الدفع — قيد التجهيز',
      added_to_system:'📥 دخل للنظام — قيد التحضير',
      preparing:'👨‍🍳 قيد التحضير الآن',
      ready:'🔔 جاهز — ينتظر الديلفري',
      out_for_delivery:`🚗 في الطريق${tOrd?.driverName?' مع '+tOrd.driverName:''}`,
      ready_pickup:'🔔 جاهز للاستلام',
    };
    if (tOrd) return `📦 طلبك *#${tOrd.id}*\n${stMap[tOrd.status]||tOrd.status}\n💰 المجموع: *${tOrd.grandTotal||tOrd.total} ₪*`;
    return `ما عندنا طلب نشط لك حالياً 😊\nقولي شو بدك تطلب!`;
  }

  // سؤال عن الحساب
  if (/كم الحساب|كم بيطلع|كم المبلغ|كم احول|كم بدفع|الحساب كم|بكم الطلب/.test(text)) {
    if (session.cart.length) {
      const total = cartTotal(session.cart) + (session.deliveryFee || 0);
      return `💰 حسابك: *${total} ₪*\n${cartText(session.cart)}${session.deliveryFee ? `\n+ توصيل: ${session.deliveryFee} ₪` : ''}\n\nأرسل *تأكيد* لإتمام الطلب 😊`;
    }
    return `ما في طلب حالي 😊 قولي شو بدك!`;
  }

  // وقت التحضير
  if (/وقت|كم بياخذ|متى جاهز|بتوصل امتى|قديش بياخذ/.test(text)) {
    const t = STATE.settings.estimatedTime || 30;
    const ready = new Date(Date.now() + t * 60000);
    return `⏱️ وقت التحضير: *${t} دقيقة* (تقريباً ${ready.getHours().toString().padStart(2,'0')}:${ready.getMinutes().toString().padStart(2,'0')}) 😊`;
  }

  // ====== PRIORITY 1: tryQuickOrder — دايماً أول شي ======
  const hasNewlines = raw.includes('\n');
  const looksLikeOrder = raw.length > 30 && /\d|[١٢٣٤٥٦٧٨٩]/.test(raw);
  if (hasNewlines || looksLikeOrder) {
    const inOrdering = session.state === 'ordering' || session.state === null;
    const qr = tryQuickOrder(session, raw, inOrdering);
    if (qr) return qr;
  }

  // ====== PRIORITY 1.5: اسم قسم ← عرض المنيو ======
  // لما يكتب "شاورما" أو "بيتزا" أو "مشروبات" — يعرض منيو القسم
  const catQuery = detectCategoryQuery(text);
  if (catQuery) {
    return getMenuText(catQuery) + '\n\nقولي شو بدك تطلب من قائمتنا 😊';
  }

  // ====== PRIORITY 1.8: تحيات واجتماعيات → رد لطيف ======
  // "كيف حالك" / "شو اخبارك" / "كيف الاحوال" → يرد ويسأل عن الطلب
  if (/^(كيف حالك|كيف الحال|كيف اخبارك|شو اخبارك|كيف الاحوال|عامل كيف|كيف عامل|ايش اخبارك|شو اخبارك|كيفك|كيفكم|كيف حالكم)[\s؟?!]*$/i.test(text)) {
    return `الحمد لله بخير! 😊
${STATE.settings.welcome || 'شو بدك اليوم؟ 🌿'}`;
  }
  if (/^(صباح|مساء)/.test(text) && text.length < 20) {
    const isM = /صباح/.test(text);
    return `${isM ? 'صباح النور' : 'مساء النور'} 🌿
أهلاً بك في ${STATE.settings.name}!
شو بدك تطلب اليوم؟ 😊`;
  }

  // ====== PRIORITY 2: الردود الثابتة ======
  const hasOrderIntent = /بدي|عايز|اريد|أريد|اطلب/.test(text);
  if (!session.state && !session.cart.length && !hasOrderIntent) {
    for (const r of STATE.replies) {
      if (!r.active) continue;
      if (r.keys.some(k => text.includes(k.toLowerCase()))) return r.text;
    }
  }

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
        return `${item.name} متوفر ✅ — *${item.price} ₪*\n\nبدك تطلبه؟ (نعم / لا)`;
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

    // سجّل للتعلم + اسأل AI
    logUnknown(from, rawOriginal, {state:'ordering', cartItems:session.cart.length});
    // حاول AI فوراً
    tryAIUnderstand(from, rawOriginal, session).then(aiReply => {
      if (aiReply) {
        // AI فهم — أرسل الرد
        client.sendMessage(from, aiReply).catch(()=>{});
      }
    }).catch(()=>{});
    return `هممم... 🤔 بحاول أفهم "${rawOriginal}"\nثانية واحدة...`;
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

  logUnknown(from, rawOriginal, {state:null,cartItems:0});
  // حاول AI إذا الرسالة تبدو طلباً
  if (GROQ_KEY && rawOriginal.length > 1) {
    tryAIUnderstand(from, rawOriginal, sessions[from] || {cart:[]}).then(aiReply => {
      if (aiReply) client.sendMessage(from, aiReply).catch(()=>{});
    }).catch(()=>{});
    return `ثانية... 🤔`;
  }
  return STATE.settings.defaultReply;
}

// ============================================================
// HTTP SERVER & API
// ============================================================
let currentQR = '';

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (url === '/ping') { res.writeHead(200); res.end('ok'); return; }
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
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let parsed;
      try { parsed = body ? JSON.parse(body) : {}; }
      catch(e) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'Invalid JSON: ' + e.message}));
        return;
      }
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

async function handleAPI(url, method, body, res) {
  const json = (data, code = 200) => {
    if (res.writableEnded) return;
    res.writeHead(code, {'Content-Type':'application/json'});
    res.end(JSON.stringify(data));
  };

  // ---- READ ----
  if (url === '/api/state'  && method === 'GET') return json(STATE);
  if (url === '/api/status' && method === 'GET') return json({
    botConnected: STATE.botConnected,
    transferMode: STATE.settings.transferMode,
    botActive: STATE.settings.botActive,
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

  // ---- BOT CONTROL ----
  if (url === '/api/bot/restart' && method === 'POST') {
    addLog('🔄 إعادة تشغيل من الداشبورد');
    STATE.botConnected = false;
    reconnectAttempts = 0;
    scheduleReconnect(1000);
    return json({ok: true});
  }
  if (url === '/api/bot/disconnect' && method === 'POST') {
    addLog('⏹️ قطع الاتصال من الداشبورد');
    STATE.botConnected = false;
    try { client.destroy(); } catch(e) {}
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
    client.sendMessage(order.customerPhone, body.text || '').then(() => {
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
    };
    STATE.items.push(item);
    saveState();
    addLog(`➕ أُضيف: ${item.name}`);
    return json({ok: true, item});
  }
  const itemMatch = url.match(/^\/api\/items\/(\d+)$/);
  if (itemMatch && method === 'PUT') {
    const idx = STATE.items.findIndex(i => i.id === parseInt(itemMatch[1]));
    if (idx === -1) return json({error: 'not found'}, 404);
    if (body.price !== undefined) body.price = Number(body.price);
    Object.assign(STATE.items[idx], body);
    saveState();
    addLog(`✏️ عُدّل: ${STATE.items[idx].name}`);
    return json({ok: true, item: STATE.items[idx]});
  }
  if (itemMatch && method === 'DELETE') {
    const item = STATE.items.find(i => i.id === parseInt(itemMatch[1]));
    if (!item) return json({error: 'not found'}, 404);
    STATE.items = STATE.items.filter(i => i.id !== parseInt(itemMatch[1]));
    saveState();
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
    client.sendMessage(q.phone, body.text || '').then(() => {
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
    if (!waSocket) return;
    const jid = to.includes('@') ? to : to.replace(/\D/g,'') + '@s.whatsapp.net';
    try { await waSocket.sendMessage(jid, { text }); } catch(e) {}
  },
};

async function startBaileys() {
  try {
    // حفظ جلسة واتساب في مجلد baileys_auth
    const { state: authState, saveCreds } = await useMultiFileAuthState('./baileys_auth');
    const { version } = await fetchLatestBaileysVersion();

    waSocket = makeWASocket({
      version,
      auth:                  authState,
      logger:                pino({ level: 'silent' }),
      browser:               Browsers.ubuntu('Chrome'),
      printQRInTerminal:     false,
      connectTimeoutMs:      60000,
      keepAliveIntervalMs:   25000,
      retryRequestDelayMs:   500,
    });

    // حفظ بيانات الجلسة عند كل تحديث
    waSocket.ev.on('creds.update', saveCreds);

    // ── QR + اتصال + قطع ──────────────────────────────────
    waSocket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        STATE.botConnected = false;
        console.log('📱 QR جاهز — افتح /qr في الداشبورد');
        // ينتهي QR بعد دقيقة
        setTimeout(() => { if (currentQR === qr) currentQR = ''; }, 60000);
      }

      if (connection === 'open') {
        currentQR = '';
        STATE.botConnected = true;
        addLog('✅ البوت اتصل بواتساب (Baileys)');
        console.log('✅ Baileys متصل!');
      }

      if (connection === 'close') {
        STATE.botConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut  = statusCode === DisconnectReason.loggedOut;
        addLog(`⚠️ انقطع الاتصال (${statusCode})`);
        console.log('⚠️ انقطع:', statusCode, loggedOut ? '— تسجيل خروج' : '— إعادة اتصال');
        if (!loggedOut) {
          // إعادة اتصال تلقائية بعد 5 ثواني
          setTimeout(startBaileys, 5000);
        } else {
          addLog('❌ تسجيل خروج — احذف مجلد baileys_auth وأعد المسح');
          console.log('❌ احذف مجلد baileys_auth من Render وأعد تشغيل السيرفر');
        }
      }
    });

    // ── استقبال الرسائل ───────────────────────────────────
    waSocket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        try {
          if (msg.key.fromMe) continue;
          const jid = msg.key.remoteJid;
          if (!jid || jid.endsWith('@g.us')) continue; // تجاهل المجموعات

          // استخراج النص من أنواع الرسائل المختلفة
          const body = msg.message?.conversation
            || msg.message?.extendedTextMessage?.text
            || msg.message?.buttonsResponseMessage?.selectedDisplayText
            || msg.message?.listResponseMessage?.title
            || '';
          if (!body.trim()) continue;

          // typing indicator
          await waSocket.sendPresenceUpdate('composing', jid);
          await new Promise(r => setTimeout(r, 400 + Math.random() * 400));

          // بناء msgObj متوافق مع handleMessage
          const msgObj = {
            from:  jid,
            body:  body,
            reply: async (text) => {
              if (waSocket) await waSocket.sendMessage(jid, { text });
            },
          };

          const reply = await handleMessage(msgObj);
          if (!reply) { await waSocket.sendPresenceUpdate('paused', jid); continue; }

          await waSocket.sendPresenceUpdate('paused', jid);

          if (Array.isArray(reply)) {
            for (let i = 0; i < reply.length; i++) {
              if (i > 0) {
                await new Promise(r => setTimeout(r, 700 + Math.random() * 400));
                await waSocket.sendPresenceUpdate('composing', jid);
                await new Promise(r => setTimeout(r, 400));
                await waSocket.sendPresenceUpdate('paused', jid);
              }
              await waSocket.sendMessage(jid, { text: reply[i] });
            }
          } else {
            await waSocket.sendMessage(jid, { text: reply });
          }
        } catch(err) {
          console.error('خطأ رسالة:', err.message);
        }
      }
    });

  } catch(err) {
    console.error('❌ Baileys startError:', err.message);
    setTimeout(startBaileys, 10000);
  }
}

// ============================================================
// KEEP-ALIVE — يمنع Render من النوم كل 14 دقيقة
// ============================================================
const SELF_URL = process.env.RENDER_EXTERNAL_URL
  ? process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '')
  : `http://localhost:${PORT}`;

setInterval(() => {
  http.get(SELF_URL + '/ping', res => res.resume()).on('error', () => {});
  console.log('🏓 keep-alive ping');
}, 14 * 60 * 1000);

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
  await loadState();
  console.log('✅ state محمّل من Firebase');
  startBaileys();
})();
