# HANDOFF — field-quotes

Verified against the code on 2026-11-20 (commit `d2c9de6` + handoff commit).
Restore point before the move to Claude Desktop: tag `restore/2026-11-20-pre-desktop-handoff` (pushed to origin).

## What the app does
Hebrew/RTL web app (PWA) for "נתן ולדמן ובניו" field staff to create construction price quotes
(הצעות מחיר): client/project details, numbered items with notes and images, optional items,
price adjustments, VAT, signature. Exports to PDF (share/download) and Excel. Includes quote
status/payment tracking, client approvals, payment-update requests reviewed by admin,
admin user management, analytics (PDF/Excel), support requests.

## Stack
- Next.js **16.4.5** App Router (upgraded from 16.2.4 on 2026-11-20 for security advisories), React 19.2, TypeScript, Tailwind v4. Read `node_modules/next/dist/docs/` before Next-specific code (see AGENTS.md).
- **`proxy.ts`** (Next 16 rename of middleware) — refreshes Supabase session, redirects unauthenticated users to `/login`.
- Supabase (`@supabase/ssr` + `supabase-js`): Postgres + Auth + Storage.
- PDF: `@react-pdf/renderer` 4 (server-side `renderToBuffer`), Heebo TTF from `public/fonts/`.
- Excel: `exceljs` for the quote export; `xlsx` (SheetJS) only in `app/api/admin/analytics/excel` — write-only, so its npm advisories (parsing) don't apply.
- Hosting: Vercel (Hobby), Node 24.x.

## Key layout
```
app/(protected)/         dashboard, quotes/new, quotes/[id], quotes/[id]/edit, quotes/[id]/pdf-view,
                         settings/{company,profile}, support/new, admin/{users,requests,payment-requests,analytics}
app/api/quotes/[id]/     pdf, excel, approvals, approvals/[approvalId], payment-request
app/api/admin/           users/{create,update,reset-password}, payment-requests/[id]/review, analytics/{pdf,excel}
app/login, app/actions/auth.ts (logout), app/manifest.ts (PWA)
components/              QuoteForm (main editor, saves + bumps revision), QuoteItemCard, ReorderItemsModal,
                         ItemImages, ProjectImage, PriceAdjustmentsEditor, PdfShareButton, DashboardList, ...
lib/pdf/QuotePDF.tsx     quote PDF document + custom pagination (≈1500 lines)
lib/pdf/AnalyticsPDF.tsx admin analytics PDF
lib/calculations.ts      subtotal/VAT/total, getQuoteBaseTotal (items vs overall)
lib/priceAdjustments.ts  percentage / fixed adjustments, parse + apply
lib/revisionNumber.ts    formatRevisionNumber → VER00, VER01…
lib/share/shareQuotePdf.ts  PDF filename (natan-valdman-price-quote-{num}-ver{nn}.pdf), Web Share + download
lib/notesFormat.ts, lib/formatText.ts  rich notes / **bold** parsing
lib/supabase/{client,server,admin}.ts  browser / server (cookies) / service-role clients
types/database.ts        hand-maintained Supabase types (many `as any` casts for newer columns)
supabase/migrations/     001…019 SQL files (source of truth for schema)
```

## Authentication
- Supabase email/password. Users log in with a **username**; `lib/auth/username.ts` maps `NAME` → `name@field-quotes.local` (real emails also accepted).
- Users are created by admins only (`/api/admin/users/create`, service role). No self sign-up.
- `profiles.role`: `user | admin | manager | viewer`; `profiles.is_active=false` blocks access in `app/(protected)/layout.tsx`.
- Data access is enforced by RLS on all public tables.

## Supabase
- Project **field-quotes**, ref `lrfcevnqtqhiqrksoqsi`, region ap-southeast-2. (Other project in the org, `SafeDoc`, is unrelated — never touch.)
- Tables: profiles, company_settings, quotes, quote_items, item_images, quote_number_seq, quote_number_daily_seq, support_requests, quote_approvals, payment_update_requests.
- Private storage buckets: `quote-images` (item + project images), `company-assets` (logo), `user-signatures`, `quote-approvals`. Access via signed URLs (1h).
- **Migrations**: files 001–017 were applied manually (SQL editor); Supabase's migration history table is **empty**. Live schema was verified to match through 017. 018 (revoke anon/authenticated EXECUTE on internal SECURITY DEFINER functions; `get_my_role` stays for authenticated because RLS uses it) was applied via MCP and is the first entry in the migration history. New migrations: add `supabase/migrations/0NN_name.sql` (idempotent, `IF NOT EXISTS`, end with `NOTIFY pgrst, 'reload schema';`) **and** apply it via the Supabase MCP `apply_migration`.
- No Supabase CLI installed locally; use the Supabase MCP connector (scoped to this project ref).

## Env vars (names only — values in `.env.local` / Vercel, never commit)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `NEXT_PUBLIC_APP_URL`. `vercel link` also adds `VERCEL_OIDC_TOKEN` to `.env.local`.

## Vercel / Git / deploy flow
- GitHub `itayvm-debug/field-quotes`, single branch **`master`**.
- Vercel project `field-quotes` (team `itayvm-debugs-projects`), Git-integrated, production branch `master`. **Push to master = production deploy.** Production URL: https://field-quotes.vercel.app
- Local folder is linked (`.vercel/project.json`, gitignored). Vercel CLI is logged in. `gh` CLI is not logged in (not needed; `git push` uses Windows credential manager).
- Check a deploy: `vercel ls field-quotes`, `vercel inspect <url>`, `vercel logs <url>`.

## Commands
```
npm run dev          # local dev (localhost:3000)
npx tsc --noEmit     # typecheck
npm run lint         # eslint
npm run build        # tests + production build
npm test             # Vitest: tests/*.test.ts (calculations, adjustments, dates, filenames, PDF rendering)
```
Tests (Vitest 4, `vitest.config.mts`, alias `@` = repo root): unit tests for `lib/calculations`, `lib/priceAdjustments`, `lib/dates`, revision/filename helpers, and `tests/quotePdf.test.ts` which renders real PDFs (short, overall mode, 26-item multi-page, back-to-back renders = regression for the font-cache crash). `npm run build` = `vitest run && next build`, so failing tests block the Vercel deploy. Not covered: UI components and DB/RLS (verify those in the browser / with SQL dry-runs).

Baseline 2026-11-20: `tsc` ✓, `build` ✓, `lint` ✗ with 26 **pre-existing** errors (mostly `no-explicit-any`) + 19 warnings — judge lint only on files you touch.

Claude permissions: `.claude/settings.json` (project allowlist for routine npm/git/vercel/Supabase-read actions; deny list for force push, reset --hard, clean, branch deletion, rm -rf, Vercel/Supabase project removal).

## PDF generation (lib/pdf/QuotePDF.tsx) — handle with care
- Rendered in `app/api/quotes/[id]/pdf/route.ts` with `renderToBuffer`; `next.config.ts` lists react-pdf packages in `serverExternalPackages` — keep it.
- **Custom pagination**: items are split across explicit `<Page>`s using `estimateItemHeight` / `estimateClosingBlockHeight` / `splitItemsForPages` and the `LAYOUT` constants + page budgets (`PAGE_USABLE=801`, overheads, safety margins). Style changes that affect item height must update `LAYOUT` so estimates stay in sync. Do not refactor this wholesale.
- Each ItemBlock is `wrap={false}` (kept whole); item images flow outside it.
- Non-last item pages show the hint **"המשך סעיפים בעמוד הבא"** (`CONTINUATION_HINT_HEIGHT` is reserved in the budget).
- **BiDi**: `stripBidiControlChars` removes LRM/RLM/LRE–RLO/LRI–PDI before rendering; react-pdf draws them as visible garbage. `fixRtlText` strips first, then appends one RLM per line; all user text in the PDF goes through one of them.
- **Font reset per render**: the route calls `resetPdfFonts()` before `renderToBuffer`. fontkit caches glyphs by id across renders in a warm instance; stale glyphs without `codePoints` crash react-pdf's BiDi reordering (`Cannot read properties of undefined (reading 'id')`) for some quotes. Don't remove it. A "warm-up" that pre-creates all glyphs was tried and made it worse (reverted).
- Local repro of PDF bugs: render `QuotePDF` with `npx tsx` from a temp script in the repo root (path aliases resolve there). On Windows the local logo path fails to load ("fetch failed") — harmless, Linux/Vercel only. Render several documents in one process to catch cross-render state bugs.
- Filename built only by `buildQuotePdfFilename` (route Content-Disposition, share, download).

## Excel export
`app/api/quotes/[id]/excel/route.ts` (exceljs, includes company logo + item images downloaded from storage), plus `app/api/admin/analytics/excel/route.ts`.

## Business features (where to look)
- Quote numbers: date-based daily sequence (migration 003). Revisions: `quotes.revision_number` (int, default 0), bumped on each save in `QuoteForm`, shown as `VER00…`.
- `pricing_mode` `items` (sum of items) / `overall` (`manual_total`); `quote_pricing_type` (015) is a separate label field.
- `price_adjustments` jsonb array — percentage or fixed amount (`lib/priceAdjustments.ts`).
- `quote_items.is_optional` — optional items excluded from totals.
- Item order = `quote_items.item_number`; reordering via `ReorderItemsModal`.
- Project image: `quotes.project_image_path/_caption/_fit`.
- Duplicate quote: "שכפל הצעה" on the quote page → `POST /api/quotes/[id]/duplicate` → new draft (new number, today, same validity length, VER00, current user as owner) with header + items; images/status/payment are not copied. Opens the copy in edit mode.
- Saving in `QuoteForm` is serialized (`saveChainRef`) and ids are tracked in refs (`savedIdRef`, `insertedItemIdsRef`) so back-to-back auto-saves never insert duplicates — keep that when touching save logic.
- Sharing: Web Share API with the generated PDF file (fallback download) — `PdfShareButton`, `lib/share/shareQuotePdf.ts`.

## Known pitfalls
- BiDi control characters in PDF (see above). Hebrew + numbers/phones mix: test in an actual PDF.
- PDF height estimates drift when styles change → items overflow/clip. Re-render a long quote after any PDF style change.
- `types/database.ts` lags the schema; newer columns use `(x as any)`. Keep that pattern or update types consistently.
- Dates: use `lib/dates.ts` (`todayIso`, `addDaysIso`, `daysBetweenIso`) — Israel-time "today", UTC day arithmetic. Never `toISOString().split('T')[0]` for quote dates (UTC off-by-one after midnight, DST shifts).
- **Error log**: `app_errors` table (migration 019, admin-read RLS, service-role writes) shown on `/admin/errors` (menu "שגיאות מערכת", badge = last 24h). Sources: `instrumentation.ts` `onRequestError` (all unhandled server errors), `logServerError()` (`lib/errorLog.ts`) in routes that catch their own errors (PDF, duplicate), and `reportClientError()` → `/api/client-error` for browser failures (quote save steps, PDF share, duplicate, `app/(protected)/error.tsx` boundary). 90-day retention, pruned by the logger. Check `/admin/errors` (or query `app_errors`) first when debugging a report.
- Next 16.4 `error.tsx` props are `{ error: unknown, retry }` (not `reset`).
- Vercel Hobby keeps runtime logs only ~30 min (`vercel logs --project field-quotes --query "..."`); reproduce quickly after an error.
- Windows local builds may hit ENOMEM/OOM; distinguish from real code errors (retry with `NODE_OPTIONS=--max-old-space-size=4096`).
- Repo lives under OneDrive with a Hebrew path — quote paths in shell commands.
- Commit history has duplicate messages (same change committed more than once) — harmless.

## Current state (2026-11-20)
- `master` clean and in sync with origin; last feature commit `d2c9de6` (revisions, continuation hint, bidi sanitization), deployed to production 2026-11-03.
- Work environment moved from VS Code Claude Code to Claude Desktop Code tab; runbook in `CLAUDE.md`, permissions in `.claude/settings.json`.
