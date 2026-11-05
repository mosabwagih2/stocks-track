#!/usr/bin/env python3
"""
Builds app/views/app.html (the PHP edition of the browser app) from the standalone Brand 2 build.

    python3 php-app/frontend/build_app.py

The output differs from apps/edition-3-brand-v2/index.html ONLY by the patches listed below, so
`diff apps/edition-3-brand-v2/index.html php-app/app/views/app.html` shows exactly what the server edition changes.
Every patch asserts that its target exists exactly once, so a change in the app makes the build fail loudly.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / 'apps' / 'edition-3-brand-v2' / 'index.html'
OUT = ROOT / 'php-app' / 'app' / 'views' / 'app.html'

s = SRC.read_text(encoding='utf-8')


def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit(f'patch target found {n} times (expected {count}): {old[:90]!r}')
    s = s.replace(old, new)


def replace_function(name, new_source):
    """Replaces a whole top-level function. Single-line functions end at the newline, multi-line ones at "\\n}\\n"."""
    global s
    start = s.index(f'function {name}(')
    assert s.count(f'function {name}(') == 1, name
    eol = s.index('\n', start)
    first = s[start:eol]
    end = eol if not first.rstrip().endswith('{') else s.index('\n}\n', start) + 2
    s = s[:start] + new_source + s[end:]


# 1. Start from the state the server embedded in the page (window.FEM_BOOT), not from localStorage.
replace_function('load', """function load(){
  const B=window.FEM_BOOT;
  if(B.empty){   /* the server has no data yet: start from the built-in seed; an admin's browser uploads it */
    S=seed();Object.assign(S,{users:B.state.users,roles:B.state.roles,cur:B.state.cur,actor:B.state.actor,lock:'',audit:[],closes:[],shops:[],archPk:[],archDocs:[]});
  }else S=B.state;
  S.date=cairoToday();ensureSup(S);ensureCat(S);rebuildCatalog();
  FSYNC.attach(()=>S,{render:()=>render(),toast,esc,ACT,CHG,PERMS,can:p=>can(p),
    PH,cxKey,saveFile,
    after:()=>{_bal=null;_ctx=null;ensureCat(S);rebuildCatalog();UI.pendingRender=true;rollCheck()}},!!B.empty);
  autoCloseTo(addDays(S.date,-1));
}""")

# 2. "Save" sends the changes to the server instead of writing localStorage.
replace_function('save', "function save(){FSYNC.push()}")

# 3. The banner shows connection / refusal messages instead of "browser storage is full".
replace_function('storeBanner', "function storeBanner(){return FSYNC.banner()}")

# 3b. Photos and original files live on the server (POST/GET /api/files) instead of IndexedDB.
replace_function('phPut', "function phPut(id,data){}")
replace_function('phClear', "function phClear(){Object.keys(PH).forEach(k=>delete PH[k])}")
replace_function('phLoad', "function phLoad(){return Promise.resolve()}")
replace_function('flPut', "function flPut(key,blob){FSYNC.files.put(key,blob)}")
replace_function('flGet', "function flGet(key){return Promise.resolve(null)}")
replace_function('flDel', "function flDel(key){}")
replace_function('flDL', "function flDL(key,label){return FSYNC.files.download(key,label)}")

# 4. No cross-tab localStorage guard: the server is the single source of truth now.
rep("window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue!==null&&!STALE){STALE=true;_L.main=null;render()}});", "")

# 5. Login is a real server session; the browser-side PIN lock screen is never used.
rep("S.users.some(u=>u.pin)", "false", count=2)

# 6. Users and permissions are managed on the server.
rep("function vAccess(){", "function vAccess(){return FSYNC.usersPage()}\nfunction vAccessLocal(){")
rep("قفل الشاشة / تبديل مستخدم", "تسجيل الخروج")

# 7. Page plumbing: boot data + the sync adapter come before the app script.
#    (The standalone file is an Artifact fragment without <html>/<head>/<body>; public/index.php wraps it in a full document.)
rep("""<div id="app"></div>
<script>
(function(){
'use strict';""", """<div id="app"></div>
<script>/*__FEMINI_BOOT__*/</script>
<script src="assets/sync.js"></script>
<script>
(function(){
'use strict';""")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(s, encoding='utf-8')
print(f'wrote {OUT.relative_to(ROOT)} ({len(s):,} bytes)')

# The sync adapter is served as a static file next to the page.
import shutil
(ROOT / 'php-app' / 'public' / 'assets').mkdir(parents=True, exist_ok=True)
shutil.copy(ROOT / 'php-app' / 'frontend' / 'sync.js', ROOT / 'php-app' / 'public' / 'assets' / 'sync.js')
print('copied sync.js')
