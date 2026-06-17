# دليل الرفع الكامل — O2 Bot
## مجاني 100% | Render + Firebase + GitHub

---

# الخطوة 1 — Firebase (قاعدة البيانات)

### 1.1 إنشاء المشروع
1. افتح: **https://console.firebase.google.com**
2. اضغط **"Create a project"**
3. اسم المشروع: `o2bot` ← Continue
4. **Disable** Google Analytics ← Create project
5. انتظر ~30 ثانية ← Continue

### 1.2 تفعيل Firestore
1. من القائمة الجانبية: **Build ← Firestore Database**
2. **Create database**
3. اختر **Start in test mode** ← Next
4. اختر أي منطقة (مثل `eur3`) ← **Enable**
5. انتظر ~1 دقيقة

### 1.3 تحميل مفتاح الدخول (Service Account)
1. اضغط على أيقونة **⚙️ (Project Settings)** في الشريط الجانبي
2. اختر تبويب **Service accounts**
3. اضغط **"Generate new private key"**
4. اضغط **"Generate key"** في النافذة
5. سيُنزَّل ملف JSON — **احتفظ به جيداً**

---

# الخطوة 2 — GitHub (حفظ الكود)

### 2.1 إنشاء حساب (إذا ما عندك)
- https://github.com/signup — مجاني بدون بطاقة

### 2.2 رفع الملفات
1. افتح: **https://github.com/new**
2. Repository name: `o2bot`
3. اختر **Private**
4. اضغط **Create repository**

### 2.3 رفع الملفات يدوياً (بدون git)
1. في صفحة الـ repo، اضغط **"uploading an existing file"**
2. اسحب وأفلت هذه الملفات:
   - `index.js`
   - `dashboard.html`
   - `package.json`
   - `.gitignore`
3. اضغط **Commit changes**

> **⚠️ لا ترفع ملف الـ JSON من Firebase أبداً**

---

# الخطوة 3 — Render (السيرفر المجاني)

### 3.1 إنشاء حساب
1. افتح: **https://render.com**
2. اضغط **"Sign up"** ← **Continue with GitHub**
3. وافق على الصلاحيات

### 3.2 إنشاء Web Service
1. من Dashboard اضغط **"New +"** ← **Web Service**
2. اختر **"Build and deploy from a Git repository"** ← Next
3. اختر حسابك ← اضغط **"o2bot"**
4. اضغط **Connect**

### 3.3 إعدادات السيرفر
```
Name:           o2bot
Region:         اختر أي واحد
Branch:         main
Runtime:        Node
Build Command:  npm install
Start Command:  node index.js
Instance Type:  Free
```

### 3.4 إضافة متغير Firebase (مهم جداً)
**قبل الضغط على Deploy:**

1. اسحب للأسفل لـ **"Environment Variables"**
2. اضغط **"Add Environment Variable"**
3. أدخل:
   - **Key:** `FIREBASE_SERVICE_ACCOUNT`
   - **Value:** افتح ملف الـ JSON الذي نزّلته من Firebase، **انسخ كل المحتوى** والصقه هنا

المحتوى يبدو هكذا:
```json
{"type":"service_account","project_id":"o2bot-xxxxx","private_key_id":"abc123",...}
```

4. اضغط **"Create Web Service"**
5. Render سيبدأ البناء (~3-5 دقائق)

---

# الخطوة 4 — مسح QR

### 4.1 انتظر اكتمال البناء
- في صفحة الـ service، شاهد الـ **Logs**
- انتظر حتى تظهر رسالة: `✅ السيرفر شغال`
- ملاحظة: رسالة `📱 QR جاهز` ستظهر في الـ Logs

### 4.2 افتح صفحة QR
- رابط السيرفر موجود أعلى الصفحة، مثل:
  ```
  https://o2bot.onrender.com
  ```
- افتح:
  ```
  https://o2bot.onrender.com/qr
  ```

### 4.3 مسح QR من واتساب
1. افتح واتساب على جوالك
2. **الإعدادات ← الأجهزة المرتبطة ← ربط جهاز**
3. امسح الـ QR من الشاشة
4. انتظر ~5 ثواني
5. في Logs ستظهر: `✅ Baileys متصل!`

**🎉 البوت يشتغل الآن 24/7!**

---

# الخطوة 5 — الداشبورد

الداشبورد موجود على:
```
https://o2bot.onrender.com/
```
افتح الرابط من أي جهاز أو جوال.

---

# مشاكل شائعة وحلها

| المشكلة | السبب | الحل |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT غير موجود` | نسيت إضافته | Render → Environment → أضفه |
| QR لا يظهر | السيرفر لم يكتمل | انتظر 3 دقائق وأعد تحميل الصفحة |
| Bot disconnected بعد إعادة التشغيل | Render مسح الملفات المؤقتة | امسح QR من جديد |
| Firebase permission denied | Firestore في production mode | غيّره لـ test mode في Firebase Console |
| Build failed | خطأ في package.json | تأكد من رفع package.json الصحيح |

---

# حفظ جلسة واتساب بشكل دائم (اختياري)

Render المجاني قد يمسح مجلد `baileys_auth` عند إعادة التشغيل.
لحل هذا مستقبلاً (مجاناً):

1. Render → Service → **Disks**
2. Add Disk:
   - **Name:** baileys-auth
   - **Mount Path:** `/opt/render/project/src/baileys_auth`
   - **Size:** 1 GB
3. Save — هذا يحفظ الجلسة للأبد

---

# الخلاصة

```
Firebase  → يحفظ البيانات (طلبات، منيو، زبائن)
GitHub    → يحفظ الكود
Render    → يشغّل البوت 24/7
Baileys   → يتصل بواتساب بدون Chromium
```

**كل شيء مجاني 100% — بدون بطاقة بنكية** ✅
