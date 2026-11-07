# Security review — 2026-11-07

Scope: application code, database schema/RLS, storage, auth flows, configuration. This is an engineering self-review with automated
verification — **not** an independent penetration test. Do not describe EDGELOG as "certified secure".

## Verified (with evidence)

| Area | Control | Verification |
|---|---|---|
| User isolation (DB) | RLS enabled **and forced** on all 15 user tables; select/insert/update/delete policies `user_id = auth.uid()`; composite `(id,user_id)` FKs prevent cross-user references | `pnpm test:db` (SQL suite) · `pnpm test:integration` (real REST API with two users + anon) · `supabase/verify_production.sql` (79 checks) |
| User isolation (API) | Another user cannot read, update, delete, forge `user_id`, attach rows to a foreign account, or update a foreign trade through `save_trade` | `tests/integration/isolation.test.ts` — 5/5 pass against local Supabase |
| Storage | Private bucket; per-user folder policies; 10 MB limit; PNG/JPEG/WebP/GIF only (no SVG/HTML); public URL access denied; short-lived (1 h) signed URLs | Integration test (foreign download/list/sign/upload/delete denied; HTML upload rejected) · E2E upload/view/delete |
| Service-role key | Not used anywhere in application code; not in env files; only `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `SITE_URL` are read | `grep` scan of `src/`; `.env.example` contains placeholders only |
| Secrets in git | `.env*` ignored except `.env.example`; no keys in tracked files | Pre-commit scan of `git add --dry-run` output |
| Authentication | Supabase Auth (bcrypt, rate-limited); session refresh in middleware; pages redirect to `/login`; `/api/*` returns 401 | E2E `unauthenticated users…` |
| Auth emails | Confirmation + password reset use the canonical `NEXT_PUBLIC_SITE_URL`; token-hash and PKCE flows; `next` param restricted to same-origin paths (open-redirect safe) | Unit tests (`env.test.ts`), E2E reset flow, bogus-link test |
| Account enumeration | Sign-in and password-reset responses don't reveal whether an email exists | E2E `forgot password page never reveals…` |
| Input validation | Every server action validates with Zod (decimal strings, enums, lengths, UUIDs); DB CHECK constraints as second layer | Code review; unit tests of schemas via engine/import tests |
| Error messages | DB/driver internals (constraint/column names) are replaced by a generic message and logged server-side; branded error/404 pages | `result.test.ts` |
| Rate limiting | Per-user limits on CSV import (20/h), data export (10/h), full recalculation (30/h) via `check_rate_limit` (private schema, not exposed); Supabase Auth limits for sign-in/up/reset | SQL test (3rd call refused); integration test (anon cannot call it) |
| Upload size | CSV ≤ 4 MB (UI) / 4.4 MB (server schema) / 4.5 MB (server-action body); 20 000 rows max | Code |
| HTTP headers | CSP (`default-src 'self'`, connect/img limited to the project's Supabase origin, `frame-ancestors 'none'`, `object-src 'none'`), HSTS + upgrade-insecure-requests on HTTPS, nosniff, DENY framing, strict referrer, permissions policy, COOP; `X-Powered-By` removed | `curl -I` checks, config evaluated with HTTPS env |
| CSRF | Server actions are POST-only with Next.js origin checks; auth cookies `SameSite=Lax`, `Secure` on HTTPS | Framework behaviour + config |
| Financial privacy | Data only reachable through RLS; export endpoint `no-store`; no third-party analytics or trackers | Code review |
| Dependencies | `pnpm audit --prod`: 0 known vulnerabilities (postcss pinned ≥ 8.5.23 via override) | `pnpm audit` |

## Remaining risks / recommendations (prioritised)

1. **No independent penetration test** — commission one before taking paying customers.
2. **CSP allows `'unsafe-inline'` scripts** (required by Next.js without nonces). Move to a nonce-based CSP in middleware.
3. **Direct REST access to own data:** a signed-in user can call the Supabase REST API with their own token and write arbitrary values into
   *their own* rows (e.g. stored `net_pnl`), bypassing app validation. It cannot affect other users. Mitigations: revoke direct
   insert/update on computed columns and route writes through RPCs, or recalculate on read. Medium priority for data integrity.
4. **No per-user storage/row quotas.** A user could upload many 10 MB screenshots or many trades. Add quotas per plan.
5. **No MFA** for users. Supabase supports TOTP — add it to Settings.
6. **No self-service account deletion** (GDPR right to erasure). Data export exists. Add deletion + publish Privacy Policy / Terms / DPA
   (EU users ⇒ GDPR applies; trading data is personal financial data).
7. **Monitoring/alerting** not configured (Sentry/Log drains, Supabase alerts). Unknown production errors would go unnoticed.
8. **Backups:** Supabase Free has no point-in-time recovery. Use Pro (daily backups) or PITR before launch.
9. **Image content** is checked by declared MIME type, not magic bytes; files are served from the Supabase storage domain, not the app
   origin, which limits impact.
10. **Signed screenshot URLs** stay valid for 1 hour if copied/shared.
11. **Built-in Supabase email sender** is not for production — configure custom SMTP with SPF/DKIM/DMARC.
12. Rate limits don't cover every action (e.g. saving trades); rely on Supabase/Vercel platform limits for the rest.

## Reporting
Set up a security contact (e.g. `security@<your-domain>`) and add `/.well-known/security.txt` once the domain exists.
