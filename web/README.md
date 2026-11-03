# Fémini Stock (React · TypeScript · Tailwind · Supabase)

The production version of the warehouse system. The UI is Arabic/RTL, installable on a phone, light and dark.

| Layer | What |
|---|---|
| UI | React 19, TypeScript (strict), Tailwind CSS 4, React Router 7, TanStack Query 5, Vite 7. Routes are lazy-loaded, the Excel library loads only when a file is chosen. |
| Data | Supabase (Postgres, Storage). Reads are plain selects; **every write is a database function** (`supabase/migrations/0001_init.sql`), so the ledger cannot be edited from the browser. |
| Demo mode | With no Supabase keys the app runs on the real demo data inside the browser (same interface, same rules). Good for trying it and for tests. |

## Run it

```bash
cd web
npm install
npm run dev            # http://localhost:5173  (demo mode)
npm run build          # type-check + production build
npm test               # domain logic (14 unit tests, incl. the real QRbot file)
```

### Connect Supabase
1. Create a project at supabase.com.
2. Apply the SQL, in order: `supabase/migrations/0001_init.sql`, `0002_storage.sql`, then `supabase/seed.sql` (SQL editor, or `supabase db push` with the CLI).
3. Copy `web/.env.example` to `web/.env.local` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. `npm run dev`. Settings shows "متصل بـ Supabase".

Deploy: any static host (Vercel, Netlify, Cloudflare Pages) with the two env vars. Lovable can import this repository too: it is a standard Vite + React + TypeScript + Tailwind + Supabase project.

## How the rules are enforced
- `moves` is an append-only ledger. Browser roles have **no INSERT/UPDATE/DELETE** on any table; they can only SELECT and call:
  `import_pickup`, `ship_orders`, `reverse_shipment`, `receive_stock`, `move_state`, `cancel_order`, `restore_order`, `supply_move`, `undo_supply_move`.
- Balances are a view (`stock_balances`), never typed. `ledger_check` must always be empty.
- A pickup is demand; it never moves stock. `ship_orders` (the scanner file) deducts stock per order and is **never blocked by stock** (negative balances are flagged instead).
- Receipts need the signed-paper photo and a declared total equal to the lines. Dates are limited to the last 3 days.
- Photos go to the private `documents` bucket and are shown through signed URLs.

## Tests
- `supabase/tests/run.sh`: starts a throw-away Postgres, applies the migrations and seed, ships the real QRbot file (28 orders, 456 pieces, READY 43,863 → 43,407) and asserts the rules above, including that browser roles cannot write directly.
- `web/src/domain/*.test.ts`: the same logic in TypeScript (stuck-order allocation, scan matching, pickup parsing, supplies, Cairo day).
- `web/e2e/smoke.mjs`: browser run of the main flows against `npm run build && npm run preview` (needs Playwright). It fakes the clock to 2026-11-02, the date of the demo data.

## What is done and what is next
Done: Today (tiles with drill-down, action queue), Orders (filters, search, pick list, scan upload, pickup import, manual shipping, cancel with waybill photo, restore), Stock (all models / one model / all SKUs, SKU sheet with state moves), Operations (receipt with photo, status change, documents), Supplies (receive / issue / count with preview and undo, automatic consumption), Insights (overview, manufacturing plan), Ledger, Settings.

Next (the old single-file prototype in `apps/edition-3` already has these screens, to port): catalog editing (add/remove models and SKUs), supplies add/edit/archive, returns and stocktake, shop transfers, Files page, more analytics tabs, roles (two levels) with Supabase Auth, installable PWA manifest and offline queue.
