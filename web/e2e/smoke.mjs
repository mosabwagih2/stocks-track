// Browser smoke test against `vite preview` (memory/demo mode). Needs playwright (global or devDependency).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // resolves a global or local Playwright
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import os from 'node:os';
const here = dirname(fileURLToPath(import.meta.url));
const CSV = resolve(here, '../../data/QRbot_202611021914566_scanned_orders.csv');
const BASE = process.env.BASE ?? 'http://127.0.0.1:4173/';
const PNG = { name: 'w.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAADwAAAAoCAIAAAAt2Q6oAAAAZklEQVR4nO3YQQ3AIBAFUZZUDBIqonIRUQnIWAm1UJp0CMm88z9M9riRmWU3dXXAF0ZTjKYYTTGackytx3n91NHu/n685aWNphhNMZpiNMVoitEUoylGU4ymhF9TiNEUoylGU4ymPJfUCPHDu5WIAAAAAElFTkSuQmCC', 'base64') };
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } }); const p = await ctx.newPage();
// the demo data is dated 2026-11-02: fake the clock so "today" has a pickup, like the original day
await p.addInitScript(() => { const RD = Date; window.__fixed = new RD('2026-11-02T10:00:00+02:00').getTime(); class FD extends RD { constructor(...a) { a.length ? super(...a) : super(window.__fixed); } static now() { return window.__fixed; } } window.Date = FD; });
const errs = []; p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/net::|Failed to load/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
let pass = 0, fail = 0; const ok = (l, c) => { console.log((c ? 'PASS ' : 'FAIL ') + l); c ? pass++ : fail++; };
const txt = async (s = 'body') => ((await p.textContent(s)) ?? '').replace(/\s+/g, ' ');
const shot = (n) => p.screenshot({ path: `${os.tmpdir()}/web_${n}.png`, fullPage: true });
await p.goto(BASE); await p.waitForSelector('h1');
ok('Today renders with 92 requested', /اليوم/.test(await txt('h1')) && /92/.test(await txt('main')));
for (const [path, h] of [['/stock', 'المخزون'], ['/supplies', 'المستلزمات'], ['/operations', 'العمليات'], ['/insights', 'التحليلات'], ['/orders', 'الأوردرات'], ['/ledger', 'سجل الحركات'], ['/settings', 'الإعدادات']]) {
  await p.goto(BASE + '#' + path); await p.waitForSelector('h1'); ok('page ' + path, (await txt('h1')).includes(h));
}
// ---- ship the real scan file
await p.goto(BASE + '#/orders'); await p.waitForSelector('h1');
await p.click('button:has-text("رفع ملف السكان")'); await p.waitForSelector('[role=dialog]');
await p.setInputFiles('input[type=file][hidden]', CSV); await p.waitForSelector('text=سكان في الملف');
ok('scan preview: 28 orders / 456 pieces', /456/.test(await txt('[role=dialog]')) && /28/.test(await txt('[role=dialog]')));
const confirm = p.locator('[role=dialog] button:has-text("تأكيد وخصم")'); ok('confirm disabled without employee', await confirm.isDisabled());
await p.fill('[role=dialog] input[list=emps]', 'عبدالله'); ok('confirm enabled with employee', !(await confirm.isDisabled()));
await confirm.click(); await p.waitForSelector('[role=dialog]', { state: 'detached' });
await p.goto(BASE + '#/'); await p.waitForSelector('h1');
ok('Today: 28 shipped (30%)', /28/.test(await txt('main')) && /30%/.test(await txt('main')));
// ---- stock dropped by 456
await p.goto(BASE + '#/stock'); await p.waitForSelector('h1'); ok('READY total is 43,407', /43,407/.test(await txt('main')));
// ---- already-registered detection on re-upload
await p.goto(BASE + '#/orders'); await p.click('button:has-text("رفع ملف السكان")'); await p.setInputFiles('input[type=file][hidden]', CSV); await p.waitForSelector('text=سكان في الملف');
ok('re-upload: all already registered, save disabled', /سُجّل مسبقًا/.test(await txt('[role=dialog]')) && (await p.locator('[role=dialog] button:has-text("تأكيد وخصم")').isDisabled()));
await p.keyboard.press('Escape');
// ---- cancel an order by waybill with photo
await p.click('button:has-text("إلغاء أوردر")'); await p.waitForSelector('[role=dialog]');
const go = p.locator('[role=dialog] button:has-text("تأكيد إلغاء")'); ok('cancel disabled at start', await go.isDisabled());
await p.fill('[role=dialog] input[placeholder*=mk3450]', '23793621'); ok('matches by waybill', /fd8523/.test(await txt('[role=dialog]')));
await p.setInputFiles('[role=dialog] input[type=file]', PNG); await p.waitForTimeout(150); ok('cancel enabled with photo', !(await go.isDisabled()));
await go.click(); await p.waitForSelector('[role=dialog]', { state: 'detached' });
await p.waitForTimeout(300); ok('order left the list and a "ملغي" chip shows 1', /ملغي\s*1/.test(await txt('main')));
// ---- receipt with photo + declared total
await p.goto(BASE + '#/operations'); await p.waitForSelector('h1');
const rc = p.locator('button:has-text("تأكيد وتسجيل")'); ok('receipt confirm disabled', await rc.isDisabled());
await p.locator('main select').first().selectOption('PAN1'); await p.fill('input[type=number][min="1"]', '10'); await p.click('button:has-text("إضافة")');
await p.fill('input[type=number][min="0"]', '10'); await p.setInputFiles('input[type=file]', PNG); await p.waitForTimeout(150);
ok('receipt confirm enabled', !(await rc.isDisabled())); await rc.click(); await p.waitForTimeout(300);
await p.click('[role=tab]:has-text("آخر العمليات")'); ok('receipt listed with photo', /RCV-0001/.test(await txt('main')));
// ---- supplies: flyers consumed, receive + undo
await p.goto(BASE + '#/supplies'); await p.waitForSelector('h1'); ok('flyers 2,000 - 28 = 1,972', /1,972/.test(await txt('main')));
await p.locator('button:has-text("استلام")').first().click(); await p.waitForSelector('[role=dialog]');
const sg = p.locator('[role=dialog] button:has-text("تأكيد الاستلام")'); ok('supply confirm disabled until qty', await sg.isDisabled());
await p.fill('[role=dialog] input[type=number]', '100'); ok('preview shows after', /سيصبح/.test(await txt('[role=dialog]'))); await sg.click(); await p.waitForTimeout(300);
ok('flyers now 2,072', /2,072/.test(await txt('main'))); await p.locator('[role=status] button:has-text("تراجع")').last().click(); await p.waitForTimeout(400); ok('undo restores 1,972', /1,972/.test(await txt('main')));
// ---- popup keeps scroll & focus (no remount on state change)
await p.goto(BASE + '#/stock'); await p.waitForSelector('h1'); await p.click('button[aria-label*=" · "] >> nth=0'); await p.waitForSelector('[role=dialog]');
ok('SKU sheet opens', /جاهز للبيع/.test(await txt('[role=dialog]'))); await p.keyboard.press('Escape'); ok('Escape closes', (await p.locator('[role=dialog]').count()) === 0);
// ---- theme + mobile
await p.setViewportSize({ width: 400, height: 800 });
for (const path of ['/', '/stock', '/orders', '/operations', '/supplies', '/insights']) { await p.goto(BASE + '#' + path); await p.waitForSelector('h1'); const ow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (ow > 0) ok('mobile overflow ' + path + ' ' + ow, false); }
ok('mobile layout has no horizontal overflow', true);
await shot('mobile_today');
console.log(`${pass} passed, ${fail} failed`); console.log(errs.length ? errs.join('\n') : 'ERRORS: none'); await b.close(); process.exit(fail || errs.length ? 1 : 0);
