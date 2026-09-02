#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════
# فحص ما قبل الرفع — شغّله قبل كل git push
#   bash preflight.sh
# ══════════════════════════════════════════════════════════
set -u
FAIL=0
WARN=0
ok()   { echo "  ✅ $1"; }
bad()  { echo "  ❌ $1"; [ -n "${2:-}" ] && echo "     → $2"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠️  $1"; [ -n "${2:-}" ] && echo "     → $2"; WARN=$((WARN+1)); }
head() { echo ""; echo "════ $1 ════"; }

echo "🚀 فحص ما قبل الرفع"

# ── 1) الملفات الأساسية ──
head "1) الملفات"
for f in index.js auth.js menu-source.js menu-build.js dashboard.html package.json .gitignore; do
  [ -f "$f" ] && ok "$f" || bad "$f مفقود" "فُك حزمة البوت كاملة"
done
[ -f .firebaserc ] && ok ".firebaserc" || warn ".firebaserc مفقود" "firebase deploy سيفشل — firebase use --add"
[ -d public/menu ] && ok "public/menu ($(find public/menu -type f | wc -l | tr -d ' ') صورة)" \
  || warn "public/menu مفقود" "الصور لن تُنشر"

# ── 2) سلامة الكود ──
head "2) سلامة الكود"
for f in index.js auth.js menu-build.js menu-source.js doctor.js; do
  [ -f "$f" ] || continue
  if node --check "$f" 2>/dev/null; then ok "$f سليم نحوياً"
  else bad "$f فيه خطأ نحوي" "node --check $f"; fi
done

# ── 3) المنيو ──
head "3) المنيو"
if [ -f menu-build.js ]; then
  OUT=$(node menu-build.js 2>&1)
  N=$(echo "$OUT" | grep -oE 'الإجمالي: [0-9]+' | grep -oE '[0-9]+')
  DUP=$(echo "$OUT" | grep -c 'نعم ❌' || true)
  [ -n "$N" ] && ok "$N صنف" || bad "تعذّر بناء المنيو" "node menu-build.js"
  [ "$DUP" = "0" ] && ok "لا معرّفات ولا أسماء مكررة" || bad "يوجد تكرار" "راجع node menu-build.js"
  BADP=$(node -e "
    const {branchMenuData}=require('./menu-source');
    const s=new Set();
    for(const b of Object.values(branchMenuData))
      for(const c of Object.values(b))
        for(const i of c.items) if(i.image) s.add(i.image);
    const bad=[...s].filter(p=>!/^(\/menu\/|https?:\/\/)/.test(p));
    console.log(bad.length + (bad.length?'|'+bad[0]:''));
  " 2>/dev/null)
  if [ "${BADP%%|*}" = "0" ]; then ok "كل مسارات الصور بالشكل الصحيح"
  else bad "${BADP%%|*} مسار مشوّه مثل ${BADP#*|}" "يجب أن يبدأ بـ /menu/ أو https://"; fi
fi

# ── 4) الأسرار ──
head "4) الأسرار"
LOOSE=$(find . -path ./node_modules -prune -o -type f \
  \( -name '*adminsdk*' -o -name '*service-account*' -o -name 'FIREBASE_SERVICE_ACCOUNT*' -o -name '*.pem' \) -print 2>/dev/null)
if [ -n "$LOOSE" ]; then
  warn "ملفات مفاتيح في المجلد:" ""
  echo "$LOOSE" | sed 's/^/       /'
  echo "       انقلها خارج المشروع: mkdir -p ~/keys && mv <الملف> ~/keys/"
else ok "لا ملفات مفاتيح في المجلد"; fi

if git rev-parse --git-dir >/dev/null 2>&1; then
  T=$(git ls-files | grep -Ei 'adminsdk|service-account|FIREBASE_SERVICE_ACCOUNT|\.pem$' || true)
  [ -z "$T" ] && ok "لا مفاتيح متتبَّعة في git" \
    || { bad "مفاتيح متتبَّعة في git:" "git rm --cached \"<الملف>\""; echo "$T" | sed 's/^/       /'; }

  H=$(git grep -l -I -E "BEGIN [A-Z ]*PRIVATE KEY" $(git rev-list --all 2>/dev/null) 2>/dev/null | head -5 || true)
  if [ -z "$H" ]; then ok "تاريخ git نظيف"
  else
    bad "مفتاح داخل تاريخ git" "أبطل المفتاح من Google Cloud فوراً وأنشئ غيره"
    echo "$H" | sed 's/^/       /'
  fi

  grep -q 'adminsdk' .gitignore 2>/dev/null && ok ".gitignore يستثني المفاتيح" \
    || bad ".gitignore لا يستثني المفاتيح" "استخدم .gitignore المرفق بالحزمة"
else
  warn "ليس مستودع git"
fi

# ── 5) تجربة إقلاع ──
head "5) تجربة إقلاع محلية"
if [ -d node_modules ]; then
  LOG=$(mktemp)
  O2_TEST_MODE=1 SESSION_SECRET=preflight PORT=59999 timeout 15 node index.js > "$LOG" 2>&1 &
  PID=$!
  sleep 9
  if grep -q "السيرفر شغال" "$LOG"; then ok "الخدمة تقلع"
  else bad "الخدمة لا تقلع" "راجع الأسطر التالية:"; tail -6 "$LOG" | sed 's/^/       /'; fi
  grep -qiE "error|MODULE_NOT_FOUND" "$LOG" && { warn "أخطاء في الإقلاع:"; grep -iE "error|MODULE_NOT_FOUND" "$LOG" | head -3 | sed 's/^/       /'; }
  kill $PID 2>/dev/null; wait $PID 2>/dev/null
  rm -f "$LOG"
else
  warn "node_modules غير موجود — تخطّي تجربة الإقلاع" "npm install"
fi

# ── الخلاصة ──
head "الخلاصة"
if [ "$FAIL" = "0" ] && [ "$WARN" = "0" ]; then
  echo "  ✅ جاهز للرفع"
elif [ "$FAIL" = "0" ]; then
  echo "  ✅ لا مشاكل حاجبة · $WARN تنبيه — راجعها ثم ارفع"
else
  echo "  ❌ $FAIL مشكلة حاجبة · $WARN تنبيه"
  echo "  لا ترفع قبل إصلاح المشاكل الحاجبة."
fi
echo ""
[ "$FAIL" = "0" ]
