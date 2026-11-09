# Fémini Stock: how the live system is built, changed and deployed

> **للي هيكمّل (إنسان أو AI):** اقرأ الملف ده الأول. فيه إيه اللي شغّال على الموقع فعلًا، وإزاي تعدّل،
> وتختبر، وترفع، من غير ما تبوّظ بيانات المصنع. النظام ده مخزن حقيقي و«لا يحتمل الخطأ».

Last updated: 2026-11-09.

---

## 1. What is live

| | |
|---|---|
| Live site | https://stock.whynet.shop |
| Hosting | cPanel (Namecheap), user `whynaqgj` |
| Repo | https://github.com/mosabwagih2/stocks-track, branch **`add-lovable-v2`** (the live branch) |
| Server code | `php-app/` (PHP 8.2 + MySQL, database `whynaqgj_femini`) |
| Browser app | `lovable-v2/` (React + TypeScript + Tailwind). Its production build is committed into `php-app/public/app/` |
| Docroot | `/home/whynaqgj/stocks-track/php-app/public` (inside the cPanel Git clone) |

`lovable-v2/NOTES.md` is **outdated**: it says lovable-v2 is not the live app. It is: the PHP server serves the
lovable-v2 bundle (`php-app/public/app/cpanel.html` + `assets/`) and only does the API, rules, auth, files and sync.
`apps/`, `variants/`, `web/`, `src/` at the repo root are older editions; do not edit them for the live system.

## 2. How the code is organised

```
lovable-v2/src/femini/
  domain/      pure business rules (no React, no storage): ops.ts, ledger.ts, settle.ts, holds.ts, trends.ts,
               pickup.ts, scan.ts, flow.ts, reports.ts … each with *.test.ts next to it
  data/        the repository: memory.ts (the state + every command: postOp, holdOut, importSettlement …)
    cpanel/    the server edition: backend.ts (pull/push/epoch/files), v3.ts (server rows <-> app state),
               fake-server.ts (an in-memory COPY of the PHP rules, used by tests and the local test server)
  hooks/data.tsx  Derived: everything computed once from the snapshot (blocked orders, demand, pull, modelOrder …)
  pages/       one file per page (Today, Stock, Orders, Operations, Insights, Ledger, Files, Settings)
  components/  shared UI: ui.tsx (Card, Kpi, Sheet, Seg …), charts.tsx (all charts), OrderSheets, DeliveryNote …
php-app/app/src/
  Sync/Rules.php        server-side validation of every move/doc (which places each move type may use)
  Auth/Permissions.php  which permission each doc type needs
  Sync/SyncService.php, Snapshot.php, Restore.php, Controllers/*
```

### Rules that must not be broken
- **Stock is an immutable ledger.** Balances are always derived from moves (`domain/ledger.ts`). Never write a
  balance, never edit an old move. A correction is a new move.
- Every stock operation goes through the pure `buildOp` (`domain/ops.ts`) and `repo.postOp`.
- **A new move type needs 4 places changed together**: `domain/ops.ts` (the moves), `php-app/app/src/Sync/Rules.php`
  (`MOVE_TYPES` + `placesFit`), `php-app/app/src/Auth/Permissions.php` (`DOC`), and the copy of those rules in
  `data/cpanel/fake-server.ts`. Add it to `DRAFTABLE` in `data/cpanel/v3.ts` and to `TYPE_AR` in `domain/constants.ts`.
  Example: the shop return `SRT` (EXT_SHOP <-> READY/DIRTY/SCRAP).
- Money (costs, settlements) is hidden from users without the `money` permission; the server strips `settles`
  in pull for them. Keep that when adding money views.
- Dates: Cairo day (`domain/dates.ts`: `cairoDay`, `addDays`). Digits are English (`ar-EG-u-nu-latn`).
- Customer names/phones from Vendoor sheets are never stored or printed.
- The repo is connected to **Lovable**: never force-push, never rewrite pushed history.

## 3. Day-to-day workflow (what was done for every change)

```sh
cd lovable-v2
npm install                         # once
```

1. **Edit** the code in `lovable-v2/src/femini/` (and `php-app/app/src/` if a server rule changes).
2. **Type check and lint**
   ```sh
   npx tsc --noEmit -p .
   npx eslint src/femini --rule 'prettier/prettier: off'      # 0 errors expected (warnings are known)
   ```
3. **Tests** (vitest). The two env vars run the extra tests against a copy of the live data and the real
   settlement sheets; without them those tests are skipped.
   ```sh
   FEMINI_LIVE_BOOT=$(pwd)/.local/boot.json FEMINI_SETTLE_DIR="C:/Users/PRINGLESS/Downloads" npx vitest run
   ```
4. **Try it for real in a browser on a copy of the live data** (never on the live site):
   ```sh
   npx vite --config vite.cpanel-dev.config.ts      # http://localhost:5181
   ```
   This runs the real app against `fake-server.ts` (the PHP rules in memory), loaded from `.local/boot.json`
   (made from a downloaded backup with `tools/backup-to-boot.mjs`; `.local/` is never committed). Restarting it
   resets everything. Its limits: uploaded files are not listed, `POST /api/users` is not stored, and
   `/api/admin/restore/*` does not exist. Check those on live.
   To test an upload, put a generated test file in `lovable-v2/public/` and remove it afterwards.
5. **Build the production bundle** (writes `php-app/public/app/`):
   ```sh
   npm run build:cpanel
   ```
6. **Commit and push** (from the repo root, on `add-lovable-v2`). Always fetch first; if `origin` has new
   commits, rebase on them and run the build again (the bundle files conflict otherwise).
   ```sh
   git -c core.longpaths=true fetch origin
   git log --oneline HEAD..origin/add-lovable-v2      # must be empty, or rebase first
   git add -A lovable-v2/src php-app/app php-app/public/app
   git commit -m "…"
   git -c core.longpaths=true push origin add-lovable-v2
   ```
   (The "commit-graph" warnings on this Windows checkout are harmless.)
7. **Deploy:** cPanel → Git™ Version Control → `stocks-track` → Manage → **Pull or Deploy** → **Update from Remote**.
   The docroot is inside that clone, so the pull *is* the deploy. ("Deploy HEAD Commit" is not used; there is no
   `.cpanel.yml`.) There is no SSH/Terminal; server scripts were run once via a temporary cron job, only with
   the owner's OK, and removed afterwards.
8. **Verify on live without writing data**: reload the site, check that the new bundle name
   (`/app/assets/cpanel-XXXX.js`) is loaded, and read the changed pages. Do not post test operations or
   upload files on live; ask the owner to do the first real one.

PHP has no local runtime on this machine; PHP changes are kept small, mirrored in `fake-server.ts`, and tested
there. `php-app/tests/` has the PHP test scripts (run on a server with PHP).

## 4. Data safety
- Backups: Settings → «النسخة الاحتياطية» downloads everything (data + files). Restore (admin, «استرجاع من نسخة احتياطية») is in Settings too,
  keeps a safety copy, and can be undone. Any restore stamps a new epoch; other open pages reload.
- Before anything risky on live, ask the owner to download a backup.
- Reading the live database is only for checks; writing to it is only through the app's normal operations.

## 5. Where things are (recent features)
| Feature | Code |
|---|---|
| Today: «متأخر من أيام سابقة» card + list | `pages/Today.tsx` (`older`, `FlowSheet` key `older`) |
| Finance trends (value / pieces per day) | `components/FinancialReport.tsx` `StockTrend`, `domain/trends.ts` `stockByDay` |
| Collections trends | `components/Collections.tsx` `CollectTrend`, `domain/trends.ts` `collectByDay` |
| Shared trend chart | `components/charts.tsx` `TrendArea` (pass axes as an array, not a fragment: recharts ignores fragments) |
| Heatmap colour popup (stock + demand maps) | `charts.tsx` `Heatmap` `breakdown` (portal to body; cards have a transform) |
| Settlements (تسوية) | `domain/settle.ts`, `components/Collections.tsx`, server collection `settles` |
| Shop return SRT + delivery notes | `domain/ops.ts`, `pages/Operations.tsx`, `components/DeliveryNote.ts`, `components/logo.ts` |
| Catalog prefill from an unlinked pickup line | `components/OrderSheets.tsx` (`toLink`), `CatalogSheets.tsx` (`prefill`, `addVariant`) |
| Model order in pickers | `hooks/data.tsx` `orderModels` / `d.modelOrder` |
| Hold settle | `components/Holds.tsx`, `domain/holds.ts` |
| Users / new account | `components/ServerAccount.tsx` `UsersCard` → `/api/users` |
| «تقفيل يوم المخزن» (orders by the day they left, money from any settlement day) | `domain/warehouseDay.ts`, `components/WarehouseDay.tsx`, Insights tab `whday` |
| Linking unlinked pickup lines (order card and scan upload) | `components/OrderSheets.tsx` `LinkLines` |
| Scan upload blocked when stock would go negative (buttons to size swap / count) | `components/OrderSheets.tsx` `UploadSheet` (`neg`) |

## 6. Open items
- «شيل المخزون اللون» (item 3 of an earlier list) is waiting for the owner to explain it.
- Not yet exercised on live: the first real shop return (SRT) and the first new account.
- Old test folders in `/home/whynaqgj` (`femtest-code`, `femtest-storage`, `femtest-log*.txt`, `femtest-done*`) can be deleted from File Manager.
- Stock value uses today's recorded cost for all days (there is no cost history); only models with a cost count.
