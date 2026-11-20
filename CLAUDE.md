@AGENTS.md

# field-quotes — runbook

Project facts (architecture, Supabase ref, Vercel, PDF internals, pitfalls): see `HANDOFF.md`. Keep it current when architecture changes.

## Working style
- The user writes in Hebrew. Code/commits in English; **report to the user in Hebrew**.
- Every request is end-to-end by default: understand → read relevant code → diagnose → change → verify → commit → push → confirm deploy → verify live. Don't hand back code or commands the user must run when you can run them.
- Read the existing implementation before changing it. Prefer targeted changes over unrequested refactors. Keep backward compatibility; never break an existing feature to add a new one.
- Resolve ordinary technical questions yourself. Stop and ask only for: material business-behavior change, choice between significant product alternatives, irreversible deletion, significant production-data change, new cost/account/subscription, material auth/security change, or an authorization only the user can give.

## Verification (after every change)
- `npm test` (Vitest, `tests/`), `npx tsc --noEmit`, `npm run lint` (only new errors matter), `npm run build`. `build` runs the tests first, so a failing test also fails the Vercel deploy.
- Bug fixed or logic added in `lib/` (calculations, adjustments, dates, PDF) → add/extend a test in `tests/` that would have caught it.
- PDF changes: `tests/quotePdf.test.ts` must pass, and also render a real PDF (long quote with notes/images, Hebrew + numbers) and inspect it visually — pagination, continuation hint, no visible BiDi glyphs.
- Production problem reported? Check `/admin/errors` (table `app_errors`) first.
- ENOMEM/OOM on Windows build is an environment issue — retry with `NODE_OPTIONS=--max-old-space-size=4096` before calling code broken.
- UI changes: check in the browser (local dev or production) when possible; check console for errors.

## Git / deploy
- Branch `master` only; push to `origin master` triggers Vercel production deploy (project `field-quotes`, https://field-quotes.vercel.app).
- After push: `vercel ls field-quotes` → wait for Ready on the new commit → `vercel inspect`/`vercel logs` if needed → verify the live site.
- Never: force push, `reset --hard`, destructive `clean`, rebase of pushed history, branch deletion. Don't commit `.env*`, `.vercel`, `.next`, build artifacts or temp files.

## Database (Supabase project ref `lrfcevnqtqhiqrksoqsi` only)
- Use the Supabase MCP. Never touch the other project (SafeDoc). Never create projects.
- Schema change = new file `supabase/migrations/0NN_name.sql` (idempotent, ends with `NOTIFY pgrst, 'reload schema';`) **and** apply it with `apply_migration`. Additive changes are routine; DROP / significant DELETE / irreversible data changes need user approval first.
- Run `get_advisors` (security) after DDL.

## PDF rules (lib/pdf/QuotePDF.tsx)
- Don't refactor the custom pagination. Keep `LAYOUT` constants in sync with styles. ItemBlock stays `wrap={false}`. Keep the "המשך סעיפים בעמוד הבא" hint.
- All user text rendered in PDF passes through `stripBidiControlChars` (or `fixRtlText`, which calls it).
- Call `resetPdfFonts()` right before every `renderToBuffer` (fontkit cache bug — see HANDOFF).

## Secrets
- Never print, paste, commit or copy secrets/credentials into docs. Show env files only with values redacted. Auth to services via their official OAuth/login only; never ask the user for tokens in chat.
- No new paid services/resources without approval.

## Final report (Hebrew, short)
מה תוקן · בדיקות · commit · push · deployment · verification · חריגים (אם יש).
