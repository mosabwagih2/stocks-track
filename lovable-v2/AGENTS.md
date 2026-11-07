<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Fémini Stock lives in `src/femini/` (domain = pure business rules, data = repo, pages, components); route files in `src/routes/` only wrap pages. Why: keeps the ported system's rules isolated from routing.
- Stock is an immutable ledger: balances are always derived from moves via `domain/ledger.ts`; never write balances directly or edit old moves. Why: core business rule of the system.
- Data currently lives in the browser (`data/memory.ts`, localStorage + IndexedDB) behind the `Repo` interface; the app renders only after hydration. Why: per-device storage cannot render on the server.
- Initialize the browser repository lazily on first use, never during module import. Why: SSR has no browser storage.
- Backups include repository state and IndexedDB media, with validation and a pre-restore safety copy. Why: restoration must not silently lose uploaded files.
- Legacy backups are converted by a pure preview helper and restored as a full replacement, never appended; retain the original envelope for unsupported metadata. Why: prevents doubled opening balances and preserves original evidence.
- Financial valuation and day-close calculations live in pure domain reporting helpers; close records freeze summary/team counts. Why: testable ledger-based reports that distinguish live estimates from finalized snapshots.
- Cloud account login is separate from the local stock repository and does not grant operational roles. Why: account identity alone is not a shared-data authorization boundary.
- The signed-in account's name is recorded as who did each operation and as the scanning employee (`data/account.ts` → `actor()` in `data/repo.ts`); signed out, `DEFAULT_ACTOR` is used. It is a label, not a permission. Why: the team report and audit trail must show the real person.
- A pickup or a scan sheet can be recorded on a past day up to `BACKDATE_DAYS` (7) back, never in the future, never on a closed day, and a scan never before its orders' pickup day. Why: forgotten uploads must land on the day the work happened.
- Charts use Recharts via `src/femini/components/charts.tsx`, shared chart theme tokens and useId-scoped gradient definitions. Why: consistent light/dark styling without SVG ID collisions across multiple charts.
- Domain rule tests live in `src/femini/domain/domain.test.ts`; run them after changing business logic.
- Catalog form validation is isolated in a browser-safe helper with adjacent tests; repository checks remain authoritative. Why: consistent feedback without changing ledger rules.
- Stock operations (RCV, RTN, SHP, CLN, FSD, FRC, CNT, LOS) are computed by the pure `buildOp` in `src/femini/domain/ops.ts` and posted via `repo.postOp`. Why: one place for the moves and pre-confirm checks, mirroring the original main app.
- Heavy below-the-fold content (charts, long model lists) mounts progressively through `src/femini/components/Deferred.tsx` (`Deferred`, `Progressive`); keep the first screen immediate and defer the rest. Why: opening a page must not freeze the screen, so the first chunk paints and the remainder fills in when the browser is quiet.
- Holds (samples out) live in `domain/holds.ts`: out READY→EXT_HOLD, returns EXT_HOLD→state, write-offs EXT_HOLD→EXT_OFF; hold records keep an event log. Why: tracks pieces outside without adding a sixth stock state.
