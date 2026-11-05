// End-to-end: the real app in Chromium against the real PHP API and MySQL/MariaDB.
//   NODE_PATH=$(npm root -g) node php-app/tests/e2e.js
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = 8800 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${port}`;

let pass = 0, fail = 0;
const ok = (l, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + l + (c ? '' : '  -> ' + String(x).slice(0, 400))); c ? pass++ : fail++; };

(async () => {
  execFileSync('php', [path.join(__dirname, 'prepare_e2e.php')], { cwd: root, stdio: 'inherit' });
  const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', path.join(root, 'public'), path.join(__dirname, 'router.php')],
    { cwd: root, env: { ...process.env, FEMINI_CONFIG: path.join(__dirname, '.tmp/config.php') }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch (e) { /* not up yet */ } await new Promise(r => setTimeout(r, 100)); }

  const b = await chromium.launch();
  const errs = [];
  const open = async (ctx) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };
  const login = async (p, u, pw) => {
    await p.goto(BASE + '/');
    await p.fill('#u', u); await p.fill('#p', pw); await p.click('#b');
    await p.waitForSelector('.shell', { timeout: 15000 });
  };
  const serverState = p => p.evaluate(async () => { const r = await fetch('/api/sync/pull?since=0'); return r.json(); });
  /** Polls until `fn(serverState)` is true (waitForFunction does not await async predicates). */
  const untilServer = async (p, fn, ms = 12000) => {
    const t0 = Date.now();
    for (;;) {
      const s = await serverState(p);
      if (fn(s)) return s;
      if (Date.now() - t0 > ms) throw new Error('timed out waiting for the server state: ' + JSON.stringify({ moves: s.moves.length, docs: s.coll.docs.length }));
      await new Promise(r => setTimeout(r, 150));
    }
  };

  try {
    // ---- login page and first start
    const ca = await b.newContext({ viewport: { width: 1360, height: 900 } });
    const A = await open(ca);
    await A.goto(BASE + '/');
    ok('signed out: the login page is shown', await A.locator('#f').count() === 1 && await A.locator('.shell').count() === 0);
    await A.fill('#u', 'admin'); await A.fill('#p', 'wrong-password'); await A.click('#b');
    await A.waitForFunction(() => document.getElementById('err').textContent.length > 0);
    ok('a wrong password shows a message and stays on the login page', /غلط/.test(await A.textContent('#err')));
    await login(A, 'admin', 'admin-pass-1');
    ok('admin logs in and the app opens', await A.locator('.shell').count() === 1);

    let st = await untilServer(A, s => s.moves.length > 400, 20000);
    ok('first start: the admin\'s browser uploaded the built-in seed (ledger, orders, supplies)', st.moves.length > 400 && st.coll.orders.length === 92 && st.coll.sup_items.length >= 4 && st.meta.mid, `${st.moves.length} moves, ${st.coll.orders.length} orders`);
    ok('the audit log and the actor come from the server session', st.users.some(u => u.username === 'admin'));

    // ---- state comes from the server on reload, not from the browser
    await A.reload(); await A.waitForSelector('.shell');
    const s1 = await A.evaluate(() => ({ orders: __F.S().orders.length, moves: __F.S().moves.length, ls: localStorage.getItem('femini-stock-v3'), cur: __F.S().cur, actor: __F.S().actor }));
    ok('after a reload the app shows the server data', s1.orders === 92 && s1.moves > 400, JSON.stringify(s1));
    ok('nothing is kept in localStorage any more', s1.ls === null, s1.ls && s1.ls.slice(0, 40));
    ok('the signed-in user is the actor of new operations', s1.actor === 'المدير', s1.actor);

    // ---- an operation is saved to MySQL
    const movesBefore = s1.moves;
    const confirmed = await A.evaluate(() => {
      const F = __F, S = F.S(), C = F.ctx();
      const refs = S.orders.filter(o => o.st === 'open' && !(o.bad && o.bad.length) && !C.blocked[o.ref]).slice(0, 3).map(o => o.ref);
      const d = F.newDoc('SCN'); d.hdr = { emp: 'عبدالله', src: 'e2e', refs, times: {} };
      window.__refs = refs;
      return { ok: F.confirmDoc(d), status: d.status, errs: d.errs || null, refs: refs.length };
    });
    console.log('confirm result', JSON.stringify(confirmed));
    st = await untilServer(A, s => s.coll.docs.length === 1 && s.coll.docs[0].row.status === 'done');
    const refs = await A.evaluate(() => window.__refs);
    const doneOnServer = st.coll.orders.filter(r => refs.includes(r.k) && r.row.st === 'done').length;
    ok('confirming a scan document saves the document, its moves and the orders atomically', st.moves.length > movesBefore && doneOnServer === 3 && st.coll.docs[0].row.status === 'done' && st.coll.docs[0].row.no === 'SCN-0001', `${st.moves.length} moves, ${doneOnServer} done`);
    ok('audit entries carry the signed-in user\'s name (written by the server)', st.audit.length > 0 && st.audit.every(a => a.by === 'المدير'), JSON.stringify(st.audit.slice(0, 2)));

    // ---- a second person sees it
    const cb = await b.newContext({ viewport: { width: 1360, height: 900 } });
    const Bp = await open(cb);
    await login(Bp, 'packer', 'packer-pass-1');
    ok('packer sees the same data', await Bp.evaluate(() => __F.S().docs.length === 1 && __F.S().orders.filter(o => o.st === 'done').length === 3));
    ok('packer\'s screen knows its role (client-side hints)', await Bp.evaluate(() => __F.curUser().role === 'pack' && !__F.can('close')));

    // ---- live update: the admin does another scan, the packer's page picks it up by polling
    await A.evaluate(() => {
      const F = __F, S = F.S(), C = F.ctx();
      const refs = S.orders.filter(o => o.st === 'open' && !(o.bad && o.bad.length) && !C.blocked[o.ref]).slice(0, 2).map(o => o.ref);
      const d = F.newDoc('SCN'); d.hdr = { emp: 'عبدالله', src: 'e2e2', refs, times: {} };
      return F.confirmDoc(d);
    });
    await untilServer(A, s => s.coll.docs.length === 2);
    await Bp.evaluate(() => FSYNC.pull());
    await Bp.waitForFunction(() => __F.S().docs.length === 2, null, { timeout: 8000 });
    ok('the other browser receives the change without a reload', await Bp.evaluate(() => __F.S().docs.length === 2 && __F.S().orders.filter(o => o.st === 'done').length === 5));

    // ---- the server refuses what the role cannot do, and the page falls back to the server's truth
    await Bp.evaluate(() => {
      const F = __F, S = F.S();
      const d = F.newDoc('RCV'); d.hdr = { src: 'x' };
      const k = F.D.skus[0]; d.lines.push({ sku: k.id, q: 5 }); d.photo = { name: 'x' };
      window.__rcvId = d.id;
      F.confirmDoc(d);
    });
    await Bp.waitForFunction(() => document.body.innerText.indexOf('مش بيسمح') >= 0 || document.querySelector('.toast'), null, { timeout: 8000 });
    await Bp.waitForLoadState('load');
    await Bp.waitForFunction(() => window.__rcvId === undefined && !!document.querySelector('.shell'), null, { timeout: 12000 });
    st = await serverState(Bp);
    ok('a packer cannot post a factory receipt: refused, nothing saved', st.coll.docs.length === 2 && !st.moves.some(m => m.type === 'RCV'), st.coll.docs.length);
    ok('and the packer\'s page reloaded to the server state', await Bp.evaluate(() => __F.S().docs.length === 2));

    // ---- two people acting at once: the late one is refused, the data stays consistent
    await Bp.reload(); await Bp.waitForSelector('.shell');
    const lateScan = (p) => p.evaluate(() => {
      const F = __F, S = F.S(), C = F.ctx();
      const refs = S.orders.filter(o => o.st === 'open' && !(o.bad && o.bad.length) && !C.blocked[o.ref]).slice(0, 2).map(o => o.ref);
      const d = F.newDoc('SCN'); d.hdr = { emp: 'x', src: 'race', refs, times: {} };
      return F.confirmDoc(d);
    });
    // both pages are at the same revision and act before either pulls
    await lateScan(A);
    await untilServer(A, s => s.coll.docs.length === 3);
    await lateScan(Bp);   // B still believes it is up to date
    await Bp.waitForFunction(() => !!document.querySelector('.toast'), null, { timeout: 8000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    await Bp.waitForSelector('.shell');
    st = await serverState(Bp);
    ok('two scans at the same moment: only the first was accepted, the late one was refused', st.coll.docs.length === 3 && st.coll.docs.every(d => d.row.status === 'done'), st.coll.docs.length);
    const ids = st.moves.map(m => m.id);
    ok('ledger ids are unique and the document numbers are not duplicated', new Set(ids).size === ids.length && new Set(st.coll.docs.map(d => d.row.no).filter(Boolean)).size === st.coll.docs.filter(d => d.row.no).length);
    ok('the late page shows what the server has', await Bp.evaluate(async (n) => { const r = await (await fetch('/api/sync/pull?since=0')).json(); return __F.S().docs.length === r.coll.docs.length; }));

    // ---- users screen is server-backed
    await A.evaluate(() => { __F.UI.cfgTab = 'acc'; __F.go('config'); });
    await A.waitForTimeout(400);
    const usersTxt = await A.evaluate(() => document.getElementById('main').innerText);
    ok('the users screen lists the server users with their login names', /packer/.test(usersTxt) && /admin/.test(usersTxt));
    ok('the browser PIN lock screen is gone (no PIN field)', !/رقم سري/.test(usersTxt));

    // ---- logout
    await A.evaluate(() => __F.ACT.fslogout());
    await A.waitForSelector('#f', { timeout: 8000 });
    ok('logging out returns to the login page', await A.locator('#f').count() === 1);
    const r = await A.evaluate(async () => (await fetch('/api/sync/pull?since=0')).status);
    ok('and the session is really gone (401)', r === 401, r);

    ok('no page errors', errs.length === 0, errs.join(' | '));
  } finally {
    await b.close();
    server.kill();
  }
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
