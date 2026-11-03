# stocks-track

Warehouse tracking prototypes for **Fémini** (women's underwear brand, Egypt): every piece in and out by SKU (model × color × size), with states, transfers, returns, stocktakes, lost-item handling and stock reports.

This repository is the **design and brainstorming state** of the project, to be handed over to the real build. Nothing here is production software: both prototypes are single HTML files that keep their data in the browser only (no backend, no real photo storage).

## Start here
- [`docs/LOVABLE_BRIEF.md`](docs/LOVABLE_BRIEF.md): the full handoff brief (problem, real data, decisions, open questions, build plan, acceptance scenarios).

## What is inside
| Path | What |
|---|---|
| `apps/standard-edition/index.html` | **Recommended base.** Odoo/Oracle-style terminology: Overview with operation types, Transfers (Draft, Waiting, Ready, Done), Backorders, Returns, Inventory Adjustments, locations, Stock / Moves / Replenishment / ABC / Kits reports. English labels with Arabic hints. |
| `apps/edition-3/index.html` | **Edition 3 (full redesign).** Built from the data and lessons of the first two: Today (control tower + action queue), Orders (pickup vs scanned, stuck orders, pick list), Inventory (model matrix + all variants), Operations (9 operation types, live effect panel), Supplies (flyers, packaging S/M/L, cups, auto-consumed by scans), Insights (manufacturing suggestion, demand, bundles, team, stock health), Ledger and audit, Configuration (thresholds, supply rules, costs). Rebuild with `python3 src/edition-3/build.py`; test in `tests/edition3_flow_test.js` (32 checks). |
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
