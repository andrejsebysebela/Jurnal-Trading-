# Deploying EDGELOG (GitHub → Vercel + Supabase Cloud + custom domain)

This guide uses **`edgelog.sk` purely as an example domain** — replace it with the domain you actually own.
Recommended layout: the app at **`https://app.edgelog.sk`** (or the apex `https://edgelog.sk`).

Nothing in this guide requires the Supabase service-role key in the app. **Never** add it to Vercel.

| Step | Costs money? | Reversible? |
|---|---|---|
| GitHub repo (private) | No | Yes |
| Supabase project (Free plan) | No (Free plan pauses after 1 week of inactivity; Pro is paid) | Delete project |
| Vercel project (Hobby) | No (Hobby is for non-commercial use — a commercial SaaS needs **Pro**) | Yes |
| Domain | **Yes** (registrar) | — |
| Custom SMTP for auth emails | Provider-dependent | Yes |

---

## 0. Push the code to GitHub

The repository root is the `edgelog/` folder (it contains `package.json`).

1. On GitHub create an **empty private** repository, e.g. `edgelog` (no README / .gitignore / license — the repo already has them).
2. In the project folder:

```bash
git remote add origin git@github.com:<your-user>/edgelog.git
```

```bash
git push -u origin main
```

(HTTPS alternative: `https://github.com/<your-user>/edgelog.git` with a personal access token.)
3. Confirm on GitHub that `src/`, `supabase/migrations/`, `docs/`, `tests/` are present and that **no `.env.local`** was pushed.

---

## 1. Create the production Supabase project

1. https://supabase.com/dashboard → **New project**.
   - Name `edgelog-prod`; strong database password (store it in a password manager); **region close to your users**
     (e.g. *Central EU (Frankfurt)* for Slovakia/EU). Remember the region — Vercel functions should run in the same region (§4.4).
2. Create a **separate** project for staging/preview (`edgelog-staging`) if you want preview deployments to have their own data.
   Never point local development or tests at production.

### 1.1 Apply the migrations (non-destructive, additive)
The three files in `supabase/migrations/` create everything (tables, indexes, RLS, storage bucket + policies, functions):

| File | Contents |
|---|---|
| `20261107000001_init.sql` | Schema, RLS + policies, `save_trade` RPC, signup trigger |
| `20261107000002_storage.sql` | Private `screenshots` bucket + storage policies |
| `20261107000003_hardening.sql` | Rate-limit function (private schema), timezone-aware signup trigger |

Option A — Supabase CLI (recommended):

```bash
pnpm exec supabase login
```

```bash
pnpm exec supabase link --project-ref <project-ref>
```

```bash
pnpm exec supabase db push --dry-run
```

Review the list (it must only show the three migrations above on a fresh project), then:

```bash
pnpm exec supabase db push
```

Option B — SQL editor: paste and run the three files **in order**.

> ⚠️ Never run `supabase db reset` against a linked production project — it wipes data. Future schema changes must be new
> migration files, reviewed with `db push --dry-run` first.

### 1.2 Verify the database (read-only)
Open **SQL editor**, paste `supabase/verify_production.sql`, run it. Every row must show `ok = true`
(tables, RLS enabled + forced, 4 policies per table, private bucket, size/MIME limits, storage policies, function privileges, indexes,
migrations applied). It changes nothing.

### 1.3 Authentication settings (Dashboard → Authentication)
- **Sign In / Providers → Email:** enabled; **Confirm email: ON**; minimum password length ≥ 8 (app enforces 8).
  Optional: leaked-password protection (Pro).
- **URL Configuration:**
  - **Site URL:** `https://app.edgelog.sk` (until the domain exists: your Vercel production URL, e.g. `https://edgelog.vercel.app`)
  - **Redirect URLs** (allow-list — exact origins, no wildcard on production):
    - `https://app.edgelog.sk/auth/callback`
    - `https://app.edgelog.sk/auth/confirm`
    - `https://edgelog.vercel.app/auth/callback` (optional, while testing before the domain)
    - Staging project only: `https://*-<your-vercel-team>.vercel.app/**` for preview deployments
- **Emails → SMTP Settings:** configure a custom SMTP provider (Resend, Postmark, SES, …). The built-in sender is
  rate-limited to a few emails per hour and is not meant for production.
- **Email templates** (recommended — works even if the user opens the link in another browser/device):
  - *Confirm signup* link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`
  - *Reset password* link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
  - (The default `{{ .ConfirmationURL }}` templates also work via `/auth/callback`, but only in the same browser.)
- **Rate limits:** keep the defaults or tighten (sign-ups/sign-ins per IP).

### 1.4 Storage
The migration creates bucket **`screenshots`**: private, 10 MB limit, PNG/JPEG/WebP/GIF only; objects are only readable/writable by
their owner (`<user_id>/...` path policies). Do **not** make it public. Verified by `verify_production.sql`.

### 1.5 Keys you will need
Dashboard → **Project Settings → API**:
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` / publishable key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` / secret key → **do not copy anywhere for the app.**

---

## 2. Environment variables

| Variable | Dev (`.env.local`) | Preview (Vercel) | Production (Vercel) | Secret? |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` | staging project URL | `https://<prod-ref>.supabase.co` | No (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local anon key | staging anon key | prod anon key | No (public, protected by RLS) |
| `NEXT_PUBLIC_SITE_URL` | `http://127.0.0.1:3000` | *leave unset* (falls back to the preview URL) | `https://app.edgelog.sk` | No |

Notes:
- `NEXT_PUBLIC_*` values are inlined at **build time** — after changing them in Vercel, **redeploy**.
- `NEXT_PUBLIC_SITE_URL` is the canonical URL used in confirmation/reset emails and the CSP/HSTS decision. Production builds outside
  Vercel refuse to start auth flows without it (no silent localhost links).
- Test-only variables (never set in Vercel): `E2E_SUPABASE_SERVICE_KEY`, `SUPABASE_TEST_ANON_KEY`, `E2E_BASE_URL`.

---

## 3. Connect GitHub to Vercel

1. https://vercel.com → **Add New… → Project → Import Git Repository** → authorize the GitHub app for the `edgelog` repo only.
2. **Root Directory:** if the GitHub repo root *is* the `edgelog/` folder (as in §0), leave it as `./`.
   If you instead push a parent folder that contains `edgelog/`, click **Edit** next to Root Directory and choose `edgelog`.
3. Framework preset: **Next.js** (auto-detected). Build command `pnpm build` (default `next build` via pnpm), output: default
   (`.next`, managed by Vercel — do not set an output directory). Install command: default (`pnpm install`; the repo pins
   `packageManager: pnpm@10.28.0`, Node ≥ 20.9).
4. **Environment Variables:** add the three variables from §2 for **Production** (and the staging values for **Preview**).
5. **Deploy.** The first deployment gets a `*.vercel.app` URL.

### 3.1 Recommended Vercel settings
- **Settings → Functions → Region:** same region as Supabase (e.g. `fra1` for Frankfurt). This matters: every page makes several DB calls.
- **Settings → Deployment Protection:** keep Vercel Authentication on for **preview** deployments.
- **Settings → Git:** production branch `main`.
- Function duration: pages with imports/recalculation declare `maxDuration = 60`; the default plan limits apply.
- Request body limit is 4.5 MB on Vercel → CSV imports are limited to 4 MB per file in the UI.

---

## 4. Deploy and smoke-test (before the custom domain)

1. Set Supabase **Site URL** temporarily to the Vercel production URL and add `https://<project>.vercel.app/auth/callback` and `/auth/confirm`
   to Redirect URLs; set `NEXT_PUBLIC_SITE_URL=https://<project>.vercel.app`; redeploy.
2. Test (see §7 checklist): sign-up → confirmation email → link lands on `/dashboard`; sign-out/in; forgot password → email → `/reset-password`;
   create account, add trade, upload a screenshot, import `public/edgelog-template-executions.csv`.

---

## 5. Custom domain

> Buying the domain and editing DNS are your actions — nothing here does it automatically.

1. Buy the domain at any registrar (for `.sk` domains: a SK-NIC accredited registrar).
2. Vercel → Project → **Settings → Domains → Add** → enter `app.edgelog.sk` (and optionally `edgelog.sk`).
3. Vercel shows the exact DNS records to create. Typical values (always use what Vercel displays — they can change):

| Host | Type | Value | Purpose |
|---|---|---|---|
| `app` | `CNAME` | `cname.vercel-dns.com` (or the project-specific value Vercel shows) | App subdomain |
| `@` (apex) | `A` | `76.76.21.21` (or the value Vercel shows) | Apex domain |
| `www` | `CNAME` | `cname.vercel-dns.com` | Optional, redirect to apex/app |

   Alternative: change the domain's nameservers to Vercel (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`) and let Vercel manage DNS.
   If you use email on the domain, keep your MX/SPF/DKIM records when switching nameservers.
4. If you add both apex and `www`, configure one to **redirect** to the canonical host in Vercel's Domains UI.
5. Wait for propagation (minutes to 48 h). Check:

```bash
dig +short app.edgelog.sk CNAME
```

6. Update configuration to the canonical domain:
   - Vercel env `NEXT_PUBLIC_SITE_URL=https://app.edgelog.sk` → **redeploy**.
   - Supabase **Site URL** = `https://app.edgelog.sk`; **Redirect URLs** add `https://app.edgelog.sk/auth/callback` and `https://app.edgelog.sk/auth/confirm`.
   - Remove the temporary `*.vercel.app` redirect URLs once the domain works.
   - Optional: Supabase **custom auth domain** (paid add-on) so emails link through `auth.edgelog.sk`.
7. Email sending domain: in your SMTP provider verify the domain (SPF, DKIM, DMARC TXT records it gives you) so auth emails are not spam-filtered.

---

## 6. HTTPS
- Vercel issues and renews Let's Encrypt certificates automatically once DNS points to Vercel; the Domains page shows **Valid Configuration**.
- Verify:

```bash
curl -sI https://app.edgelog.sk/login
```

  Expect `HTTP/2 200`, `strict-transport-security`, `content-security-policy` containing your Supabase URL, `x-frame-options: DENY`.
- `http://` requests are redirected to `https://` by Vercel. The app sets HSTS (2 years, includeSubDomains, preload).
  **Only submit to the HSTS preload list once every subdomain of the domain serves HTTPS** — preload is hard to undo.
- Auth cookies are `Secure` + `SameSite=Lax` on HTTPS deployments.

---

## 7. Production test checklist
| Test | Expected |
|---|---|
| Sign up with a real inbox | Email arrives (custom SMTP), link → `/dashboard` signed in; profile timezone = browser timezone |
| Sign in with wrong password | "Incorrect email or password." (no hint whether the email exists) |
| Forgot password with unknown email | Same success message as a known email |
| Reset password link | Opens `/reset-password`, new password works, old one doesn't |
| Expired/edited link | `/login?error=link` message |
| Open `/dashboard` signed out | Redirect to `/login?next=%2Fdashboard` |
| `curl https://app.edgelog.sk/api/export` | `401` |
| Upload a screenshot, then open its URL in a private window after 1 h | Signed URL expired → denied |
| Second test user | Sees none of the first user's data |
| Run `supabase/verify_production.sql` | All `ok = true` |

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Build fails `ERR_PNPM_…` / lockfile | Vercel must use pnpm 10: `packageManager` is pinned; don't commit `package-lock.json`. |
| 500 on every page, logs "Missing required environment variable" | Add `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the right environment and **redeploy**. |
| Auth emails link to `localhost` or the wrong host | Supabase **Site URL** / templates and `NEXT_PUBLIC_SITE_URL` must be the production URL; redeploy after changing env. |
| "redirect URL not allowed" / link goes to Site URL instead | Add the exact `/auth/callback` and `/auth/confirm` URLs to Supabase Redirect URLs. |
| `/login?error=link` right after clicking an email | Link expired/used, or opened in another browser with the default template → use the token-hash templates (§1.3). |
| Signed in but immediately signed out | Mixed hosts (apex vs `app.`/`www`) — pick one canonical host and redirect the others. |
| Screenshot upload fails with CSP error in console | `NEXT_PUBLIC_SUPABASE_URL` at build time differs from runtime → redeploy after setting it. |
| Upload "mime type not supported" / "payload too large" | Only PNG/JPEG/WebP/GIF up to 10 MB are allowed (by design). |
| CSV import fails for big files / 413 | Vercel 4.5 MB body limit — split the CSV (UI caps at 4 MB). |
| Import/recalculation times out | Split the import; check the Vercel plan's function duration; see ROADMAP (background jobs). |
| "Limit reached: at most N … per hour" | Per-user rate limits (`src/server/services/rate-limit.ts`) — wait or adjust limits. |
| Very slow pages | Vercel function region ≠ Supabase region (§3.1). Free Supabase projects pause after inactivity. |
| Domain shows "Invalid Configuration" | DNS records not propagated or wrong; compare with Vercel's Domains page; remove conflicting AAAA/A records. |

## 9. Rollback
Vercel → Deployments → previous deployment → **Promote to Production** (instant). Database migrations are additive; never roll back
by dropping tables — write a new corrective migration and review it before `db push`.
