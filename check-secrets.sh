#!/usr/bin/env bash
# يفحص المجلد وتاريخ git بحثاً عن أسرار قبل الرفع
set -u
echo "🔍 فحص الأسرار…"
echo ""
BAD=0

echo "── ملفات في المجلد ──"
FILES=$(find . -path ./node_modules -prune -o -type f \
  \( -name '*adminsdk*' -o -name '*service-account*' -o -name 'FIREBASE_SERVICE_ACCOUNT*' -o -name '*.pem' \) -print 2>/dev/null)
if [ -n "$FILES" ]; then
  echo "$FILES" | sed 's/^/  ⚠️  /'
  echo "  ← موجودة على القرص. تأكد أن .gitignore يستثنيها (الفحص التالي)."
else
  echo "  ✅ لا ملفات مفاتيح"
fi

echo ""
echo "── ملفات متتبَّعة في git ──"
if git rev-parse --git-dir >/dev/null 2>&1; then
  TRACKED=$(git ls-files | grep -Ei 'adminsdk|service-account|FIREBASE_SERVICE_ACCOUNT|\.pem$' || true)
  if [ -n "$TRACKED" ]; then
    echo "$TRACKED" | sed 's/^/  ❌ /'
    echo "  ← أخرجها:  git rm --cached \"الملف\""
    BAD=1
  else
    echo "  ✅ لا شيء"
  fi

  echo ""
  echo "── محتوى مشبوه في التاريخ ──"
  HITS=$(git grep -l -I -E "BEGIN [A-Z ]*PRIVATE KEY|\"private_key\"" $(git rev-list --all 2>/dev/null) 2>/dev/null | head -20 || true)
  if [ -n "$HITS" ]; then
    echo "$HITS" | sed 's/^/  ❌ /'
    echo "  ← التاريخ ملوّث. راجع خطوات التنظيف في UPGRADE.md"
    BAD=1
  else
    echo "  ✅ التاريخ نظيف"
  fi

  echo ""
  echo "── كوميتات لم تُرفع ──"
  git log --oneline @{u}..HEAD 2>/dev/null | sed 's/^/  /' || echo "  (لا فرع بعيد مضبوط)"
else
  echo "  (ليس مستودع git)"
fi

echo ""
[ "$BAD" = "0" ] && echo "✅ آمن للرفع" || { echo "❌ لا ترفع قبل التنظيف"; exit 1; }
