#!/usr/bin/env bash
# Spins up a throw-away Postgres, applies the migrations + seed, and runs the SQL assertions.
# Usage: supabase/tests/run.sh   (needs postgres server binaries; run as root or as a user that can su to postgres)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
DATA="${TMPDIR:-/tmp}/femini-pgtest"
PORT=54329
rm -rf "$DATA"; mkdir -p "$DATA"; chown postgres "$DATA" 2>/dev/null || true
su postgres -c "$PGBIN/initdb -D $DATA -A trust >/dev/null"
su postgres -c "$PGBIN/pg_ctl -D $DATA -o '-p $PORT -k $DATA' -l $DATA/log -w start >/dev/null"
trap 'su postgres -c "$PGBIN/pg_ctl -D $DATA stop -m fast >/dev/null" || true' EXIT
PSQL="psql -h $DATA -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -d postgres -c "create database femini" 
$PSQL -d femini -c "create role anon nologin; create role authenticated nologin;"
$PSQL -d femini -f "$ROOT/supabase/migrations/0001_init.sql"
$PSQL -d femini -f "$ROOT/supabase/seed.sql"
# the 28 order codes of the real QRbot scan file
REFS=$(tail -n +2 "$ROOT/data/QRbot_202611021914566_scanned_orders.csv" | cut -d, -f4 | tr -d '"' | paste -sd, -)
$PSQL -d femini -v refs="$REFS" -f "$ROOT/supabase/tests/assertions.sql"
echo "SQL tests passed"
