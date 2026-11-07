# Roadmap

- [x] Import original v3 backups with preview, balance reconciliation and duplicate protection; unsupported legacy metadata retained in original envelope.
- [x] Financial inventory, scrap and lost valuation with missing-data disclosure; verified concrete Excel values.
- [x] Weekly backup reminder with boundary tests.
- [x] Detailed frozen day-close report with PDF printing/Excel export and browser verification.

- [x] Modernize all shared charts, tooltips, chart legends and heatmap; verify light/dark and mobile/desktop without changing calculations.

- [x] Audit the original Brand 2 main app against all current pages and document missing workflows.
- [x] Define a phased restoration plan preserving original rules and the user's intentional removals.
- [x] Restore local backup/restore, original-file retention, unified archives, event/SKU ledger, day navigation, day closing, order-return filters and model search.
- [x] Add delivery-note PDF/PNG downloads and verify a shop operation reads back through the ledger.
- [x] Restore model cost/price storage and verify persistence without ledger changes.
- [ ] Complete original replenishment calculations; outside the current request.
- [ ] Complete shared stock storage, authenticated roles and audit trail; account login is prepared but is not an inventory authorization boundary.

- [x] Make mobile model edit controls clearly labeled and touch-friendly.
- [x] Refine new/edit model panels with validation, feedback and fixed save/cancel actions.
- [x] Clarify active balance selection and reset; test model create/edit and mobile layouts.

- [x] Move catalog editing to individual model cards and verify the selected model opens immediately.
- [x] Keep the add action beside tabs and arrange stock states/model filters without orphaned rows; verify desktop/mobile.

- [x] Remove the production (التصنيع) section from the Analytics page: nav, stats, decision card, plan tables, copy-for-factory.
- [x] Remove production rows from the Excel/PDF exports (buildSheets + report filters).
- [x] Re-point links that pointed at the removed section (risk alerts, Today action card, page metadata).
- [x] Re-order the remaining analytics sections and verify in the browser.

- [x] Drop the description line under each analytics section tab so the bar stays compact.
- [x] Open pages without freezing the screen: first screen paints immediately, charts and long model lists mount progressively (Deferred/Progressive); measured stock 524ms -> 226ms and analytics 362ms -> 170ms to first paint.
