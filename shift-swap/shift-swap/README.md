# Shift Swap

A small web app where colleagues sign in with their Microsoft accounts, see their work schedules, offer shifts for **giveaway** or **swap**, accept each other's offers, and mark which days they want to work. Only whitelisted emails can sign in. Includes an admin panel for managing users and schedules.

Stack: **Next.js 14** (App Router) · **NextAuth** with Microsoft Entra ID · **Supabase** (Postgres) · deployable free on **Vercel**.

---

## 1. Create the database (Supabase — free)

1. Go to https://supabase.com → New project (free tier).
2. Open **SQL Editor** → paste the contents of `supabase/schema.sql` → **Run**.
   - Before running, edit the last `insert` line and put **your own Microsoft email** — this makes you the first admin.
3. Go to **Project Settings → API** and copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret, server-side only)

## 2. Register the Microsoft app (Azure — free)

1. Go to https://portal.azure.com → **Microsoft Entra ID → App registrations → New registration**.
2. Name: `Shift Swap`. Supported account types:
   - Pick **"Accounts in any organizational directory and personal Microsoft accounts"** if colleagues use mixed/personal accounts, or your single tenant if everyone is in one organization.
3. Redirect URI (type **Web**):
   - `http://localhost:3000/api/auth/callback/azure-ad` (for local dev)
   - After deploying, add: `https://YOUR-SITE.vercel.app/api/auth/callback/azure-ad`
4. From **Overview** copy the **Application (client) ID** → `AZURE_AD_CLIENT_ID`.
5. **Certificates & secrets → New client secret** → copy the secret **Value** → `AZURE_AD_CLIENT_SECRET`.
6. `AZURE_AD_TENANT_ID`: use `common` for any Microsoft account, or your **Directory (tenant) ID** to restrict to your organization.

## 3. Run locally

```bash
npm install
cp .env.example .env.local   # fill in all the values
npm run dev                  # http://localhost:3000
```

Generate `NEXTAUTH_SECRET` with: `openssl rand -base64 32` (or any long random string).

Sign in with the Microsoft account whose email you inserted as admin — you'll see the **Admin** tab.

## 4. Deploy free on Vercel

1. Push this folder to a GitHub repository.
2. Go to https://vercel.com → **New Project** → import the repo.
3. In project settings, add all environment variables from `.env.example`, with:
   - `NEXTAUTH_URL=https://YOUR-SITE.vercel.app`
4. Deploy, then add the production redirect URI in Azure (step 2.3).

## How it works

- **Whitelist:** sign-in is rejected unless the email already exists in the `users` table. Admins add emails in the Admin panel (or directly in Supabase).
- **My schedule:** users see their upcoming shifts; a toggle shows the whole team. Each shift has "Offer for giveaway / swap."
- **Marketplace:** all pending offers. "Take this shift" (giveaway) transfers it instantly; "Propose my shift" (swap) exchanges two shifts instantly.
- **Availability:** each user marks days as *want to work* / *prefer off*; visible to everyone.
- **Admin panel:** whitelist/remove users, add shifts (with "repeat weekly until" for recurring patterns), delete shifts.

## Structure

```
app/
  login/            Sign-in page (Microsoft button, whitelist error)
  schedule/         My schedule + team view + offer dialog
  marketplace/      Open offers, take/swap actions
  availability/     Day preferences grid
  admin/            Users + shifts management (admins only)
  api/              All server endpoints (auth-checked)
lib/
  auth.js           NextAuth config + whitelist check
  supabase.js       Server-side database client
supabase/schema.sql Database schema (run once)
middleware.js       Requires login on every page
```

## Ideas for v2

- Email/Teams notification when someone takes your shift
- Admin approval step for swaps (add `awaiting_admin` status)
- CSV import of schedules
- History page of completed swaps (data is already kept in `swap_requests`)
