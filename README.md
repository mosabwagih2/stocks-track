# stocks-track

Warehouse tracking prototypes for **Fémini** (women's underwear brand, Egypt): every piece in and out by SKU (model × color × size), with states, transfers, returns, stocktakes, lost-item handling and stock reports.

This repository is the **design and brainstorming state** of the project, to be handed over to the real build. Nothing here is production software: both prototypes are single HTML files that keep their data in the browser only (no backend, no real photo storage).

## Production app
`web/` is the real build: **React + TypeScript + Tailwind CSS + Supabase** (database functions enforce the rules; the ledger is append-only). `supabase/` has the migrations, the seed generated from the real data, and SQL tests that run on a throw-away Postgres. See [`web/README.md`](web/README.md). The single-file prototypes below stay as design references.

## Start here
- [`docs/LOVABLE_BRIEF.md`](docs/LOVABLE_BRIEF.md): the full handoff brief (problem, real data, decisions, open questions, build plan, acceptance scenarios).

## What is inside
| Path | What |
|---|---|
| `apps/standard-edition/index.html` | **Recommended base.** Odoo/Oracle-style terminology: Overview with operation types, Transfers (Draft, Waiting, Ready, Done), Backorders, Returns, Inventory Adjustments, locations, Stock / Moves / Replenishment / ABC / Kits reports. English labels with Arabic hints. |
| `apps/edition-3/index.html` | **Edition 3 (full redesign).** Built from the data and lessons of the first two: Today (control tower + action queue), Orders (pickup vs scanned, stuck orders, pick list), Inventory (model matrix + all variants), Operations (9 operation types, live effect panel), Supplies (flyers, packaging S/M/L, cups, auto-consumed by scans), Insights (manufacturing suggestion, demand, bundles, team, stock health), Ledger and audit, Configuration (thresholds, supply rules, costs). Rebuild with `python3 src/edition-3/build.py`; test in `tests/edition3_flow_test.js` (32 + 26 supplies checks). |
| `apps/task-first-edition/index.html` | First prototype, task-first and fully Arabic ("what did you do?"), with the stock desk, effect preview before confirming, analytics. **Now also has the Scanned Orders flow** (pickup = demand, scanned = actual out, stuck orders, per-employee counts); this is the version the user will most likely continue with. |
| `src/task-first-edition/` | Source of the first prototype (`app.src.html` + `data.json`). Rebuild with `python3 src/task-first-edition/build.py`. |
| `tests/task_first_scan_test.js` | Playwright test (28 checks) for the scan flow. It uses `data/QRbot_202611021914566_scanned_orders.csv` and expects `apps/task-first-edition/index.html` (check the paths at the top of the file). |
| `src/standard-edition/` | Source parts of the standard edition. Rebuild with `python3 src/standard-edition/build.py`. |
| `data/femini_master_skus.csv` | Cleaned master: 626 variants, English names, legacy min alert, opening stock (physical count of 2026-10-29). |
| `data/QRbot_202611021914566_scanned_orders.csv` | Real scanner export of 2026-11-02 (28 scanned orders; the QR holds the order code). |
| `data/vendoor_pickups_2026-11-02_lines.csv` | One real day of Vendoor pickup lines (92 orders, 1,070 pieces), without customer personal data. |

## Running the prototypes
Open an `index.html` in a browser. No server or build is needed. Excel import (pickup sheets, count sheets) runs in the browser through the SheetJS library loaded from a CDN.
To reset the demo data: standard edition, Configuration, Data, Reset demo data.

## Data and privacy
- Customer names, phone numbers and addresses are never imported or stored.
- The demo data is the real data: real order codes and waybill numbers of 2026-11-02, so importing the same Vendoor sheet again is detected as duplicates.
- Stock quantities and demand figures are real business data of the brand.

## Key rules decided so far
- Stock is a ledger of immutable moves between locations; balances are derived, never typed.
- Five states: ready, needs cleaning, scrap (final), at factory (pending), lost. Washing and waste are the only things sent to the factory.
- A return sheet gives expected pieces; expected minus received becomes lost automatically.
- Permissions are intentionally postponed; the system is open during testing.

See the brief for everything else (open questions: bundles, cups, lead times, channel formats, costing).

## Edition 3 variants (`variants/edition-3`)

`apps/edition-3/index.html` and `apps/edition-3-brand/index.html` are built from `variants/edition-3/base.html` (the previous Edition 3) by `variants/edition-3/build.sh`:

1. `1_state.py`: clearer "needs washing" / "at factory" states, clickable rows with a detail sheet (SKUs, quantities, days since sent) and a prefilled draft action.
2. `2_returns_sheet.py`: upload the shipping company's return sheet inside Customer Returns; matches by order code and fills the expected list.
3. `3_toggle.py`: sidebar toggle with a short animation (Ctrl+B).
4. `1d_integrity.py` (runs after step 2): one reorder engine for alerts, plan and rate tab; returns linked to orders; safe cancel/reverse; net shipped; storage warning.
5. `1e_mobile.py`: phone layout (bottom bar with a More sheet, compact matrix, one-line tables); desktop is unchanged.
6. `1f_search.py`: stock search bar shared by the three views.
7. `1g_dashboard.py` (+ `dashboard.js`): the command-center tab in Analytics (money, movement, stock health, trends, top SKUs, governorates), period based.
8. `1h_motion.py`: purposeful motion (press feedback, sheet enter/exit, drag-to-dismiss on phones, page enter, tooltip delay, toast, changed-value pulse) that switches off with prefers-reduced-motion.
9. `4_brand.py`: the Fémini logo and a palette derived from the logo purple #43316f. This is the comparison copy.

`src/edition-3/build.py` still builds the older Edition 3 and would overwrite `apps/edition-3`. Rebuild with `variants/edition-3/build.sh` afterwards, or port the changes into `src/edition-3`.

`tests/edition3_integrity_test.js` runs a full cycle (ship, return, cancel, reverse, supplies, alerts, reload) and checks the ledger, supplies and cross-page totals. Run with `node tests/edition3_integrity_test.js` (set `APP=` to test another build).
`tests/edition3_mobile_test.js` checks the 390px phone layout (no sideways scroll, bottom bar, matrix fit, tap sizes, 16px fields) and that the desktop layout is unchanged.
`tests/edition3_search_test.js` covers the stock search bar (all views, matching rules, focus, clear, phone).
`tests/edition3_dashboard_test.js` checks every dashboard number against an independent calculation on a 100-day synthetic history (periods, previous-period comparison, ledger replay for stock level, top 10, blocked value, costs, live scan/return).
`tests/edition3_motion_test.js` checks the motion behaviour, reduced motion and drag-to-dismiss (21 checks).

### Redesign copy (`apps/edition-3-brand-v2`)

Built by `variants/edition-3/5_redesign.py` (with `redesign_stock.js` and `redesign_rest.js`) from the same base, so logic and data are identical. It only changes how data is organised: stock as a grouped list with the matrix on demand, orders grouped by pickup with value, the ledger as a document feed by day, supplies as a table with operations grouped, settings in sections, operations as a launcher with pinned drafts. `tests/edition3_v2_test.js` checks every figure against the raw data (31 checks).

The redesign copy also rebuilds Today (hero with ring, next action, activity timeline) and Analytics (six tabs by question; demand and manufacturing pages merge what used to be spread over four tabs). `tests/edition3_v2b_test.js` covers both (24 checks).

The redesign copy has a stock heat map (Stock > خريطة): model x size, coloured by shortage / below reorder point / enough / surplus, from the same per-SKU engine as the alerts. `tests/edition3_heat_test.js` checks colours and labels against hand-computed values (15 checks).


## Edition 3 Brand 2: demo data and tour

- `variants/edition-3/redesign_demo.js`: deterministic generator (`genDemo`) that fills the app with 28 days of operations through the real code paths (pickups, scans, returns, wash/factory, receipts, shop transfers, count, losses, cancellations, reversed scan, supplies) for Vendoor, Noon, Amazon, Shopify and Facebook. About 1.6 MB of browser storage.
- Settings, "داتا تجريبية وجولة": load/reset buttons and a 12-card tour (problem, how the system solves it, live numbers, jump button). Today shows a banner while demo data is loaded.
- Stock heat map now uses the same look as the demand heat map (purple intensity, corner dot for short/low/surplus). Test: `tests/edition3_heat_test.js`, `tests/edition3_demo_test.js`.
- Analytics charts modernised in Brand 2 (`redesign_charts.js`): smooth gradient area lines with crosshair hover, SVG column charts with hairline grid, slim gradient bars.

## Brand 2 (Copy): Studio redesign

- `variants/edition-3/studio.css` + `6_studio.py` build `apps/edition-3-brand-v2-copy` on top of Brand 2: warm ivory ground, aubergine ink, one accent, segmented controls, quiet tables, larger numbers, hairline cards.
- The demo tab opens with a 9-second looping stage (stageshow-style: a cursor scans, the order flips, the balance rolls, the supplies tick). It shows the end state when reduced motion is on.

## Brand 2: users, roles, permissions, day close

- `variants/edition-3/redesign_access.js` (+ `access_patch.py`): users with roles (admin, supervisor, packer, read-only), editable permission matrix, optional PIN lock screen, audit log, money masking, per-action and core-function permission guards.
- Day close: checklist (blockers and warnings), opening + in - out = closing reconciliation per state, locks every day up to the closed date (documents, cancellations, supplies), admin reopen with a logged reason. Test: `tests/edition3_access_test.js`.
- Scope: this is browser-side (localStorage, hashed PINs), so it prevents mistakes and keeps an audit trail. Real enforcement needs the server (Supabase) version.

## Production audit (Brand 2)

- New suites: `edition3_fuzz_test.js` (random operations, ledger/order/supply invariants after every step), `edition3_crawl_test.js` (every screen x light/dark x desktop/phone x empty/demo data, plus HTML-injection check), `edition3_prod_test.js` (reload persistence, PIN after reload, corrupt/old storage, quota, double submit, two tabs, midnight rollover, bad import files, backup/restore, speed).
- Fixes from the audit: demo load left the catalog state unset (the "all items" view crashed), a document could be confirmed twice, two tabs could overwrite each other, accessibility labels in the users tab.
- Added: backup download and restore (Settings, Data) with a reminder on Today.

## Analytics merge (Brand 2)

Six tabs became four: overview, demand, stock and manufacturing, blocked. Team moved into the overview, stock health into stock and manufacturing, governorates and top SKUs live only in demand. Stock-by-state and the duplicated stock value were dropped from analytics (they live on the Stock page and Today). Today also got a scrap menu (classify, send to factory, receive from factory) and lost its subtitle.

> Day close was removed from Brand 2 (it confused the daily flow). Old saved states that had a locked day open unlocked. Users, roles, PIN lock and backups stay.

> Day close is back in Brand 2 in a simple form: a Today button, one sheet (plain explanation, six numbers, short checklist that never blocks, one button), a green line when closed, one-click reopen, no reason asked. It covers only the current day.

## The log, redesigned (Brand 2)

Two views instead of three tabs that looked alike: "اللي حصل" (one feed of operations, cancellations, supply entries and system events, grouped by day, each with person and time, filters by type, person, day and search) and "تتبّع صنف" (one item's full journey with the ready balance after each move). Raw move tables and the separate audit tab are gone; their data lives in these two.
