e# Shift Swap

A small web app where colleagues sign in with a **username and password**, see their work schedules, offer shifts for **giveaway** or **swap**, accept each other's offers, and mark which days they want to work. Accounts are created only by the admin; every new account gets a temporary password that must be changed on first login. Includes an admin panel.

Stack: **Next.js 14** (App Router) · **NextAuth** (credentials) · **bcryptjs** · **Supabase** (Postgres) · deployable free on **Wasmer Edge**.

---

## 1. Create the database (Supabase — free)

1. supabase.com → New project (free tier).
2. **SQL Editor** → New query → paste the contents of `supabase/schema.sql` → **Run**.
   - If you ran an older version before, first run:
     `drop table if exists availability, swap_requests, shifts, users cascade;`
3. This creates the first admin account:
   - Username: `admin`
   - Temporary password: `ChangeMe123!` (you'll be forced to change it on first login)
4. **Project Settings → API**: copy `Project URL` → `SUPABASE_URL` and the `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`.

## 2. Deploy on Wasmer Edge (free)

1. Push this folder to a GitHub repository.
2. On wasmer.io: create a new app → deploy from your GitHub repo (Next.js is auto-detected).
3. Add these secrets/environment variables in the app settings:

```
NEXTAUTH_SECRET           = any long random string (40+ chars)
NEXTAUTH_URL              = https://YOUR-APP.wasmer.app   (must match your real URL exactly)
SUPABASE_URL              = from Supabase
SUPABASE_SERVICE_ROLE_KEY = from Supabase
```

4. Deploy. Open the site, sign in as `admin` / `ChangeMe123!`, set your new password.

## 3. Add your colleagues

Admin panel → **Users** tab → Create an account (username + temporary password). Tell the colleague their username and temporary password; on first login they are forced to set their own. "Reset password" issues a new temporary password if someone forgets theirs.

## How it works

- **My schedule:** upcoming shifts, with "Offer for giveaway / swap" on each; toggle to see the whole team.
- **Marketplace:** open offers. "Take this shift" (giveaway) transfers instantly; "Propose my shift" (swap) exchanges two shifts instantly.
- **Availability:** mark days *want to work* / *prefer off*; visible to all colleagues.
- **Admin panel:** create/remove accounts, reset passwords, add shifts (with "repeat weekly until"), delete shifts.

## Local development (optional)

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000
```

## Structure

```
app/
  login/             Username + password sign-in
  change-password/   Forced on first login / after reset
  schedule/          My schedule + team view + offer dialog
  marketplace/       Open offers, take/swap actions
  availability/      Day preferences grid
  admin/             Users + shifts management (admins only)
  api/               Server endpoints (auth-checked); api/password changes own password
lib/auth.js          NextAuth credentials config (bcrypt verification)
supabase/schema.sql  Database schema (run once)
middleware.js        Requires login on every page
```
