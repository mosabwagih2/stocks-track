# مقارنة النسخة العادية بنسخة PHP/MySQL

نسخة PHP موجودة **في فولدر منفصل (`php-app/`)** عشان نقدر نقارن الكود ونرجع للنسخة العادية في أي وقت. النسخة العادية (`apps/edition-3-brand-v2`) متتغيّرتش.

## الفرق في الواجهة (ملف واحد)
`php-app/app/views/app.html` بيتولّد من `apps/edition-3-brand-v2/index.html` بالسكريبت `php-app/frontend/build_app.py`. أي فرق هو **patch ظاهر ومتوثّق** في السكريبت (كل patch بيتأكد إن هدفه موجود مرة واحدة). للمقارنة:

```bash
diff <(cat apps/edition-3-brand-v2/index.html) php-app/app/views/app.html
```

| patch | بيعمل إيه |
|---|---|
| `load()` | بيبدأ من الحالة اللي السيرفر حطّها في الصفحة بدل `localStorage` |
| `save()` | بيبعت التغييرات للسيرفر (`FSYNC.push()`) بدل ما يكتب `localStorage` |
| `storeBanner()` | رسائل الاتصال والرفض بدل "تخزين المتصفح ممتلئ" |
| listener الـ `storage` | اتشال (السيرفر هو المصدر الوحيد) |
| `S.users.some(u=>u.pin)` ×2 | شاشة PIN اتلغت، الدخول جلسة سيرفر |
| `vAccess()` | شاشة المستخدمين بتكلّم الـ API، ومصفوفة الصلاحيات للقراءة |
| "قفل الشاشة / تبديل مستخدم" | "تسجيل الخروج" |
| `<script>` boot + `sync.js` | بيانات البداية + مزامنة التغييرات |

بقية التطبيق (حوالي 600KB) هي نفس الكود حرفيًا.

## الفرق في التخزين
| | النسخة العادية | نسخة PHP/MySQL |
|---|---|---|
| الحالة | `localStorage` على الجهاز | جداول MySQL |
| أكتر من جهاز / موظف | لا | أيوه، بتزامن كل ~12 ثانية |
| الدفتر (`moves`) | مصفوفة في JSON | جدول إضافة فقط |
| الصلاحيات | في الواجهة | **على السيرفر** (`Rules.php`) |
| الدخول | PIN اختياري في المتصفح | مستخدم وكلمة سر مشفّرة + حماية من التخمين |
| الأيام المقفولة / المستندات المؤكّدة | في الواجهة | **على السيرفر** |
| تعارض موظفين | غير ممكن | الأحدث بيترفض (409) ومفيش تغيير نص-مطبّق |
| الملفات الأصلية والصور | IndexedDB على الجهاز | **لسه IndexedDB** (الـ API جاهز، التوصيل المرحلة الجاية) |
| الداتا التجريبية | متاحة | معطّلة (متتحمّلش على سيرفر حقيقي) |

## شجرة الكود
```
php-app/
  public/            ← الـ document root: index.php, install.php, api/index.php, assets/sync.js, .htaccess
  app/src/           ← PHP: Database, Http/*, Auth/*, Sync/*, Files/*, Controllers/*, Migrator
  app/views/         ← app.html (مولَّد) و login.php
  sql/001_schema.sql ← مخطط MySQL
  frontend/          ← sync.js (المصدر) و build_app.py
  tools/             ← migrate.php, create_admin.php, import_backup.php
  tests/             ← run.php (API), e2e.js (متصفح), import_test.js (استيراد)
  docs/              ← DEPLOY.md, API.md, COMPARE.md
```
