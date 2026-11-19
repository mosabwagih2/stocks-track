# lovable-v2: تطبيق المتصفح لنظام Fémini Stock

ده التطبيق الشغّال على https://stock.whynet.shop. الـ build بتاعه (`npm run build:cpanel`) بيتكتب في `../php-app/public/app/`
والسيرفر (`../php-app/`) بيقدّمه وبيعمل الـ API والقواعد والدخول والملفات والمزامنة. اقرأ `../HANDOFF.md` الأول.

## نقطة الدخول
`cpanel.html` ← `src/spa/main.tsx`. كل حاجة تحت `src/femini/` (domain / data / hooks / pages / components).

## نسختين من نفس المحرّك
- **نسخة السيرفر (الشغّالة):** `serverEdition` في `src/femini/data/index.ts`. البيانات من السيرفر عن طريق `src/femini/data/cpanel/`.
- **نسخة المتصفح:** نفس `data/memory.ts` لكن بتخزّن في localStorage وبتبدأ من `src/femini/data/seed.json` (بيانات تجريبية). الاختبارات بتشتغل عليها،
  و`data/cpanel/fake-server.ts` نسخة TypeScript من قواعد `php-app/app/src/Sync/Rules.php` للاختبارات والسيرفر المحلي.

## الأوامر
```sh
npm install
npm test                  # vitest (الاختبارات اللي بتحتاج بيانات حقيقية بتتخطى لو متغيرات FEMINI_* مش موجودة)
npm run build:cpanel      # يبني النسخة الشغّالة
npx tsc --noEmit -p .     # فحص الأنواع
npx eslint .              # lint
```

## مش بتاعنا (من Lovable، سيبها)
`src/routes/`, `src/router.tsx`, `src/server.ts`, `src/start.ts`, `src/routeTree.gen.ts`, `src/integrations/supabase/`, `src/lib/error-*`, `bun.lock`, `drizzle/`, `supabase/`:
قشرة Lovable المتصلة بالـ repo. الإنتاج مش بيستخدمها. ما تمسحهاش من غير ما تتأكد إن Lovable مش بتعيد توليدها.
