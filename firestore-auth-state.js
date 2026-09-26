'use strict';

/**
 * بديل useMultiFileAuthState الأصلية من Baileys — بيحفظ جلسة واتساب
 * (creds + مفاتيح التشفير) بمستند Firestore واحد بدل مجلد على القرص
 * المحلي.
 *
 * ═ ليش هاد ضروري ═
 * Render (وأي استضافة free-tier مشابهة) بيمسح أي تغيير على القرص
 * المحلي كل ما الخدمة تنام أو تعيد تشغيل (spin down / redeploy).
 * يعني جلسة واتساب المحفوظة بـ ./baileys_auth كانت تنمسح بهالحالات،
 * فيضطر البوت يطلب مسح QR من جديد بدل ما يعيد الاتصال تلقائيًا.
 * Firestore ثابت بغض النظر عن حالة الخدمة، فالجلسة بتضل موجودة.
 *
 * ═ الاستخدام ═
 *   const { useFirestoreAuthState } = require('./firestore-auth-state');
 *   const { state, saveCreds } = await useFirestoreAuthState(AUTH_DOC);
 *   // AUTH_DOC = مرجع مستند Firestore (نفس نمط STATE_DOC بالمشروع)
 */

const { BufferJSON, initAuthCreds, proto } = require('@whiskeysockets/baileys');

async function useFirestoreAuthState(authDoc) {
  // نقرأ الجلسة المحفوظة (إن وُجدت) ونحوّلها من JSON نصي إلى كائنات
  // JS حقيقية (بما فيها Buffer) عبر BufferJSON.reviver — تمامًا متل
  // ما تفعل النسخة الأصلية بالقرص.
  let creds;
  let keys = {};
  try {
    const snap = await authDoc.get();
    if (snap.exists) {
      const raw = snap.data();
      if (raw && raw.json) {
        const parsed = JSON.parse(raw.json, BufferJSON.reviver);
        creds = parsed.creds;
        keys  = parsed.keys || {};
      }
    }
  } catch (e) {
    console.log('⚠️ فشلت قراءة جلسة واتساب من Firestore:', e.message);
  }
  if (!creds) creds = initAuthCreds();

  // نكتب الجلسة كاملة (creds + keys) بعملية واحدة — المستند صغير
  // (كيلوبايتات قليلة) فالكتابة سريعة ولا تحتاج تجزئة.
  async function persist() {
    const json = JSON.stringify({ creds, keys }, BufferJSON.replacer);
    await authDoc.set({ json, updatedAt: new Date().toISOString() });
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            let value = keys[`${type}-${id}`];
            if (value && type === 'app-state-sync-key') {
              // نفس ما تفعل useMultiFileAuthState الأصلية: يجب إعادة
              // بناء هذا النوع تحديدًا ككائن proto حقيقي، لا كائن JS عادي،
              // وإلا يفشل تزامن حالة واتساب لاحقًا بأخطاء غامضة.
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            if (value !== undefined) data[id] = value;
          }
          return data;
        },
        set: async (data) => {
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const k = `${category}-${id}`;
              if (value) keys[k] = value;
              else delete keys[k];
            }
          }
          await persist();
        },
      },
    },
    saveCreds: async () => {
      await persist();
    },
  };
}

module.exports = { useFirestoreAuthState };
