<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Fémini Stock · تسجيل الدخول</title>
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/app/femini-icon.png">
<style>
  :root{--ink:#1f1738;--accent:#43316f;--bg:#f8f6fc;--line:#d9d2ea;--crit:#a3262c}
  @media (prefers-color-scheme:dark){:root{--ink:#efeaf8;--accent:#9b84d8;--bg:#17122b;--line:#3b3162;--crit:#ff8d92}}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}
  main{width:min(380px,100% - 32px)}
  h1{font-size:26px;margin:0 0 4px;color:var(--accent);letter-spacing:.3px}
  p{margin:0 0 22px;opacity:.7}
  label{display:block;font-size:13px;margin:14px 0 6px;opacity:.85}
  input{width:100%;padding:13px 14px;border:1px solid var(--line);border-radius:12px;font-size:16px;background:transparent;color:inherit}
  input:focus{outline:2px solid var(--accent);outline-offset:1px}
  button{margin-top:20px;width:100%;padding:14px;border:0;border-radius:12px;background:var(--accent);color:#fff;font-size:16px;font-weight:600;cursor:pointer}
  button:disabled{opacity:.6}
  #err{min-height:22px;margin-top:14px;color:var(--crit);font-size:14px}
</style>
</head>
<body>
<main>
  <h1>Fémini Stock</h1>
  <p>سجّل دخولك عشان تكمّل شغل المخزن.</p>
  <form id="f" autocomplete="on">
    <label for="u">اسم المستخدم</label>
    <input id="u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus style="direction:ltr;text-align:start">
    <label for="p">كلمة السر</label>
    <input id="p" name="password" type="password" autocomplete="current-password" required>
    <button id="b" type="submit">دخول</button>
    <div id="err" role="alert"></div>
  </form>
</main>
<script nonce="<?= htmlspecialchars($nonce, ENT_QUOTES) ?>">
document.getElementById('f').addEventListener('submit', async function (e) {
  e.preventDefault();
  var b = document.getElementById('b'), err = document.getElementById('err');
  b.disabled = true; err.textContent = '';
  try {
    var res = await fetch('api/auth/login', {
      method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: document.getElementById('u').value, password: document.getElementById('p').value})
    });
    var data = await res.json();
    if (res.ok) { location.reload(); return; }
    err.textContent = data.message || 'مقدرتش أسجّل الدخول.';
  } catch (x) {
    err.textContent = 'مفيش اتصال بالسيرفر.';
  }
  b.disabled = false;
});
</script>
</body>
</html>
