# Femini Warehouse System: handoff brief for the builder (Lovable)

You are continuing a brainstorming and prototyping process. Do not start from zero. This document is the state of the project: the business problem, the decisions already made, what was prototyped and what the user said about it, what is still open, and a recommended build plan. The user will give you more material (screens, data, files). Where this brief and the user's new instructions disagree, the user wins.

The user speaks Egyptian Arabic and works in a warehouse business. All user-facing text must support Arabic (RTL) with technical terms in English. Mobile and desktop both matter.

---

## 1. The business and the problem

**Fémini** is an Egyptian women's underwear brand: panties, bras, shorts, plus a few lace, embroidered and shirt/robe models. Brand tokens (from their design system artifact): page `#fcf9fe`, ink `#302568`, accent `#5e4394`; fonts Marcellus (display) and Montserrat (text).

**Flow of goods**
1. A **factory** produces and delivers pieces to the warehouse (paper receipt note signed by both sides).
2. The warehouse prepares **daily pickups** for sales channels: **Vendoor** (main, affiliate/marketplace), later **Noon, Amazon, Jumia**, and others. Each channel sends a **pickup sheet** (Excel) with the orders to prepare. There can be several pickups per day (a main one and an extra one, sometimes more).
3. Sold items go out with the shipping company. Some come back as **returns**; a **return sheet** from the channel lists what should come back. An employee sorts the returned pieces.
4. Dirty or unsellable pieces are **washed at the factory (free)**. Damaged pieces are handed to the factory and leave for good.
5. A small **retail shop** receives stock from the warehouse (a signed note by both sides).

**The problem:** "things get lost". The owner does not know how many pieces came in and went out, per model and size. Today stock lives in an Excel workbook whose computed sheets disagree with each other (see section 3). There is no single source of truth, no traceability, no loss detection.

**The goal:** a warehouse system where every piece is traceable by SKU (model × color × size): what came in, what went out, to whom, what is dirty, damaged, lost or pending at the factory, with counts, alerts and statistics. A production manager and a factory user may later use it too.

---

## 2. Real data we already know (use it as test data)

All of this comes from the user's files. Two CSVs are attached next to this brief:
- `femini_master_skus.csv`: the cleaned master (626 variants, English names, legacy min-alert, opening quantity).
- `vendoor_pickups_2026-11-02_lines.csv`: the two real pickup sheets of 2026-11-02, customer personal data removed (order codes and waybills are the real ones).

**Catalog**
- 28 models in the old file; **PAN6 ("pantie thong bundle 5") was excluded** because bundles are not stock items (see section 4). Result: **27 models, 626 variants**.
- Sizes: S, M, L, XL, 2XL, 3XL, 4XL (lace and shirt/robe models stop at 2XL; D3 stops at 3XL). Ordered, not alphabetical.
- 16 colors, some odd: "Red / Black trim", "Mint Green", "Baby Blue".
- Model codes and official English names (from their catalogue): PAN1 Classic Thong, PAN2 Sideless Thong, PAN3 High-Cut Thong, PAN4 Bikini, PAN5 Brief, BR1 Padded Sports Bra, BR2 Triangle Bra, BR3 Racerback Sports Bra, BR4 Thin-Strap Bralette, SH1 Hot Short, SH2 Contrast-Trim Short. Others: A1 to A12 embroidered, D1 to D3 lace, S1 robe, S2 shirt.
- Internal reference format used in the prototypes: `BR2-RED-2XL` (model, color code, size). Color codes: BLK, WHT, RED, BEG, GRY, ORG, OLV, FUC, YEL, MNT, BBL, NVY, PNK, SAL, ROS, RBK.

**Opening stock (physical count dated 2026-10-29):** 43,863 pieces, all counted as sellable. About 173 variants have zero stock. Stock is concentrated in 11 core models (PAN1-5, BR1-4, SH1-2); the A/D/S models hold a few hundred pieces in total.

**One day of pickups (2026-11-02):** 2 pickups, 92 orders, 1,070 pieces, 216 distinct variants, 124,750 EGP. Demand is concentrated: BR2 315, PAN3 309, SH2 232, SH1 77, BR1 58 pieces. Sizes L, 2XL, XL, 3XL dominate; S is rare (55). 39 of 92 orders have exactly 17 pieces and 20 have 10 pieces: most sales are **bundles of 5 colors** of one or more models, and Vendoor explodes them into single-piece lines. 2 orders are **exchange orders**.

**Vendoor pickup sheet layout (Arabic headers):** `كود الاوردر العشوائي` (order code), `بوليصة الشحن` (waybill), `حالة الاوردر الجزئية` (new or exchange), `العميل هيدفع مصاريف الشحن للاستبدال`, `ملاحظات العميل`, customer name, phone numbers, governorate, city, address, `المبلغ توتال بالشحن للاوردر`, `عدد القطع اللي في الاوردر`, `المنتجات المطلوبة في الاوردر`, `اسم التاجر`.
The products cell is one string with comma-separated items shaped like `FC-BR2 ( مخزن Y 21 )-L-اسود-1` = vendor code, vendor warehouse tag, size, color, quantity. The sum of items always equals the "pieces" column (verified on all 92 orders): keep that as an import integrity check.
**Customer name, phone and address must NOT be stored.** Keep order code, waybill, type, governorate, total, lines.

**Code mismatch:** Vendoor sends `FC-BR2`, the user's code is `BR2`; Vendoor also sent `Women A5` for `A5`. Hence a per-channel **alias table** (external code → internal reference), and an "unmapped" queue instead of guessing.

**Old Excel (the thing being replaced):** sheets "الأصناف", "حركة المخزون" (movements, all rows were just opening balances), "المخزون الحالي", "تحليل التشغيل", "لوحة المتابعة". Dates stored as text (`29\10\2026`). Trailing space in `PAN4 `; typo "مطزرات" vs "مطرزات". The cached totals were inconsistent (opening 43,913 vs 42,010 vs 15,060). That inconsistency is the core symptom.

**Not received yet:** Noon and Amazon pickup/return files. The user said they will send them. Return-sheet samples from any channel are also still missing.

---

## 3. Decisions already made (brainstorming results)

### 3.1 Core model: a stock ledger of moves between locations
- Never type a balance. Every change is a **stock move** `quantity > 0, from location → to location`, tied to a document, user and time. Moves are immutable. Mistakes are fixed by a reverse move (a Return or an Adjustment), never by edit or delete.
- Balance per variant per location is derived from moves. Sum over all locations (including virtual ones) must be zero per variant; run that check nightly.
- Quantity is an integer count of pieces. No serial numbers. The ledger unit is the piece; packaging (e.g. a bag of 24 cups) is converted at entry and kept on the line for audit.
- Time zone Cairo, currency EGP.

### 3.2 States / locations
Five real states, mutually exclusive, mapped in the second prototype to locations:

| Meaning | State (prototype 1) | Location (prototype 2) | Available to sell |
|---|---|---|---|
| Sellable | Ready / جاهز | `WH/Stock` | yes |
| Needs washing, recoverable | "هالك نظافة" (user's chosen name) | `WH/Cleaning` | no |
| Unrecoverable | "هالك نهائي" | `Virtual/Scrap` | no |
| Sent to factory for washing | at factory / pending | `Transit/Factory` | no |
| Missing, not yet resolved | lost / مفقود | `Virtual/Inventory loss` | no |

External/virtual: `Partners/Vendors` (factory), `Partners/Customers/<channel>`, `SHOP/Stock` (shop), `Virtual/Inventory adjustment`, `Virtual/Write-off`.
Rules: dirty → Ready is forbidden without a wash cycle through the factory. Allowed status changes: Ready → dirty or damaged, dirty → damaged, anything → lost, lost → Ready or dirty. Scrap leaves for good when handed to the factory. Washing is free; the factory returns washed pieces in batches, so the remainder stays "pending at factory" (it is not auto-lost).
Detail (reason, origin, notes) lives in free-text notes plus the document, not in extra states. The employee writes a note and picks the closest state.

### 3.3 Flows
1. **Receipt from factory.** Signed paper (both sides) is photographed and attached; the photo is mandatory to validate. Entry by product + color + size + quantity (single line) or by a color × size grid. Optional "declared total" from the paper is compared with the sum of lines and the difference is shown below the lines ("declared 100, entered 10, difference −90, 90 still to enter"). Validation is allowed with a difference (it is flagged). Each receipt keeps its date and supply identity so supply history is traceable per variant. The factory user may later also confirm; for now the paper photo is the proof.
2. **Delivery to a channel (pickup).** Import the channel sheet. Everything that physically left is what counts: the **prepared quantity**, not the requested one. Shortages (requested minus prepared) are recorded and reported. Show an aggregated **pick list by variant** (sorted by model, color, size) first, then per-order packing. Orders cancelled before handover can be unticked. No separate "reserve" step. Same-day extra pickups consume stock after the first; show the shortage caused by the extra pickup. Duplicate protection: (channel, order code, variant) is unique, so the same sheet cannot be imported twice. Exchange orders are normal outgoing flows with a flag.
3. **Return from a channel.** The sheet gives **expected** pieces per variant. The employee enters what was actually received and sorts each piece: sellable, needs washing, or damaged. **Expected minus received automatically becomes Lost**, tied to the channel. Extra pieces are flagged. If a variant is short and another size of the same model/color is in surplus, suggest "wrong size" instead of lost. A return can arrive in several shipments, so the return stays open until closed.
4. **Shop.** Fill a color × size grid per model; both sides sign a paper; photo attached. Pieces leave the warehouse for the shop. The user said that leaving the warehouse is enough (no tracking of shop sales), but the second prototype keeps `SHOP/Stock` as a separate internal location so it can be extended.
5. **Washing and waste at the factory.** Send dirty pieces for washing (they return as ready) or hand over damaged pieces (they leave). Only washing and waste go to the factory, nothing else.
6. **Lost.** Two sources only: automatic from a return shortfall, or from a stocktake shortage. Resolution by an admin: found (back to ready or dirty), compensated (with amount) or written off. Unresolved items older than 30 days should raise a proposal to write off.
7. **Stocktake.** Both full and partial (selected models). Blind count (system numbers hidden), Counted vs On Hand vs Difference, then Apply with a reason. If stock moved after the count started, warn and require an explicit acknowledgement. Suggest cycle counts by ABC class (A every 7 days, B every 30, C every 90). The opening balance is itself a stocktake.
8. **Size swap / correcting a wrong sort:** done by manual correction for now; a dedicated flow is deferred (user said "later").
9. **Production orders to the factory:** manual and static for now (e.g. "BR2 red 2XL × 50"). The user decides quantities and tracks them. Do not auto-generate yet. Keep the data model ready (an order document the receipt can link to).

### 3.4 Rules, standards, and alerts
- Negative stock is blocked by default (setting to allow). Backdating up to 72 hours for employees; the super admin is unrestricted. **Permissions are intentionally postponed**: during the test phase the system is open to everyone (record who did what, no role restrictions). Later roles: Super Admin, Admin, Team Leader (same as employee for now), Employee, Factory (external; sees what to manufacture and what it holds pending; no money or channel names). Every action should pass through one permission check that currently returns true.
- Cost method assumed: weighted average. Monthly period close assumed. Both are **unconfirmed**.
- Alerts are **statistics-based**, not fixed minimums: days of cover = ready ÷ daily pull, with a threshold that comes from lead time plus safety. Do not trust it with fewer than about 3 days of delivery history (show "early estimate"); fall back to the legacy min levels (5/15/30, from the old file) until then. Exclude days with zero stock from the average. Fast history can be loaded by importing older pickup sheets.
- Waste/loss rates to monitor: lost ÷ expected returns per channel, damaged ÷ received returns per channel, damaged ÷ average stock. Calibrate thresholds after ~30 days of silent logging, do not guess numbers.
- Notifications **inside the system only**, plus a **daily digest at 00:00 Cairo time**.
- Keep alerts few. The user complained about too many cards: show only what needs a decision and hide zero-count items.
- ABC analysis: A = first 80% of demand, B = up to 95%, C = the rest.
- **Kits (bundles):** bundles are not stock. Detect combinations ordered 3 or more times and compute how many can be assembled per size = the lowest component quantity, with the bottleneck component named. The user assembles bundles from loose pieces at picking time. Naming a bundle should be possible.
- **Cup (bra pad) component:** bags of 24 pieces; the user wants consumption tracked **on what is shipped, not on all stock** (15 orders needing cups consume cups for those orders only). So: a mapping rule (model/size → cup type + quantity per piece), applied at delivery validation, editable per delivery with a reason. Details are **not decided** (see open items).
- Customer personal data is never stored.
- Everything stored must keep history (audit log) and nothing is physically deleted when it has history (archive/deactivate instead).

### 3.5 Requirements list from the user's original brain dump, with status

| Requirement | Status |
|---|---|
| In/out by SKU, add stock easily (factory supply, returns) | prototyped |
| Alerts for surplus/shortage, waste share, thresholds | partly prototyped |
| Dirty → wash flow, waste types | prototyped |
| Lost items and settlement when shipping refunds | prototyped |
| Channel pickups with easy new channel | prototyped (Vendoor only) |
| Flyers/packaging and their waste | not started (consumable item type) |
| Shop stock and shop supply | prototyped (as destination) |
| Bundles capacity | prototyped (kits detection) |
| Average out per person (pieces/orders) | prototyped by user name only |
| Auto manufacturing order from weekly pull | deferred (manual first) |
| Cup budgets/caps | deferred |
| Add/edit/archive for every master record and users | partly |
| Admin/employee permissions, team lead = employee | deferred |
| Database history/audit | partly |
| Pull data from Vendoor account (money) | deferred; user asked not to use the Vendoor connector in this session |
| Physical stocktake for Vendoor | partly |
| Pending at factory | prototyped |
| Swap sizes | deferred |
| Signed paper flow (factory, shop) | prototyped (photo attached) |
| Periodic and annual stocktake, opening balance | prototyped |
| Cost, sales, profit per piece | not started |
| Team leader permissions | deferred |

---

## 4. What was prototyped, and what the user said

Two single-file prototypes live in `apps/` (browser storage only, no backend, no real photo storage). Open the `index.html` files in a browser; no server is needed.

- **Prototype 1 ("task-first", Arabic), `apps/task-first-edition/index.html`:**
  Desk with model cards (color × size heat matrix), exceptions, pickups strip; an "Operations" page that asks "what did you do?" with 9 task cards, each a 3-step screen (details, items, review and confirm with an effect preview); ledger, analytics (demand, ABC, kits, returns), reports, data tab.
- **Prototype 2 ("standard", Odoo/Oracle terminology, English with Arabic hints), `apps/standard-edition/index.html`, source in `src/standard-edition/`:**
  Navbar (Overview, Operations, Products, Reporting, Configuration), Overview kanban of Operation Types with To Process / Waiting / Late / Back Orders, transfer list and form with status bar Draft → Waiting → Ready → Done, Backorder dialog, Return button, RMA with inspection split, Internal Transfers, Cleaning (subcontract) send/receive, Scrap orders, Inventory Adjustments (Physical Inventory), Loss Resolution, Stock report (On Hand, Free to Use, Incoming, Outgoing, Forecasted), Locations, Moves History/Analysis, Replenishment (Min/Max/To Order), ABC, Demand and Kits.

Both pass automated browser tests (~25 and 43 checks). Both include an Excel import for pickup sheets that works fully in the browser.

**Standards research used for prototype 2:** Odoo Inventory docs (operation types with sequence prefix, reservation method, create backorder ask/always/never; physical inventory On Hand / Counted / Difference / Apply; locations including virtual; stock report columns; reordering rules Min, Max, Multiple, Trigger, To Order; Moves History/Analysis) and Oracle Inventory Management docs (material status, transaction types, Item Quantities: On-hand, Available to Reserve, Available to Transact, work area grouped Inventory/Counts/Shipments/Picks/Receipts, cycle counts, ABC). Not verified: the numeric tiles of Odoo's overview dashboard.

**My recommendation:** build on the prototype 2 structure (it matches any ERP and scales), but keep prototype 1's best ideas: an effect preview before confirming, plain-language errors, a pick list aggregated by variant, and a matrix view per product. Offer Arabic and English labels.

### The user's feedback, in their own spirit (design lessons)
- "The documents page is a disaster, confusing, I do not know what I am doing." Never expose system jargon or document codes to normal users; start from tasks; show what will happen to stock before confirming; put the confirm action where it is visible.
- "The arrow is not right." Avoid arrows between numbers inside Arabic text (bidi problems). Write "now 47, will be 57".
- "The difference must be below so I understand I received 100 but only entered 10." Show reconciliation next to the lines, in words.
- "I did not know whether I have 5 or 9 or 4 dirty." A number must never be ambiguous. Always say which quantity it is (On Hand vs Available vs total), and show the breakdown on hover.
- "Too many cards, show only what matters." Few alerts, hide zero-count items, avoid duplicating the same data in two places.
- "Name things with real names." Use the standard WMS/ERP terms; product names from their official catalogue in English; Arabic as a hint.
- Sort models alphabetically with natural numbering: A1…A12, BR1…BR4, D1…D3, PAN1…PAN5, S1, S2, SH1, SH2.
- Adding stock must be three separate fields (product, color, size) plus a quantity stepper, not a typed code.
- Permissions later; for testing, everything open.
- The user wants employees and the admin to try every function for real before permissions are added.

---

## 5. Open questions (ask the user, do not guess)

1. **PAN6 / bundles:** what pieces compose each bundle the user sells; what the "50" on PAN6 meant. (Current plan: bundles are recipes, not stock.)
2. **Cup:** which models consume it, quantity per piece, is the bag of 24 a count of singles or pairs, does it vary by size or color, does it return with returns, and where do cups go after arrival?
3. **Flyers and packaging:** should they be tracked as consumables with a minimum?
4. **Lead time and minimum order quantity** per model at the factory.
5. **Amazon, Noon and Jumia files** (pickup and return) and whether each return sheet has order code or only variant totals. Whether channels provide a downloadable status report (delivered, returned) so shipped-but-never-returned pieces can be detected earlier.
6. **How many days after a pickup do returns normally arrive** (sets the loss deadline; currently proposed 30 days).
7. **Does the shop need stock/sales tracking after supply?** (Current answer: exit is enough.)
8. **Roles, number of staff, mobile login method** (password or PIN), whether the factory has more than one site and may confirm documents.
9. **Costing:** unit cost per receipt, selling price, and the money import from Vendoor; budget caps for production.
10. **Barcodes:** not used today; keep a nullable field.
11. **Hosting and backups.**

---

## 6. Recommended build plan

**Stack suggestion:** Supabase (Postgres, Auth, Storage, Row Level Security) behind a React/TypeScript app (Lovable), installable on phone (PWA), RTL-capable.

**Data model (sketch)**
- `products` (model: code, name_en, name_ar, category, active), `variants` (sku unique internal reference, product_id, color_id, size_id, legacy_min), `colors`, `sizes` (ordered).
- `locations` (path, type: internal | vendor | customer | transit | inventory_loss, warehouse), `partners` (vendor/customer, per-channel config).
- `operation_types` (code, name, sequence prefix, default locations, requires_attachment, backorder policy).
- `transfers` (id, reference, operation_type, partner, state: draft | open | done | cancel, scheduled_date, source_document, backorder_of, return_of, created_by, validated_by, notes), `transfer_lines` (variant, demand, done, plus type-specific fields: disposition to stock/clean/scrap, reason, location, resolution, compensation), `attachments` (storage object).
- `stock_moves` (immutable; variant, quantity > 0, source, destination, transfer, date, user, note). Enforce no UPDATE/DELETE. A view `quants` (variant × location × quantity). Derived: on hand, free to use, incoming, outgoing, forecasted.
- `inventory_adjustments`/count lines (location, variant, on hand snapshot, counted), `loss_cases` (open, claimed, found, compensated, written off).
- `channel_templates` (column mapping, item-string parser), `variant_aliases` (channel, external code/color/size → variant), `import_batches` (idempotency: channel + order code + variant unique).
- `daily_pull` materialized stats, `alerts`, `audit_log` (append-only), `settings`, `users/roles` (permissions later).

**Critical logic to put in the database (one transaction):** validate a transfer → create moves, check non-negative stock, optional backorder creation, return creation, count conflict detection. Nightly reconciliation job; daily digest job at 00:00 Cairo.

**Build order (MVP for real testing)**
1. Master data import (use the CSV), locations, operation types, opening stock as the first adjustment dated 2026-10-29.
2. Receipts with attachment; Delivery Orders by sheet import (pick list, prepared qty, shortage, backorder); Customer Returns with sort and automatic loss; Internal Transfers (shop, cleaning); Scrap; Loss resolution.
3. Inventory adjustments (blind count, conflict warning, cycle-count suggestions).
4. Reports: Stock (On Hand, Free to Use, Incoming, Outgoing, Forecasted), product matrix, Locations, Moves History with group by, Moves Analysis.
5. Alerts and daily digest; demand analytics, ABC and kits; replenishment as a manual list.
6. Roles and permissions, audit surfaces, cost and finance, Vendoor integration, auto production suggestions.

**Acceptance scenarios (use the attached real data)**
1. Import the 2026-11-02 sheets: 92 orders, 1,070 pieces, 216 variants, no unmapped codes except `Women A5` (alias to A5).
2. Validate pickup 1 with some shortage: choose Create Backorder; stock drops by the prepared quantity only; a linked backorder appears.
3. Receive 100 pieces with a signed-paper photo but enter only 10: the difference is shown and flagged; validate; On Hand grows by 10.
4. Return a delivery with fewer pieces than expected: the shortfall becomes Inventory loss tied to the channel; resolve it later.
5. Move 4 pieces to cleaning; send to the factory; receive 3 back; 1 stays pending.
6. Start a blind count, change stock in another tab, then apply: the conflict warning must block until acknowledged.
7. The nightly check finds the sum of all locations = 0 per variant.
8. Importing the same sheet twice creates nothing new.
9. A product's hover shows "Available 31, total 35 (31 ready, 4 needs cleaning), requested 8, remaining 23".

---

## 7. Practical notes for you
- The user changes direction quickly; confirm each major decision briefly and keep the UI simple.
- Prefer English standard terms with Arabic hints, product names from the official catalogue.
- Keep every screen free of unexplained codes; show effects in words and numbers.
- The two prototypes are references for flows and wording, not code to reuse.
