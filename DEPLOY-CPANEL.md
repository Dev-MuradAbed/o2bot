# تشغيل البوت على استضافة Namecheap (cPanel)

## مفتاح Firebase
لوحة الاستضافة تحذف علامات " من متغيرات البيئة، فلا تضع المفتاح في FIREBASE_SERVICE_ACCOUNT.
ضع ملف المفتاح داخل مجلد البوت باسم: firebase-key.json
(البوت يقبل أيضاً أي ملف اسمه ينتهي بـ firebase-adminsdk-....json في نفس المجلد)

## متغيرات البيئة (Setup Node.js App)
- SESSION_SECRET        نص عشوائي طويل
- RENDER_EXTERNAL_URL   https://bot.o2company.com
- لا تضع O2_TEST_MODE

## إعدادات التطبيق
- Node.js 22.x — Production — Application root: o2bot-git — Startup file: index.js

## بعد أي تحديث للكود
1. Git Version Control ← Manage ← Pull or Deploy ← Update from Remote (أو ارفع الملفات يدوياً)
2. Setup Node.js App ← Run NPM Install (فقط إن تغيّر package.json)
3. RESTART
4. السجل: ملف stderr.log داخل مجلد التطبيق
