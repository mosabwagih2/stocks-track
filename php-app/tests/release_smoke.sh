#!/bin/sh
# Deploys the release zip into a temp folder exactly like a cPanel upload (fresh empty database, web installer) and checks it.
#   sh tests/release_smoke.sh      (build the zip first: sh tools/build_release.sh)
set -e
cd "$(dirname "$0")/.."
ZIP=$(ls -t dist/femini-cpanel-*.zip | head -1)
DIR=$(mktemp -d)
unzip -q "$ZIP" -d "$DIR"
R="$DIR/femini"
DBN=${FEMINI_TEST_DB_NAME:-femini_test}; DBU=${FEMINI_TEST_DB_USER:-femini}; DBP=${FEMINI_TEST_DB_PASS:-femini_pw}; DBH=${FEMINI_TEST_DB_HOST:-127.0.0.1}
KEY=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
PORT=$((8600 + $$ % 100)); BASE="http://127.0.0.1:$PORT"
pass=0; fail=0
ok() { if [ "$2" = "0" ]; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1"; fail=$((fail+1)); fi; }

# empty database
php -r '$p=new PDO("mysql:host='$DBH';dbname='$DBN'","'$DBU'","'$DBP'");$p->exec("SET FOREIGN_KEY_CHECKS=0");foreach($p->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN) as $t)$p->exec("DROP TABLE `$t`");'

# config exactly as the guide says: copy the example and fill it in
cp "$R/config/config.example.php" "$R/config/config.php"
sed -i "s/'host'    => 'localhost'/'host'    => '$DBH'/; s/'name'    => 'cpaneluser_femini'/'name'    => '$DBN'/; s/'user'    => 'cpaneluser_femini'/'user'    => '$DBU'/; s/'pass'    => 'CHANGE_ME'/'pass'    => '$DBP'/; s/CHANGE_ME_TO_A_LONG_RANDOM_STRING/$KEY/" "$R/config/config.php"

cat > "$DIR/router.php" <<PHP
<?php
\$p = parse_url(\$_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (str_starts_with(\$p, '/api/')) { require '$R/public/api/index.php'; return true; }
return false;
PHP
php -S 127.0.0.1:$PORT -t "$R/public" "$DIR/router.php" >"$DIR/server.log" 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null; rm -rf "$DIR"' EXIT
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do curl -fs "$BASE/api/health" >/dev/null 2>&1 && break; sleep 0.2; done

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
[ "$(code "$BASE/")" = "302" ]; ok "empty database: the app sends you to the installer" $?
curl -s "$BASE/install.php" | grep -q "فحص البيئة"; ok "the installer shows the environment checklist" $?
curl -s "$BASE/install.php" | grep -q 'name="key"'; ok "and the install form" $?
curl -s -d "key=wrong-key&name=Admin&username=boss&password=Orbit-Maple-Stone-52" "$BASE/install.php" | grep -q "مفتاح التثبيت غلط"; ok "a wrong install key is refused" $?
curl -s -d "key=$KEY&name=Admin&username=boss&password=12345678" "$BASE/install.php" | grep -q "سهلة التخمين"; ok "a weak admin password is refused" $?
[ "$(php -r '$p=new PDO("mysql:host='$DBH';dbname='$DBN'","'$DBU'","'$DBP'");echo (int)$p->query("SHOW TABLES LIKE \"users\"")->rowCount() ? (int)$p->query("SELECT COUNT(*) FROM users")->fetchColumn() : 0;')" = "0" ]; ok "nothing was created by the failed attempts" $?
curl -s -d "key=$KEY&name=Admin&username=boss&password=Orbit-Maple-Stone-52" "$BASE/install.php" | grep -q "تم التثبيت"; ok "install succeeds with the key and a good password" $?
[ -f "$R/storage/installed.lock" ]; ok "the installer locked itself (installed.lock)" $?
[ "$(code -d "key=$KEY&name=X&username=hack&password=Orbit-Maple-Stone-53" "$BASE/install.php")" = "403" ]; ok "the installer cannot run twice (403)" $?
curl -s "$BASE/" | grep -q 'id="f"'; ok "the home page now shows the login form" $?
J="$DIR/cj"
curl -s -c "$J" -b "$J" -H 'Content-Type: application/json' -d '{"username":"boss","password":"Orbit-Maple-Stone-52"}' "$BASE/api/auth/login" | grep -q '"ok":true'; ok "the new admin can log in" $?
curl -s -c "$J" -b "$J" "$BASE/" | grep -q 'window.FEM_BOOT='; ok "the app page opens with the server state embedded" $?
curl -s -c "$J" -b "$J" "$BASE/" | grep -q '"empty":true'; ok "a fresh server is flagged empty (the first admin visit uploads the base data)" $?
[ "$(code "$BASE/config/config.php")" != "200" ]; ok "config.php is not downloadable from the web root" $?
[ "$(code "$BASE/app/bootstrap.php")" != "200" ]; ok "app code is not under the web root" $?
(cd "$R" && php tools/check.php >"$DIR/check.txt" 2>&1; echo $? >"$DIR/check.code")
[ "$(cat "$DIR/check.code")" = "0" ]; ok "tools/check.php finds no FAIL on the deployed copy" $?
grep -qE "Warning|Notice|Deprecated|Fatal" "$DIR/server.log" && ok "no PHP warnings in the server log" 1 || ok "no PHP warnings in the server log" 0
echo; echo "$pass passed, $fail failed"
[ "$fail" = "0" ]
