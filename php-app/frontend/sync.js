/**
 * Fémini Stock — server sync adapter (PHP + MySQL edition).
 *
 * The browser app keeps working on one in-memory state object `S`, exactly like the standalone edition.
 * This file replaces "save to localStorage" with "send the changes to the server" and keeps `S` fresh
 * by polling for other people's changes.
 *
 *   boot:   the server embeds the whole state in the page (window.FEM_BOOT), the app starts from it
 *   write:  FSYNC.push()  → diff S against what the server already has → POST /api/sync/push
 *   read:   FSYNC.pull()  → GET /api/sync/pull?since=N every few seconds → merge into S
 *
 * The server decides what is allowed (permissions, closed days, frozen documents); if a push is refused the
 * page reloads from the server so the screen never shows something the database does not have.
 */
(function () {
  'use strict';

  const BOOT = window.FEM_BOOT || {};
  const POLL_MS = 12000;

  /** Parts of S that live in keyed tables: [collection, getter, key of a row]. */
  const COLL = [
    ['docs',      s => s.docs,                r => r.id],
    ['orders',    s => s.orders,              r => r.ref],
    ['pickups',   s => s.pickups,             r => r.id],
    ['sup_items', s => s.sup.items,           r => r.id],
    ['sup_log',   s => s.sup.log,             r => String(r.id)],
    ['closes',    s => s.closes,              r => r.id],
    ['shops',     s => s.shops,               r => r],
    ['emps',      s => s.emps,                r => r],
    ['archPk',    s => s.archPk || [],        r => r.p.id],
    ['archDocs',  s => s.archDocs || [],      r => r.d.id],
  ];
  /** Singleton values: [key, getter, setter]. */
  const META = [
    ['mid',     s => s.mid,     (s, v) => { s.mid = v; }],
    ['did',     s => s.did,     (s, v) => { s.did = v; }],
    ['seq',     s => s.seq,     (s, v) => { s.seq = v; }],
    ['sup_eid', s => s.sup.eid, (s, v) => { s.sup.eid = v; }],
    ['bk',      s => s.bk,      (s, v) => { s.bk = v; }],
    ['st',      s => s.st,      (s, v) => { s.st = v; }],
    ['costs',   s => s.costs,   (s, v) => { s.costs = v; }],
    ['alias',   s => s.alias,   (s, v) => { s.alias = v; }],
    ['img',     s => s.img,     (s, v) => { s.img = v; }],
    ['cat',     s => s.cat,     (s, v) => { s.cat = v; }],
    ['lock',    s => s.lock,    (s, v) => { s.lock = v; }],
  ];

  let getS = null;           // () => the app's current state object
  let H = null;              // helpers handed over by the app (render, toast, ...)
  let since = BOOT.rev || 0; // newest server revision this page has seen
  let busy = false;          // a request is in flight
  let again = false;         // more changes arrived while busy
  let readOnly = false;      // empty server and not an admin: nothing to write yet
  let banner = '';
  let retryTimer = null;     // one pending retry at most while the connection is down

  // ---- files: originals (Excel/CSV/photos) and the display copies of photos live on the server
  const FILES = {};          // browser key ("ph:d12", "pk:P3", "dc:d7", "cx:ed4298") -> newest file {id,name,size,mime,hasThumb}
  let fileSince = 0;         // highest file id this page knows about
  const FILE_KINDS = { ph: ['doc_photo', 'doc'], pk: ['pickup', 'pickup'], dc: ['scan', 'doc'], cx: ['cancel', 'order'] };

  /** The app shows photos from PH[...]: point it at the server's display copy. */
  function registerFile(f) {
    FILES[f.key] = f;
    fileSince = Math.max(fileSince, f.id);
    const prefix = f.key.slice(0, 2), id = f.key.slice(3);
    const phKey = prefix === 'ph' ? id : prefix === 'cx' ? H.cxKey(id) : null;
    if (phKey && f.hasThumb) H.PH[phKey] = '/api/files/' + f.id + '?thumb=1';
    else if (phKey && /^image\//.test(f.mime || '')) H.PH[phKey] = '/api/files/' + f.id;     // no display copy (huge image): show the original
  }

  async function putFile(key, blob) {
    const def = FILE_KINDS[key.slice(0, 2)];
    if (!def || !blob) return;
    const fd = new FormData();
    fd.append('file', blob, blob.name || 'file');
    fd.append('kind', def[0]);
    fd.append('owner_type', def[1]);
    fd.append('owner_id', key.slice(3));
    try {
      const res = await fetch('/api/files', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': BOOT.csrf || '' }, body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) { registerFile(Object.assign({ key }, data.file)); H.render(); }
      else H.toast(data.message || 'مقدرتش أرفع الملف.');
    } catch (e) {
      H.toast('مفيش اتصال بالسيرفر. الملف ما اترفعش.');
    }
  }

  async function downloadFile(key, label) {
    const f = FILES[key];
    if (!f) { H.toast('الملف الأصلي مش محفوظ على السيرفر.'); return; }
    const res = await fetch('/api/files/' + f.id, { credentials: 'same-origin' });
    if (!res.ok) { H.toast('مقدرتش أنزّل الملف.'); return; }
    H.saveFile(f.name || label || 'file', await res.blob(), 'اتنزّل الملف الأصلي');
  }

  /** What the server is known to hold: used to compute diffs without remembering every edit. */
  const base = { moves: new Set(), coll: {}, meta: {}, audit: new Set() };

  const json = v => JSON.stringify(v);
  const sig = a => a.t + '|' + a.m;

  // ------------------------------------------------------------------ http

  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': BOOT.csrf || '' },
      body: body === undefined ? undefined : json(body),
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* not JSON */ }
    return { status: res.status, data: data || {} };
  }

  // ------------------------------------------------------------------ base snapshot

  function indexBase(s) {
    base.moves = new Set(s.moves.map(m => m.id));
    COLL.forEach(([name, get, key]) => {
      const map = new Map();
      (get(s) || []).forEach(r => map.set(key(r), json(r)));
      base.coll[name] = map;
    });
    META.forEach(([k, get]) => { const v = get(s); base.meta[k] = v === undefined ? undefined : json(v); });
    base.audit = new Set((s.audit || []).map(sig));
  }

  // ------------------------------------------------------------------ push

  /** The change set between S and what the server holds, or null when there is nothing to send. */
  function diff(s) {
    const req = { since, moves: [], coll: {}, meta: {}, audit: [] };
    let n = 0;

    s.moves.forEach(m => { if (!base.moves.has(m.id)) { req.moves.push(m); n++; } });

    COLL.forEach(([name, get, key]) => {
      const known = base.coll[name] || new Map();
      const seen = new Set();
      const up = [];
      (get(s) || []).forEach(r => {
        const k = key(r);
        seen.add(k);
        if (known.get(k) !== json(r)) up.push(r);
      });
      const gone = [...known.keys()].filter(k => !seen.has(k));
      if (up.length || gone.length) { req.coll[name] = { up, gone }; n += up.length + gone.length; }
    });

    META.forEach(([k, get]) => {
      const v = get(s);
      if (v !== undefined && base.meta[k] !== json(v)) { req.meta[k] = v; n++; }
    });

    (s.audit || []).forEach(a => { if (!base.audit.has(sig(a))) { req.audit.push(a); n++; } });
    return n ? req : null;
  }

  function commit(req) {
    req.moves.forEach(m => base.moves.add(m.id));
    COLL.forEach(([name, , key]) => {
      const ch = req.coll[name];
      if (!ch) return;
      const map = base.coll[name] || (base.coll[name] = new Map());
      ch.up.forEach(r => map.set(key(r), json(r)));
      ch.gone.forEach(k => map.delete(k));
    });
    Object.keys(req.meta).forEach(k => { base.meta[k] = json(req.meta[k]); });
    req.audit.forEach(a => base.audit.add(sig(a)));
  }

  async function push() {
    if (!getS || readOnly) return;
    if (busy) { again = true; return; }
    const req = diff(getS());
    if (!req) return;
    busy = true;
    const bannerBefore = banner;
    try {
      const { status, data } = await api('POST', '/api/sync/push', req);
      if (status === 200) {
        commit(req);
        banner = '';
        if (data.prev === since) since = data.rev;      // nobody else wrote in between
        else await pullNow();                            // somebody did: merge it before our next push
      } else if (status === 401) {
        location.reload();                               // session ended → login page
      } else if (status >= 400 && status < 500) {
        refused(data);
      } else {
        throw new Error('server ' + status);
      }
    } catch (e) {
      banner = '<div class="msg crit" style="margin-bottom:14px"><b>مفيش اتصال بالسيرفر.</b> التغييرات لسه ما اتحفظتش. متقفلش الصفحة، هحاول تاني لوحدي.</div>';
      if (!retryTimer) retryTimer = setTimeout(() => { retryTimer = null; push(); }, 5000);
    } finally {
      busy = false;
      if (H && banner !== bannerBefore) H.render();      // re-render only when the message changed (never disturb typing)
      if (again) { again = false; push(); }
    }
  }

  /** The server said no: show why, then reload so the screen matches the database. */
  function refused(data) {
    const msg = data.message || 'السيرفر رفض العملية.';
    // Reload to show the server's truth, but never loop: after 3 refusals within a minute, stop and say so.
    let recent = [];
    try { recent = JSON.parse(sessionStorage.getItem('femRefused') || '[]').filter(t => Date.now() - t < 60000); } catch (e) { /* no storage */ }
    recent.push(Date.now());
    try { sessionStorage.setItem('femRefused', JSON.stringify(recent)); } catch (e) { /* no storage */ }
    H.toast(msg);
    if (recent.length >= 3) {
      readOnly = true;
      banner = '<div class="msg crit" style="margin-bottom:14px"><b>' + H.esc(msg) + '</b> السيرفر بيرفض الحفظ بشكل متكرر، فوقّفت الحفظ التلقائي. حدّث الصفحة، ولو المشكلة فضلت كلّم المدير.</div>';
      H.render();
      return;
    }
    banner = '<div class="msg crit" style="margin-bottom:14px"><b>' + H.esc(msg) + '</b> بيتم تحديث البيانات من السيرفر…</div>';
    setTimeout(() => location.reload(), 2200);
  }

  // ------------------------------------------------------------------ pull

  async function pullNow() {
    const { status, data } = await api('GET', '/api/sync/pull?since=' + since + '&fileSince=' + fileSince);
    if (status === 401) { location.reload(); return; }
    if (status !== 200) return;
    apply(data);
    since = data.rev;
  }

  async function pull() {
    if (!getS || busy || document.visibilityState === 'hidden') return;
    try {
      if (diff(getS())) { await push(); return; }
      await pullNow();
    } catch (e) { /* offline: try again next tick */ }
  }

  /** Merge what other people did into S. A row this page has edited but not yet sent is left alone. */
  function apply(r) {
    const s = getS();
    let changed = false;

    (r.moves || []).forEach(m => {
      if (!base.moves.has(m.id)) { s.moves.push(m); base.moves.add(m.id); changed = true; }
    });
    if (changed) s.moves.sort((a, b) => a.id - b.id);

    COLL.forEach(([name, get, key]) => {
      const rows = (r.coll || {})[name] || [];
      if (!rows.length) return;
      const arr = get(s);
      const known = base.coll[name] || (base.coll[name] = new Map());
      rows.forEach(({ k, row, gone }) => {
        const i = arr.findIndex(x => key(x) === k);
        if (i >= 0 && known.get(k) !== json(arr[i])) return;      // edited locally, unsent: the push will decide
        if (gone) {
          if (i >= 0) arr.splice(i, 1);
          known.delete(k);
        } else {
          if (i >= 0) arr[i] = row; else arr.push(row);
          known.set(k, json(row));
        }
        changed = true;
      });
    });

    Object.keys(r.meta || {}).forEach(k => {
      const def = META.find(m => m[0] === k);
      if (!def) return;
      const local = def[1](s);
      if (local !== undefined && base.meta[k] !== undefined && base.meta[k] !== json(local)) return;
      def[2](s, r.meta[k].v);
      base.meta[k] = json(r.meta[k].v);
      changed = true;
    });

    (r.audit || []).forEach(a => {
      if (base.audit.has(sig(a))) return;
      s.audit.push(a);
      base.audit.add(sig(a));
      changed = true;
    });
    if (s.audit.length > 300) s.audit.splice(0, s.audit.length - 300);

    (r.files || []).forEach(f => { registerFile(f); changed = true; });
    if (r.users) s.users = r.users;
    if (r.roles) s.roles = r.roles;
    if (changed) H.after();
  }

  // ------------------------------------------------------------------ session + users admin (server-backed)

  async function logout() {
    await api('POST', '/api/auth/logout', {});
    location.reload();
  }

  async function usersCall(method, path, body, okMsg) {
    const { status, data } = await api(method, path, body);
    if (status >= 200 && status < 300) {
      if (okMsg) H.toast(okMsg);
      await pullNow();
      H.render();
    } else {
      H.toast(data.message || 'مقدرتش أنفّذ.');
    }
  }

  function usersPage() {
    const s = getS(), esc = H.esc;
    if (!H.can('users')) {
      return '<section class="card"><h2>المستخدمين والصلاحيات</h2><div class="msg warn">دورك مش بيسمح بإدارة المستخدمين.</div></section>';
    }
    const roles = Object.keys(s.roles);
    const opt = sel => roles.map(r => '<option value="' + r + '" ' + (sel === r ? 'selected' : '') + '>' + esc(s.roles[r].name) + '</option>').join('');
    const active = s.users.filter(u => !u.arch);
    let h = '<section class="card"><h2>المستخدمين <span class="hint">كل حاجة بتتسجل باسم اللي دخل</span></h2><div class="tw"><table class="dt"><thead><tr><th>الاسم</th><th>اسم الدخول</th><th>الدور</th><th>شغّال</th><th>كلمة سر جديدة</th><th></th></tr></thead><tbody>'
      + active.map(u => '<tr><td><b>' + esc(u.name) + '</b>' + (u.id === s.cur ? ' <span class="pill info">أنت</span>' : '') + '</td>'
        + '<td class="mono">' + esc(u.username || '') + '</td>'
        + '<td><select data-c="fsurole" data-id="' + u.id + '" aria-label="دور ' + esc(u.name) + '">' + opt(u.role) + '</select></td>'
        + '<td><input type="checkbox" data-c="fsuon" data-id="' + u.id + '" aria-label="' + esc(u.name) + ' شغّال" ' + (u.on !== false ? 'checked' : '') + '></td>'
        + '<td>' + (u.id === s.cur ? '<input type="password" id="fsc_' + u.id + '" placeholder="الحالية" autocomplete="current-password" style="width:110px"> ' : '')
        + '<input type="password" id="fsp_' + u.id + '" placeholder="جديدة (8+)" autocomplete="new-password" style="width:120px"> <button class="btn sm" data-a="fsupass" data-id="' + u.id + '">تغيير</button></td>'
        + '<td>' + (u.id === s.cur ? '' : '<button class="btn sm" data-a="usarch" data-id="' + u.id + '">أرشفة</button>') + '</td></tr>').join('')
      + '</tbody></table></div>'
      + '<div class="picker" style="margin-top:12px"><label class="f">الاسم<input id="fsn_name"></label><label class="f">اسم الدخول (إنجليزي)<input id="fsn_user" autocomplete="off" style="direction:ltr;text-align:start"></label><label class="f">الدور<select id="fsn_role">' + opt('pack') + '</select></label><label class="f">كلمة السر<input id="fsn_pass" type="password" autocomplete="new-password"></label><button class="btn pri" data-a="fsuadd">+ إضافة مستخدم</button></div>'
      + (s.users.some(u => u.arch) ? '<p class="muted" style="margin-top:8px;font-size:12.5px">المستخدمين المؤرشفين (' + s.users.filter(u => u.arch).length + ') هتلاقيهم في السجل ← المؤرشف.</p>' : '')
      + '</section>';
    h += '<section class="card"><h2>مصفوفة الصلاحيات <span class="hint">بتتطبّق على السيرفر. المدير دايمًا كل حاجة</span></h2><div class="tw"><table class="t-sm"><thead><tr><th>الصلاحية</th>'
      + roles.map(r => '<th class="num">' + esc(s.roles[r].name) + '</th>').join('') + '</tr></thead><tbody>'
      + H.PERMS.map(p => '<tr><td>' + p[1] + '</td>' + roles.map(r => '<td class="num"><input type="checkbox" data-c="fsrolep" data-r="' + r + '" data-p="' + p[0] + '" aria-label="' + p[1] + ' · ' + esc(s.roles[r].name) + '" ' + (s.roles[r].perms.indexOf(p[0]) >= 0 ? 'checked' : '') + (r === 'admin' ? ' disabled' : '') + '></td>').join('') + '</tr>').join('')
      + '</tbody></table></div></section>';
    return h;
  }

  // ------------------------------------------------------------------ wiring

  const ACT_SERVER = {
    fslogout: () => logout(),
    fsuadd: () => {
      const v = id => (document.getElementById(id) || {}).value || '';
      usersCall('POST', '/api/users', { name: v('fsn_name'), username: v('fsn_user'), role: v('fsn_role'), password: v('fsn_pass') }, 'اتضاف المستخدم');
    },
    fsupass: el => {
      const v = id => (document.getElementById(id + el.dataset.id) || {}).value || '';
      usersCall('POST', '/api/users/' + el.dataset.id + '/password', { password: v('fsp_'), current: v('fsc_') }, 'اتغيّرت كلمة السر');
    },
    usarch: el => usersCall('PATCH', '/api/users/' + el.dataset.id, { arch: true, active: false }, 'اتأرشف المستخدم'),
    usrestore: el => usersCall('PATCH', '/api/users/' + el.dataset.id, { arch: false, active: true }, 'اتسترجع المستخدم'),
  };
  const CHG_SERVER = {
    fsurole: el => usersCall('PATCH', '/api/users/' + el.dataset.id, { role: el.value }, 'اتغيّر الدور'),
    fsuon: el => usersCall('PATCH', '/api/users/' + el.dataset.id, { active: el.checked }, null),
    fsrolep: el => {
      const role = el.dataset.r;
      const perms = [...document.querySelectorAll('input[data-c="fsrolep"][data-r="' + role + '"]')].filter(c => c.checked).map(c => c.dataset.p);
      usersCall('PUT', '/api/roles/' + role, { perms }, 'اتحفظت الصلاحيات');
    },
  };
  const unavailable = msg => () => H.toast(msg);
  const ACT_DISABLED = {
    demoload: unavailable('الداتا التجريبية مش متاحة على السيرفر.'),
    demoask: unavailable('الداتا التجريبية مش متاحة على السيرفر.'),
    demoreset: unavailable('الداتا التجريبية مش متاحة على السيرفر.'),
    reset: unavailable('مفيش مسح في السيستم.'),
    reset2: unavailable('مفيش مسح في السيستم.'),
    bkyes: unavailable('الاسترجاع من نسخة احتياطية بيتعمل من السيرفر بالأداة tools/import_backup.php.'),
    lockapp: () => logout(),
  };

  window.FSYNC = {
    /**
     * Called once by the app's load(). `getState` returns the live S; `helpers` gives access to the app.
     * `fresh` is true when the server had no data yet: the app starts from its built-in seed and an admin uploads it.
     */
    attach(getState, helpers, fresh) {
      getS = getState;
      H = helpers;
      Object.assign(H.ACT, ACT_SERVER, ACT_DISABLED);
      Object.assign(H.CHG, CHG_SERVER);
      (BOOT.files || []).forEach(registerFile);
      if (fresh) {
        base.moves = new Set(); COLL.forEach(([n]) => { base.coll[n] = new Map(); }); META.forEach(([k]) => { base.meta[k] = undefined; });
        const u = (BOOT.user || {});
        readOnly = !(u.perms || []).includes('*');
        if (readOnly) banner = '<div class="msg warn" style="margin-bottom:14px"><b>السيرفر لسه فاضي.</b> لازم المدير يفتح التطبيق الأول عشان يحمّل البيانات الأساسية.</div>';
      } else {
        indexBase(getS());
      }
      setInterval(pull, POLL_MS);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); });
      window.addEventListener('online', pull);
      if (fresh && !readOnly) setTimeout(push, 300);
    },
    files: { put: putFile, download: downloadFile },
    push,
    pull,
    banner: () => banner,
    usersPage,
    logout,
  };
})();
