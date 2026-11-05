// Import test: a backup made by the standalone app (with 28 days of demo operations) is loaded into MySQL by
// tools/import_backup.php and then opened in the PHP edition.
//   NODE_PATH=$(npm root -g) node php-app/tests/import_test.js
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = 8900 + Math.floor(Math.random() * 50);
const BASE = `http://127.0.0.1:${port}`;
let pass = 0, fail = 0;
const ok = (l, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + l + (c ? '' : '  -> ' + String(x).slice(0, 400))); c ? pass++ : fail++; };

(async () => {
  const b = await chromium.launch();
  // ---- 1. a backup file exactly like Settings → Data → download
  const sp = await b.newPage();
  await sp.goto('file://' + path.resolve(root, '../apps/edition-3-brand-v2/index.html'));
  await sp.waitForSelector('.shell');
  await sp.evaluate(() => __F.ACT.demoload());
  await sp.waitForTimeout(800);
  const backup = await sp.evaluate(() => JSON.stringify({ app: 'femini-stock', v: 3, at: Date.now(), state: __F.S(), photos: {} }));
  const want = JSON.parse(backup).state;
  const file = path.join(__dirname, '.tmp', 'backup.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, backup);
  await sp.close();

  // ---- 2. empty database + admin, then the import tool
  execFileSync('php', [path.join(__dirname, 'prepare_e2e.php')], { cwd: root, stdio: 'ignore' });
  const env = { ...process.env, FEMINI_CONFIG: path.join(__dirname, '.tmp/config.php') };
  const out = execFileSync('php', [path.join(root, 'tools/import_backup.php'), file, 'admin'], { cwd: root, env }).toString();
  console.log(out.trim().split('\n').map(l => '  | ' + l).join('\n'));
  ok('the import tool reports the numbers it loaded', new RegExp(`${want.moves.length} moves, ${want.docs.length} docs, ${want.orders.length} orders`).test(out), out);
  let second = '';
  try { execFileSync('php', [path.join(root, 'tools/import_backup.php'), file, 'admin'], { cwd: root, env, stdio: 'pipe' }); } catch (e) { second = e.stderr.toString(); }
  ok('a second import into a non-empty database is refused', /already has data/.test(second), second);

  // ---- 3. open it in the PHP edition
  const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', path.join(root, 'public'), path.join(__dirname, 'router.php')], { cwd: root, env, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch (e) { /* wait */ } await new Promise(r => setTimeout(r, 100)); }
  try {
    const errs = [];
    const p = await b.newPage({ viewport: { width: 1360, height: 900 } });
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/');
    await p.fill('#u', 'admin'); await p.fill('#p', 'Qx7-Lunar-Tide-91'); await p.click('#b');
    await p.waitForSelector('.shell', { timeout: 20000 });
    const got = await p.evaluate(() => { const S = __F.S(); return { moves: S.moves.length, docs: S.docs.length, orders: S.orders.length, pickups: S.pickups.length, supLog: S.sup.log.length, items: S.sup.items.length, mid: S.mid, did: S.did, shops: S.shops.length, emps: S.emps.length, costs: Object.keys(S.costs).length }; });
    const w = { moves: want.moves.length, docs: want.docs.length, orders: want.orders.length, pickups: want.pickups.length, supLog: want.sup.log.length, items: want.sup.items.length, mid: want.mid, did: want.did, shops: (want.shops || []).length, emps: (want.emps || []).length, costs: Object.keys(want.costs).length };
    ok('every collection arrives complete (' + w.moves + ' moves, ' + w.orders + ' orders, ' + w.docs + ' docs)', JSON.stringify(got) === JSON.stringify(w), JSON.stringify({ got, w }));

    // the ledger balance computed in the browser is identical to the one in the original app
    const balance = await p.evaluate(() => { const o = {}; __F.S().moves.forEach(m => { const k = m.sku; (o[k] || (o[k] = {}))[m.from] = (o[k][m.from] || 0) - m.q; o[k][m.to] = (o[k][m.to] || 0) + m.q; }); return JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]])); });
    const wantBal = (() => { const o = {}; want.moves.forEach(m => { const k = m.sku; (o[k] || (o[k] = {}))[m.from] = (o[k][m.from] || 0) - m.q; o[k][m.to] = (o[k][m.to] || 0) + m.q; }); return JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]])); })();
    ok('the stock balance of every SKU is identical to the original', balance === wantBal);

    // (the app's automatic midnight close of past days runs on load, so lock/closes are not compared)
    // documents and orders are byte-for-byte what the original app had (empty {} stayed {})
    const same = await p.evaluate(w => JSON.stringify(__F.S().docs) === JSON.stringify(w.docs) && JSON.stringify(__F.S().orders) === JSON.stringify(w.orders), { docs: want.docs, orders: want.orders });
    ok('documents and orders round-trip through MySQL unchanged', same);

    // every screen renders with the imported data
    for (const tab of ['today', 'stock', 'orders', 'ops', 'ledger', 'insights', 'supplies', 'files', 'config']) {
      await p.evaluate(t => __F.go(t), tab);
      await p.waitForTimeout(150);
    }
    ok('every screen renders with the imported data and no errors', errs.length === 0, errs.join(' | '));

    // new work on top of imported data is accepted
    const before = await p.evaluate(() => __F.S().docs.length);
    await p.evaluate(() => {
      const F = __F, S = F.S(), C = F.ctx();
      const refs = S.orders.filter(o => o.st === 'open' && !(o.bad && o.bad.length) && !C.blocked[o.ref]).slice(0, 2).map(o => o.ref);
      const d = F.newDoc('SCN'); d.hdr = { emp: 'x', src: 'after-import', refs, times: {} };
      return F.confirmDoc(d);
    });
    let n = 0;
    for (; n < 50; n++) {
      const st = await p.evaluate(async () => (await (await fetch('/api/sync/pull?since=0')).json()).coll.docs.length);
      if (st === before + 1) break;
      await new Promise(r => setTimeout(r, 200));
    }
    ok('a new scan after the import is saved normally', n < 50, n);
    ok('no page errors after the new operation', errs.length === 0, errs.join(' | '));
  } finally {
    server.kill();
    await b.close();
  }
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
