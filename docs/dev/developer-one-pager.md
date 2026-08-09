# AKPD — Developer Quick Reference

## Local Setup

```bash
git clone https://github.com/aranjaimancs/AKPD.git && cd akpd-site
npm install
# create .env.local with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run dev   # → http://localhost:3000
```

---

## Top 5 Gotchas

1. **Always call `requireMember()` in page Server Components** — middleware is not authoritative
2. **Seniors are file-based** — `content/seniors/[slug]/` + `src/data/seniors.json`, not DB-driven
3. **Use `var(--t-primary)` for readable text** — never `var(--akp-navy)` in dark mode
4. **Signed URLs expire in 60s** — always fetch a fresh one on each download click
5. **`createAdminClient()` is server-only** — never call from a Client Component

---

## Where Things Live

| Path | Purpose |
|---|---|
| `src/app/[route]/page.tsx` | Pages |
| `src/lib/auth.ts` | `requireMember()`, `requireAdmin()` |
| `src/lib/actions/[domain].ts` | Server Actions |
| `src/lib/supabase/admin.ts` | Service-role DB client (server-only) |
| `content/seniors/` | Senior profiles (file-based) |
| `migrations/001–010` | SQL migrations → run via Supabase Dashboard |

---

## New Page Template

```ts
import { requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const member = await requireMember();
  const supabase = createAdminClient();
  const { data } = await supabase.from("table").select("*");
  return <div>{/* render */}</div>;
}
```
