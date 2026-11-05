#!/bin/sh
# Runs the whole PHP-edition suite: API integration tests, end-to-end (browser) tests and the backup-import test.
# Needs: php (pdo_mysql, curl, gd, fileinfo), a throw-away MySQL/MariaDB database (see tests/env.php), node + playwright.
set -e
cd "$(dirname "$0")/.."
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
php tests/run.php
node tests/e2e.js
node tests/import_test.js
