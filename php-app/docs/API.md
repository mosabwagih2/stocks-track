# واجهة الـ API

كل الردود JSON. الأخطاء بالشكل `{"ok":false,"error":"<code>","message":"<نص عربي>"}`.
كل طلب غير GET لازم يبعت الهيدر `X-CSRF-Token` (بيجي من `login` أو `me`)، ما عدا `login` نفسه.
الجلسة كوكي `femini` (HttpOnly, SameSite=Lax, Secure على HTTPS).

| الطريقة | المسار | الصلاحية | الوصف |
|---|---|---|---|
| GET | `/api/health` | — | فحص تشغيل |
| POST | `/api/auth/login` | — | `{username,password}` ← `{user,csrf}`. بعد 5 محاولات غلط على نفس الاسم (أو 15 على نفس الـ IP) في 15 دقيقة ← 429 |
| POST | `/api/auth/logout` | مسجّل | ينهي الجلسة |
| GET | `/api/auth/me` | مسجّل | المستخدم وصلاحياته وتوكن CSRF |
| GET | `/api/sync/pull?since=N` | مسجّل | كل اللي اتغيّر بعد التعديل رقم N (0 = كل حاجة) |
| POST | `/api/sync/push` | حسب المحتوى | يطبّق مجموعة تغييرات بشكل ذرّي |
| GET | `/api/users` | `users` | قايمة المستخدمين والأدوار (بدون hashes) |
| POST | `/api/users` | `users` | `{username,name,role,password}` |
| PATCH | `/api/users/{id}` | `users` | `{name?,role?,active?,arch?}`. مفيش حذف، بس أرشفة. لازم يفضل مدير شغّال |
| POST | `/api/users/{id}/password` | `users` أو نفس المستخدم | `{password}` (8 حروف+) |
| POST | `/api/files` | حسب `kind` | multipart: `file, kind, owner_type, owner_id` |
| GET | `/api/files?owner_type=&owner_id=` | مسجّل | قايمة ملفات صاحب معيّن |
| GET | `/api/files/{id}[?thumb=1]` | مسجّل | تنزيل الأصل (أو النسخة المصغّرة) بنفس الاسم الأصلي |

## `sync/push`
```jsonc
{
  "since": 12,                       // آخر رقم تعديل شافه المتصفح
  "moves": [ {id,t,date,sku,q,from,to,type,doc,by,note} ],      // دفتر الحركات: إضافة فقط
  "coll": {                          // docs, orders, pickups, sup_items, sup_log, closes, shops, emps, archPk, archDocs
    "orders": { "up": [ {...الصف كامل...} ], "gone": ["ed4298"] }
  },
  "meta": { "mid": 5601, "st": {...} },                          // قيم مفردة (إعدادات، عدّادات، كتالوج، قفل اليوم)
  "audit": [ {t,m} ]                 // الاسم بيتكتب من الجلسة، مش من المتصفح
}
```
الرد: `{ok:true, rev, prev}`. لو `prev == since` يبقى محدش كتب في النص.

### القواعد اللي السيرفر بيطبّقها (`app/src/Sync/Rules.php`)
- **صلاحية لكل نوع عملية** (`SCN`←`scan`، `RCV`←`receive`، `SHP`←`ship`...). الرصيد الافتتاحي `OPN` للمدير بس.
- **الأيام المقفولة:** أي حركة أو مستند مؤكّد بتاريخ ≤ `lock` ← 409 `day_locked`. (القفل التلقائي لأيام فاتت مسموح لأي مستخدم.)
- **الحركات إضافة فقط:** نفس الـ id بحركة تانية ← 409. إعادة إرسال نفس الحركة بالظبط آمنة (retry).
- **المستند المؤكّد مجمّد:** مفيش تعديل في البنود أو الهيدر، ما عدا إثبات التسليم/الملفات/السجل. ومبيتأرشفش. ← 409 `immutable`.
- **العدّادات** (`mid`, `did`, `sup_eid`, `seq`) ما ترجعش لورا (منع تكرار الأرقام).
- **المفاتيح المسموحة** في `meta` و`coll` محدودة. أي حاجة تانية ← 422.
- **المستخدمين** مش بيتكتبوا عن طريق الـ sync أبدًا.

### التعارض (concurrency)
لو أي صف الـ push بيكتبه اتغيّر على السيرفر بعد `since` (حد تاني عدّله) ← **409 `stale` ومفيش ولا تغيير بيتطبّق**، والرد فيه `conflicts`. المتصفح بيعمل reload ويعرض اللي على السيرفر.
