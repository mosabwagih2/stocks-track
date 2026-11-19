# Fémini Stock

مخزن المصنع الحقيقي، شغّال على **https://stock.whynet.shop**. النظام «لا يحتمل الخطأ»: اقرأ `HANDOFF.md` الأول.

| المسار | إيه هو |
|---|---|
| `php-app/` | السيرفر (PHP 8.2 + MySQL على cPanel): الـ API، القواعد، الدخول، الملفات، المزامنة. بيقدّم التطبيق من `php-app/public/app/`. |
| `lovable-v2/` | تطبيق المتصفح (React + TypeScript + Tailwind). `npm run build:cpanel` بيبني النسخة الشغالة جوه `php-app/public/app/` وبتتسجّل في Git. |
| `apps/edition-3-brand-v2/index.html` | نسخة «Brand 2» القديمة (ملف HTML واحد). فاضلة بس لأن `php-app/tests/import_test.js` بيعمل منها نسخة احتياطية ويختبر استيرادها. |
| `HANDOFF.md` | إزاي النظام مبني ومتعدّل ومتختبر ومتنشر، والقواعد اللي ما تتكسرش. |

## النسخ القديمة

النسخ الأولى (الملفات الوحيدة في `apps/`، و`variants/` و`web/` و`supabase/` و`src/` و`tests/` و`data/` و`docs/` اللي كانت في الجذر) اتشالت من الفرع الشغال.
كلها محفوظة في الـ tag **`archive/early-editions`**:

```sh
git checkout archive/early-editions     # يرجّعك لآخر حالة فيها النسخ القديمة
git show archive/early-editions:README.md   # الشرح القديم كامل
```

## تشغيل واختبار

```sh
cd lovable-v2
npm install
npm test                  # كل الاختبارات
npm run build:cpanel      # يبني التطبيق الشغّال إلى php-app/public/app/
```

اختبارات السيرفر: `php-app/tests/all.sh` (محتاج PHP وMySQL وPlaywright).
