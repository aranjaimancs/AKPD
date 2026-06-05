# Google OAuth Setup

These are the manual steps you do once in two dashboards.
The code is already wired; you just need to connect the credentials.

---

## 1. Google Cloud Console

1. Go to **console.cloud.google.com** → select or create a project (e.g. "AKPD Site").

2. **APIs & Services → OAuth consent screen**
   - User type: **Internal** (restricts to your Google Workspace / UNC org) OR **External** (any Google account — the `members` allowlist is the real gate).
   - Fill in App name (`AKPD Portal`), user support email, developer contact.
   - Scopes: add `email` and `profile` (the defaults). No extra scopes needed.
   - Save.

3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: `AKPD Site`
   - **Authorised JavaScript origins** (add both):
     ```
     http://localhost:3000
     https://<your-production-domain>
     ```
   - **Authorised redirect URIs** (add both):
     ```
     http://localhost:3000/auth/callback
     https://<your-production-domain>/auth/callback
     ```
     > These must match exactly. No trailing slash.
   - Click **Create**.
   - Copy the **Client ID** and **Client Secret** — you'll paste them into Supabase next.

---

## 2. Supabase Dashboard

1. Go to **Authentication → Providers → Google**.
2. Toggle **Enable**.
3. Paste in the **Client ID** and **Client Secret** from Google Cloud.
4. The **Callback URL (for OAuth)** shown here should be:
   ```
   https://<your-supabase-project>.supabase.co/auth/v1/callback
   ```
   This is Supabase's own callback — it's *different* from your app's `/auth/callback`.
   You don't add it to your app; Supabase uses it internally.
5. Save.

> Supabase handles the PKCE handshake between Google and your app.
> Your `/auth/callback` route receives a `code` from Supabase (not directly from Google).

---

## 3. Seed the first admin

Before anyone can sign in, run this in **Supabase → SQL Editor**:

```sql
insert into public.members (email, full_name, position, role)
values ('aranjaiman@gmail.com', 'Aran Jaiman', 'President', 'admin')
on conflict (email) do nothing;
```

After your first Google sign-in the `auth_user_id` column is filled automatically.

To add more members (repeat as needed):
```sql
insert into public.members (email, full_name, position, role)
values
  ('someone@unc.edu', 'Name Here', 'Brother', 'member'),
  ('pd@unc.edu',      'PD Name',   'Professional Development', 'admin');
```

---

## 4. Local dev

Your `.env.local` already has `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
After clicking "Sign in with Google" locally you'll be redirected through Google
back to `http://localhost:3000/auth/callback` — this works as long as
`http://localhost:3000` is in your Authorised JavaScript origins on Google Cloud.

---

## 5. Production deploy (Vercel)

Add these environment variables in Vercel → Project Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL          = <from Supabase>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = <anon key from Supabase>
SUPABASE_SERVICE_ROLE_KEY         = <service role key — mark as Secret>
NEXT_PUBLIC_SITE_URL              = https://<your-domain>
```

Then update `NEXT_PUBLIC_SITE_URL` in Supabase → Auth → URL Configuration → Site URL.

---

## Optional: restrict to unc.edu accounts

In `src/app/auth/google/route.ts`, uncomment:
```ts
queryParams: { hd: "unc.edu" },
```
This makes Google's account picker only show `@unc.edu` accounts. It's a UX hint — the `members` allowlist is still the real enforcement gate.
