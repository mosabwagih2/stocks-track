// Browser test for the restored features: product photos, catalog edit, supplies admin, Files page, analytics tabs.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const CSV = resolve(here, '../../data/QRbot_202611021914566_scanned_orders.csv');
const BASE = process.env.BASE ?? 'http://127.0.0.1:4173/';
const PNG = { name: 'p.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAADwAAAAoCAIAAAAt2Q6oAAAAZklEQVR4nO3YQQ3AIBAFUZZUDBIqonIRUQnIWAm1UJp0CMm88z9M9riRmWU3dXXAF0ZTjKYYTTGackytx3n91NHu/n685aWNphhNMZpiNMVoitEUoylGU4ymhF9TiNEUoylGU4ymPJfUCPHDu5WIAAAAAElFTkSuQmCC', 'base64') };
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
await p.addInitScript(() => { const RD = Date; window.__fixed = new RD('2026-11-02T10:00:00+02:00').getTime(); class FD extends RD { constructor(...a) { a.length ? super(...a) : super(window.__fixed); } static now() { return window.__fixed; } } window.Date = FD; });
const errs = []; p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/net::|Failed to load|fonts\./.test(m.text())) errs.push('CONSOLE ' + m.text()); });
let pass = 0, fail = 0; const ok = (l, c) => { console.log((c ? 'PASS ' : 'FAIL ') + l); c ? pass++ : fail++; };
const txt = async (s = 'body') => ((await p.textContent(s)) ?? '').replace(/\s+/g, ' ');
const sheet = '[role=dialog]';
await p.goto(BASE + '#/stock'); await p.waitForSelector('h1');
// ---- product photos
ok('PAN3 photo is shown (seeded), others show a code tile', (await p.locator('img[alt=PAN3]').count()) > 0);
await p.click('button[aria-label="صورة BR2"]'); await p.waitForSelector(sheet);
ok('no photo for BR2 yet', /لا توجد صورة/.test(await txt(sheet)));
await p.setInputFiles(sheet + ' input[type=file]', PNG); await p.waitForSelector(sheet, { state: 'detached' }); await p.waitForTimeout(300);
ok('BR2 photo saved and shown', (await p.locator('img[alt=BR2]').count()) > 0);
await p.click('button[aria-label="صورة BR2"]'); await p.waitForSelector(sheet);
const nat = await p.$eval(sheet + ' img', (i) => [i.naturalWidth, i.naturalHeight]); ok('stored photo is square 600x600', nat[0] === 600 && nat[1] === 600);
await p.keyboard.press('Escape');
// ---- catalog: new model
await p.click('button:has-text("+ موديل جديد")'); await p.waitForSelector(sheet);
const save = p.locator(sheet + ' button:has-text("إضافة")').last(); ok('new model save disabled at start', await save.isDisabled());
await p.fill(sheet + ' input[placeholder=PAN6]', 'tst1'); await p.fill(sheet + ' input[list=mnames]', 'اختبار');
await p.click(sheet + ' button:has-text("احمر")'); await p.click(sheet + ' button:text-is("M")'); await p.click(sheet + ' button:text-is("L")');
ok('preview says 2 new variants', /سيتم إضافة\s*2/.test(await txt(sheet)));
await p.click(sheet + ' button:has-text("إضافة 2 صنف")'); await p.waitForSelector(sheet, { state: 'detached' });
ok('TST1 listed in one-model nav', (await p.locator('nav[aria-label="الموديلات"] >> text=TST1').count()) > 0);
// ---- catalog: edit (add a color to BR2, locked cells for stocked variants)
await p.click('button:text-is("تعديل")'); await p.waitForSelector(sheet);
await p.selectOption(sheet + ' select >> nth=0', 'BR2');
ok('stocked variants are locked ("محجوز")', (await p.locator(sheet + ' span:has-text("محجوز")').count()) > 10);
ok('save disabled without changes', await p.locator(sheet + ' button:has-text("حفظ التعديلات")').isDisabled());
await p.fill(sheet + ' input[placeholder="لون جديد"]', 'موف'); await p.click(sheet + ' button:has-text("+ لون")');
ok('new color adds a cell per size', /\+7 صنف جديد/.test(await txt(sheet)));
await p.click(sheet + ' button:has-text("حفظ التعديلات")'); await p.waitForSelector(sheet, { state: 'detached' });
await p.click('button:text-is("تعديل")'); await p.waitForSelector(sheet); await p.selectOption(sheet + ' select >> nth=0', 'BR2'); await p.click(sheet + ' button:has-text("إزالة الموديل بالكامل")');
ok('BR2 cannot be removed while it has stock', /لا يمكن إزالة الموديل/.test(await txt(sheet))); await p.keyboard.press('Escape');
// remove TST1 then restore from archived
await p.click('button:text-is("تعديل")'); await p.waitForSelector(sheet); await p.selectOption(sheet + ' select >> nth=0', 'TST1'); await p.click(sheet + ' button:has-text("إزالة الموديل بالكامل")');
await p.click(sheet + ' button:has-text("نعم، أزل الموديل")'); await p.waitForSelector(sheet, { state: 'detached' }); await p.waitForTimeout(300);
ok('TST1 removed', (await p.locator('nav[aria-label="الموديلات"] >> text=TST1').count()) === 0);
await p.click('[aria-pressed]:has-text("كل الأصناف")'); await p.click('button:has-text("مؤرشف")'); ok('archived list offers restore for TST1', (await p.locator('button:has-text("استعادة الموديل كله")').count()) === 1);
await p.click('button:has-text("استعادة الموديل كله")'); await p.waitForTimeout(300);
// ---- supplies admin
await p.goto(BASE + '#/supplies'); await p.waitForSelector('h1');
await p.click('button:has-text("إضافة مستلزم")'); await p.waitForSelector(sheet);
await p.fill(sheet + ' input[placeholder*="فلاير"]', 'شريط لاصق'); await p.selectOption(sheet + ' select >> nth=0', 'order'); await p.fill(sheet + ' input[type=number] >> nth=0', '20');
await p.fill(sheet + ' label:has-text("الرصيد الحالي") input', '50'); await p.click(sheet + ' button:has-text("إضافة المستلزم")'); await p.waitForSelector(sheet, { state: 'detached' }); await p.waitForTimeout(300);
ok('new supply card with its balance', /شريط لاصق/.test(await txt('main')) && /50/.test(await txt('main')));
// shipping consumes the new supply per order
await p.goto(BASE + '#/orders'); await p.click('button:has-text("رفع ملف السكان")'); await p.setInputFiles('input[type=file][hidden]', CSV); await p.waitForSelector('text=سكان في الملف');
await p.fill(sheet + ' input[list=emps]', 'عبدالله'); await p.click(sheet + ' button:has-text("تأكيد وخصم")'); await p.waitForSelector(sheet, { state: 'detached' });
await p.goto(BASE + '#/supplies'); await p.waitForSelector('h1'); await p.waitForTimeout(300);
ok('tape consumed 28 (50 - 28 = 22)', /22/.test(await txt('main section:has-text("شريط لاصق")')));
// edit + archive
await p.click('section:has-text("شريط لاصق") button[aria-label="إعدادات المستلزم"]'); await p.waitForSelector(sheet);
await p.click(sheet + ' button:has-text("أرشفة المستلزم")'); ok('archive asks confirmation', (await p.locator(sheet + ' button:has-text("نعم، أرشف")').count()) === 1);
await p.click(sheet + ' button:has-text("نعم، أرشف")'); await p.waitForSelector(sheet, { state: 'detached' }); await p.waitForTimeout(300);
ok('archived supply left the list', !/شريط لاصق/.test(await txt('main .grid')));
// ---- Files page
await p.goto(BASE + '#/files'); await p.waitForSelector('h1');
ok('Files page: where files are saved note', /أين تُحفظ ملفاتي/.test(await txt('main')));
await p.click('button[role=tab]:has-text("ملفات الشحن")'); ok('shipment file listed with employee and source', /عبدالله/.test(await txt('main')) && /QRbot/.test(await txt('main')));
await p.click('button:has-text("تعديل")'); await p.waitForSelector(sheet); await p.fill(sheet + ' input', 'حسام'); await p.click(sheet + ' button:has-text("حفظ اسم الموظف")'); await p.waitForSelector(sheet, { state: 'detached' }); await p.waitForTimeout(300);
ok('employee renamed', /حسام/.test(await txt('main')));
await p.click('button[role=tab]:has-text("ملفات البيك أب")'); await p.click('button:has-text("تعديل") >> nth=0'); await p.waitForSelector(sheet);
ok('pickup with shipped orders cannot be deleted', /لا يمكن الحذف/.test(await txt(sheet))); await p.keyboard.press('Escape');
await p.click('button[role=tab]:has-text("ملفات الشحن")'); await p.click('button:has-text("تعديل")'); await p.click(sheet + ' button:has-text("عكس الملف")'); await p.click(sheet + ' button:has-text("نعم، اعكس")'); await p.waitForSelector(sheet, { state: 'detached' }); await p.waitForTimeout(300);
ok('shipment reversed', /معكوس/.test(await txt('main')));
await p.click('button[role=tab]:has-text("ملفات البيك أب")'); await p.click('button:has-text("تعديل") >> nth=0'); await p.click(sheet + ' button:has-text("حذف البيك أب")'); await p.click(sheet + ' button:has-text("نعم، احذف")'); await p.waitForSelector(sheet, { state: 'detached' }); await p.waitForTimeout(300);
ok('pickup deleted after the reverse', (await p.locator('tbody tr').count()) === 1);
// ---- analytics tabs
await p.goto(BASE + '#/insights'); await p.waitForSelector('h1');
for (const [tab, re] of [['الطلب', /خريطة الطلب/], ['المتوقف', /متوقف|لا توجد أوردرات/], ['الفريق', /موظف|لا توجد أوردرات مشحونة/], ['صحة المخزون', /اتزان الحركات/]]) { await p.click(`button[role=tab]:text-is("${tab}")`); await p.waitForTimeout(150); ok('insights tab ' + tab, re.test(await txt('main'))); }
// ---- mobile
await p.setViewportSize({ width: 400, height: 800 });
for (const path of ['/stock', '/supplies', '/files', '/insights']) { await p.goto(BASE + '#' + path); await p.waitForSelector('h1'); const ow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (ow > 0) ok('mobile overflow ' + path + ' ' + ow, false); }
ok('mobile: no horizontal overflow', true);
console.log(`${pass} passed, ${fail} failed`); console.log(errs.length ? errs.join('\n') : 'ERRORS: none'); await b.close(); process.exit(fail || errs.length ? 1 : 0);
