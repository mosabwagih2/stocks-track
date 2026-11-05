# نشر Fémini Stock على cPanel (PHP + MySQL)

الدليل ده بيمشّي التطبيق على استضافة cPanel عادية. وقت التنفيذ حوالي 20 إلى 30 دقيقة.

## المتطلبات
- PHP **8.1 أو أحدث** (الكود مكتوب وملجرَّب على 8.3) مع الإضافات: `pdo_mysql`, `mbstring`, `fileinfo`, `gd` (للصور المصغّرة)، و`json`. كلهم متاحين غالبًا. من cPanel ← **Select PHP Version** ← Extensions.
- MySQL 5.7+ أو MariaDB 10.3+ (الاتنين شغّالين، اتجرّب على MariaDB 10.11).
- شهادة SSL (AutoSSL مجانية في cPanel). الـ `.htaccess` بيحوّل أي طلب HTTP لـ HTTPS (ما عدا `localhost`)، وكوكي الجلسة بيبقى `Secure` على HTTPS.

## 1) قاعدة البيانات
1. cPanel ← **MySQL® Databases**: اعمل قاعدة (مثلًا `femini`)، واعمل مستخدم بباسورد قوي، وضيفه للقاعدة بـ **ALL PRIVILEGES**.
2. اكتب اسم القاعدة واسم المستخدم (cPanel بيضيف بادئة زي `user_`).

## 2) الملفات
ارفع محتويات فولدر `php-app/` (من File Manager أو Git أو FTP) لمجلد **برّه** `public_html`، مثلًا:

```
/home/USER/femini/
  app/  config/  sql/  storage/  tools/  public/
```

بعدين خلّي الدومين (أو الدومين الفرعي مثلًا `stock.yourdomain.com`) يشاور على فولدر **`/home/USER/femini/public`**:
cPanel ← **Domains** (أو Subdomains) ← Document Root = `femini/public`.

> لو مش قادر تغيّر الـ Document Root وهتحط كل حاجة جوه `public_html/stock/`: ينفع، لأن كل فولدر حساس (`app`, `config`, `sql`, `storage`, `tools`) فيه `.htaccess` بيمنع الوصول. بس الأفضل والأأمن إنهم يكونوا برّه.

## 3) الإعدادات
1. انسخ `config/config.example.php` إلى `config/config.php` (من File Manager: Copy ثم Rename).
2. عدّل فيه:
   - `db`: المضيف (`localhost`)، الاسم، المستخدم، الباسورد.
   - `app.install_key`: نص عشوائي **طويل** (16 حرف أو أكتر).
   - `app.storage_path`: خلّيه جوه `femini/storage` (الافتراضي كويس).
3. اتأكد إن فولدر `storage` قابل للكتابة (permissions 755 أو 775).

## 4) التثبيت
**من غير SSH (الأسهل):**
1. افتح `https://stock.yourdomain.com/install.php`.
2. اكتب `install_key` واسم المدير واسم الدخول وكلمة السر (8 حروف+).
3. اضغط تثبيت. بيعمل الجداول والمدير.
4. **امسح الملف `public/install.php` من السيرفر فورًا.** (المثبّت بيقفل نفسه كمان بملف `storage/installed.lock`.)

**أو من Terminal في cPanel:**
```bash
cd ~/femini
php tools/migrate.php
php tools/create_admin.php admin "اسمك"
```

**فحص جاهزية (قبل ما تفتح للموظفين):**
```bash
cd ~/femini && php tools/check.php
```
بيطبع قايمة `OK / WARN / FAIL` (إصدار PHP، الإضافات، القاعدة، فولدر الملفات، حدود الرفع، debug، مفتاح التثبيت...). **أي `FAIL` لازم يتصلح.** نفس الفحص بيظهر في صفحة `install.php`. وبعد كده راجع [`SECURITY.md`](SECURITY.md).

## 5) أول تشغيل
1. ادخل على `https://stock.yourdomain.com` بحساب المدير.
2. السيرفر لسه فاضي، فمتصفح المدير بيرفع البيانات الأساسية (الكتالوج والرصيد الافتتاحي) تلقائي مرة واحدة. استنى ثواني.
3. من **الإعدادات ← المستخدمين** ضيف الموظفين بأدوارهم.

**لو عندك بيانات في النسخة القديمة (المتصفح):** نزّل نسخة احتياطية (الإعدادات ← البيانات)، ارفعها للسيرفر، وشغّل قبل أول دخول:
```bash
php tools/import_backup.php /path/to/femini-backup-2026-11-05.json admin
```
(بيشتغل على قاعدة فاضية بس.)

## 5b) حاجات بتتظبط من التطبيق
- **كلمات السر:** 8 حروف على الأقل (الأفضل جملة طويلة)، مش شائعة، ومش فيها اسم المستخدم. كل مستخدم يغيّر كلمة سره من شاشة المستخدمين (محتاج الحالية). المدير بيعيّن كلمة جديدة لأي موظف، وده بيخرّجه من كل أجهزته.
- **الصلاحيات:** من نفس الشاشة، مصفوفة الأدوار قابلة للتعديل (ما عدا المدير)، وبتسري فورًا.
- **الجلسات:** بتنتهي بعد 12 ساعة من غير نشاط.
- **لو الموقع وراء Cloudflare أو proxy:** حط `app.proxy_header` في config (مثلًا `HTTP_CF_CONNECTING_IP`)، وإلا كل الزوار هيبانوا بنفس الـ IP وحماية التخمين هتقفل على الكل.

## 6) النسخ الاحتياطي (مهم)
- **القاعدة + فولدر `storage` مع بعض.** لو واحد بس اتاخد الصف هيشاور على ملف مش موجود.
- cPanel ← **Cron Jobs** (يوميًا 3 الفجر مثلًا):
  ```
  0 3 * * * mysqldump -u DBUSER -p'DBPASS' DBNAME | gzip > $HOME/backups/femini-$(date +\%F).sql.gz && tar czf $HOME/backups/femini-files-$(date +\%F).tgz -C $HOME/femini storage/files
  ```
- نزّل النسخ على جهازك أو مكان تاني بشكل دوري. نسخة على نفس السيرفر مش كفاية.
- (اختياري، تشدّد زيادة) اعمل لمستخدم القاعدة صلاحيات `SELECT, INSERT` فقط على جدول `moves` عشان الدفتر يبقى append-only على مستوى القاعدة. التطبيق مش بيعمل UPDATE ولا DELETE على `moves` أصلًا:
  ```sql
  REVOKE UPDATE, DELETE ON DBNAME.moves FROM 'DBUSER'@'localhost';
  ```
  (لو الصلاحية اتمنحت بـ ALL على القاعدة، اسحبها وامنح الباقي جدولًا جدولًا.)

## 7) التحديث لنسخة جديدة
1. خد نسخة احتياطية.
2. ارفع الكود الجديد فوق القديم (متمسحش `config/config.php` ولا `storage/`).
3. شغّل `php tools/migrate.php` لتطبيق أي تغييرات جديدة في الجداول (بتتطبّق مرة واحدة بس، ومسجّلة في `schema_migrations`).

## استكشاف الأخطاء
| العَرَض | السبب والحل |
|---|---|
| صفحة بيضاء أو 500 | شوف `error_log` في cPanel ← Errors. غالبًا إضافة PHP ناقصة أو بيانات `config.php` غلط. للتجربة بس: `debug => true`. |
| "config.php missing" | انسخ `config.example.php` لـ `config.php`. |
| `/api/...` بترجّع 404 | الـ `.htaccess` مش شغّال: اتأكد إن `mod_rewrite` متاح وإن Document Root هو فولدر `public`. |
| الرفع بيفشل لملفات كبيرة | زوّد `upload_max_filesize` و`post_max_size` من Select PHP Version ← Options، و`app.max_upload` في config. |
| الصور المصغّرة مش بتظهر | فعّل إضافة `gd`. |
| الساعة غلط | `app.timezone` في config (الافتراضي `Africa/Cairo`). |
