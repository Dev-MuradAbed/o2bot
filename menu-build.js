// يحوّل menu-source.js إلى الصيغة التي يفهمها البوت
'use strict';

const { categoryNames, categoryEmoji, branchMenuData, BRANCHES } = require('./menu-source');

/** تطبيع عربي خفيف لتوليد كلمات البحث */
function norm(s) {
  return String(s || '')
    .replace(/[\u064B-\u0652\u0670]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي')
    .replace(/[ةه]/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/\u0640/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** يولّد كلمات بحث من الاسم: الاسم كاملاً + بلا أقواس + كل كلمة مهمة */
function makeKeys(name) {
  const keys = new Set();
  const clean = name.replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
  keys.add(name.trim());
  if (clean && clean !== name.trim()) keys.add(clean);
  // الكلمات المميّزة (تتجاهل الحشو)
  const STOP = new Set(['عصير', 'قالب', 'قطع', 'كيك', 'صحن', 'مياه', 'معدنية', 'بيتزا', 'جيلاتو', 'صوص', 'ميني']);
  const words = clean.split(' ').filter((w) => w.length >= 3 && !STOP.has(w));
  if (words.length === 1) keys.add(words[0]);
  return [...keys].filter(Boolean);
}

const CATEGORY_ORDER = [
  'shawarma', 'italian', 'sandwiches', 'salads',
  'barSweets', 'westernSweets', 'easternSweets', 'gelato', 'drinks',
];

function buildCategories() {
  return CATEGORY_ORDER.map((id, i) => ({
    id,
    label: `${categoryEmoji[id] || '🍽️'} ${categoryNames[id]}`,
    name: categoryNames[id],
    emoji: categoryEmoji[id] || '🍽️',
    byWeight: id === 'easternSweets',
    order: i + 1,
    active: true,
  }));
}

function buildItems(startId = 1000) {
  const items = [];
  let id = startId;

  for (const branch of BRANCHES) {
    const menu = branchMenuData[branch.id];
    for (const cat of CATEGORY_ORDER) {
      const block = menu[cat];
      if (!block) continue;
      for (const raw of block.items) {
        const name = String(raw.name).trim();
        const item = {
          id: id++,
          branch: branch.id,
          cat,
          name,
          desc: raw.desc ? String(raw.desc).trim() : '',
          image: raw.image || '',
          active: raw.active !== false,
          keys: makeKeys(name),
          updatedBy: 'النظام',
          updatedRole: 'system',
          updatedAt: null,
        };
        if (raw.pricePerKg !== undefined) {
          item.pricePerKg = Number(raw.pricePerKg);
          item.price = Number(raw.pricePerKg);      // للتوافق مع الحسابات القديمة
        } else if (Array.isArray(raw.variants) && raw.variants.length) {
          item.variants = raw.variants.map((v) => ({ name: String(v.name).trim(), price: Number(v.price) }));
          item.price = Math.min(...item.variants.map((v) => v.price));
        } else {
          item.price = Number(raw.price) || 0;
        }
        items.push(item);
      }
    }
  }
  return items;
}

const MENU_VERSION = 'o2-branches-2026-06';

module.exports = { buildCategories, buildItems, MENU_VERSION, BRANCHES, norm };

/* تشغيل مباشر: تقرير تحقّق */
if (require.main === module) {
  const cats = buildCategories();
  const items = buildItems();
  console.log('الأقسام:', cats.length);
  for (const b of BRANCHES) {
    const bi = items.filter((i) => i.branch === b.id);
    console.log(`\n── ${b.label} (${bi.length} صنف) ──`);
    for (const c of cats) {
      const ci = bi.filter((i) => i.cat === c.id);
      if (!ci.length) continue;
      const off = ci.filter((i) => !i.active).length;
      console.log(`  ${c.label.padEnd(24)} ${String(ci.length).padStart(3)} صنف${off ? `  (${off} مغلق)` : ''}`);
    }
  }
  console.log('\nالإجمالي:', items.length, 'صنف');
  console.log('بالوزن :', items.filter((i) => i.pricePerKg).length);
  console.log('بأحجام :', items.filter((i) => i.variants).length);
  console.log('بوصف   :', items.filter((i) => i.desc).length);
  console.log('بصورة  :', items.filter((i) => i.image).length);
  const ids = items.map((i) => i.id);
  console.log('تكرار معرّفات:', ids.length !== new Set(ids).size ? 'نعم ❌' : 'لا ✅');
  const dup = {};
  for (const i of items) {
    const k = i.branch + '|' + norm(i.name);
    dup[k] = (dup[k] || 0) + 1;
  }
  const dups = Object.entries(dup).filter(([, n]) => n > 1);
  console.log('أسماء مكررة داخل نفس الفرع:', dups.length ? dups.map(([k, n]) => k + ' ×' + n).join('، ') : 'لا يوجد ✅');
}
