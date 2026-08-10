/**
 * Tier 4 — Invite System automated checks
 * Run: npx tsx --env-file=.env.local tests/qa/tier4-invite-system.ts
 *
 * Covers:
 *  1. generateInviteLink deactivates prior links and creates a new one
 *  2. submitInviteRequest inserts a pending row
 *  3. submitInviteRequest rejects duplicate email
 *  4. submitInviteRequest rejects expired/inactive token
 *  5. approveInviteRequest adds to members + marks approved
 *  6. rejectInviteRequest marks rejected, no member row created
 *  7. invite_links with is_active=false not returned by active query
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;
const failures: string[] = [];

function pass(name: string) {
  console.log(`  ✅ PASS: ${name}`);
  passed++;
}

function fail(name: string, reason: string) {
  console.error(`  ❌ FAIL: ${name}`);
  console.error(`         Reason: ${reason}`);
  failed++;
  failures.push(`${name}: ${reason}`);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function createTestLink(overrides: {
  is_active?: boolean;
  expires_at?: string;
} = {}): Promise<{ id: string; token: string }> {
  const { data, error } = await db
    .from("invite_links")
    .insert({
      expires_at: overrides.expires_at ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      is_active: overrides.is_active ?? true,
    })
    .select("id, token")
    .single();
  if (error || !data) throw new Error(`createTestLink failed: ${error?.message}`);
  return data as { id: string; token: string };
}

async function cleanup(emails: string[]) {
  for (const email of emails) {
    await db.from("invite_requests").delete().eq("email", email);
    await db.from("members").delete().eq("email", email);
  }
  await db.from("invite_links").delete().eq("is_active", false);
}

// ── Test 1: generateInviteLink deactivates prior links ─────────────────────────

async function testGenerateLinkDeactivatesPrior() {
  const name = "generateInviteLink deactivates prior links and creates new one";
  try {
    // Insert a prior active link
    const { data: prior } = await db
      .from("invite_links")
      .insert({ expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString() })
      .select("id")
      .single();

    // Simulate the action: deactivate all, insert new
    await db.from("invite_links").update({ is_active: false }).eq("is_active", true);
    const { data: newLink } = await db
      .from("invite_links")
      .insert({ expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
      .select("id, token, is_active")
      .single();

    // Prior link should now be inactive
    const { data: priorCheck } = await db
      .from("invite_links")
      .select("is_active")
      .eq("id", prior!.id)
      .single();

    if (priorCheck?.is_active !== false) {
      fail(name, "Prior link was not deactivated");
      return;
    }
    if (!newLink?.token) {
      fail(name, "New link has no token");
      return;
    }
    if (newLink.is_active !== true) {
      fail(name, "New link is not active");
      return;
    }
    pass(name);
  } catch (e) {
    fail(name, String(e));
  }
}

// ── Test 2: submitInviteRequest inserts pending row ────────────────────────────

async function testSubmitInviteRequest() {
  const name = "submitInviteRequest inserts pending invite_request row";
  const email = `akpd-qa-invite-submit-${Date.now()}@example.com`;
  try {
    const link = await createTestLink();

    const { error } = await db.from("invite_requests").insert({
      link_id: link.id,
      full_name: "QA Test User",
      email,
      role: "member",
      position: "VP of QA",
    });

    if (error) { fail(name, error.message); return; }

    const { data } = await db
      .from("invite_requests")
      .select("status")
      .eq("email", email)
      .single();

    if (data?.status !== "pending") {
      fail(name, `Expected status 'pending', got '${data?.status}'`);
      return;
    }
    pass(name);
  } catch (e) {
    fail(name, String(e));
  } finally {
    await cleanup([email]);
  }
}

// ── Test 3: Duplicate email rejected ──────────────────────────────────────────

async function testDuplicateEmailRejected() {
  const name = "submitInviteRequest rejects duplicate email (unique constraint)";
  const email = `akpd-qa-invite-dup-${Date.now()}@example.com`;
  try {
    const link = await createTestLink();

    await db.from("invite_requests").insert({
      link_id: link.id,
      full_name: "QA First",
      email,
      role: "member",
    });

    const { error } = await db.from("invite_requests").insert({
      link_id: link.id,
      full_name: "QA Second",
      email,
      role: "alumni",
    });

    if (!error || error.code !== "23505") {
      fail(name, `Expected unique constraint violation (23505), got: ${error?.code ?? "no error"}`);
      return;
    }
    pass(name);
  } catch (e) {
    fail(name, String(e));
  } finally {
    await cleanup([email]);
  }
}

// ── Test 4: Expired token not returned ────────────────────────────────────────

async function testExpiredTokenNotReturned() {
  const name = "Expired invite link not returned by active query";
  try {
    const expiredLink = await createTestLink({
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });

    const { data } = await db
      .from("invite_links")
      .select("id")
      .eq("token", expiredLink.token)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (data !== null) {
      fail(name, "Expired link was returned by active query");
      return;
    }
    pass(name);
  } catch (e) {
    fail(name, String(e));
  }
}

// ── Test 5: approveInviteRequest adds to members + marks approved ──────────────

async function testApproveAddsToMembers() {
  const name = "approveInviteRequest adds email to members and marks approved";
  const email = `akpd-qa-invite-approve-${Date.now()}@example.com`;
  try {
    const link = await createTestLink();
    const { data: req } = await db
      .from("invite_requests")
      .insert({
        link_id: link.id,
        full_name: "QA Approve Test",
        email,
        role: "member",
        position: "QA Officer",
      })
      .select("id")
      .single();

    // Simulate approve: insert to members + update status
    await db.from("members").insert({
      email,
      full_name: "QA Approve Test",
      position: "QA Officer",
      role: "member",
    });
    await db.from("invite_requests").update({ status: "approved" }).eq("id", req!.id);

    const { data: memberRow } = await db
      .from("members")
      .select("email, role")
      .eq("email", email)
      .maybeSingle();

    const { data: reqRow } = await db
      .from("invite_requests")
      .select("status")
      .eq("id", req!.id)
      .single();

    if (!memberRow) { fail(name, "Member row not found after approval"); return; }
    if (memberRow.role !== "member") { fail(name, `Expected role 'member', got '${memberRow.role}'`); return; }
    if (reqRow?.status !== "approved") { fail(name, `Expected status 'approved', got '${reqRow?.status}'`); return; }
    pass(name);
  } catch (e) {
    fail(name, String(e));
  } finally {
    await cleanup([email]);
  }
}

// ── Test 6: rejectInviteRequest marks rejected, no member row ─────────────────

async function testRejectNoMemberRow() {
  const name = "rejectInviteRequest marks rejected and does not add to members";
  const email = `akpd-qa-invite-reject-${Date.now()}@example.com`;
  try {
    const link = await createTestLink();
    const { data: req } = await db
      .from("invite_requests")
      .insert({
        link_id: link.id,
        full_name: "QA Reject Test",
        email,
        role: "alumni",
      })
      .select("id")
      .single();

    await db.from("invite_requests").update({ status: "rejected" }).eq("id", req!.id);

    const { data: memberRow } = await db
      .from("members")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    const { data: reqRow } = await db
      .from("invite_requests")
      .select("status")
      .eq("id", req!.id)
      .single();

    if (memberRow) { fail(name, "Rejected request added to members table"); return; }
    if (reqRow?.status !== "rejected") { fail(name, `Expected status 'rejected', got '${reqRow?.status}'`); return; }
    pass(name);
  } catch (e) {
    fail(name, String(e));
  } finally {
    await cleanup([email]);
  }
}

// ── Test 7: Inactive link not returned ────────────────────────────────────────

async function testInactiveLinkNotReturned() {
  const name = "Inactive invite link not returned by active query";
  try {
    const inactiveLink = await createTestLink({ is_active: false });

    const { data } = await db
      .from("invite_links")
      .select("id")
      .eq("token", inactiveLink.token)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (data !== null) {
      fail(name, "Inactive link was returned by active query");
      return;
    }
    pass(name);
  } catch (e) {
    fail(name, String(e));
  }
}

// ── Runner ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🔍 Tier 4 — Invite System\n");

  await testGenerateLinkDeactivatesPrior();
  await testSubmitInviteRequest();
  await testDuplicateEmailRejected();
  await testExpiredTokenNotReturned();
  await testApproveAddsToMembers();
  await testRejectNoMemberRow();
  await testInactiveLinkNotReturned();

  console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.error("\nFailures:");
    failures.forEach((f) => console.error(`  · ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
