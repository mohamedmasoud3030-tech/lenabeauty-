import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Hardened environment check
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase configuration.");
  process.exit(1);
}

// Safety check: Refuse to run against production URLs (heuristic)
if (supabaseUrl.includes("supabase.co") && !process.env.I_KNOW_WHAT_I_AM_DOING_RLS_TEST) {
    console.error("SAFETY ERROR: Attempting to run destructive RLS tests against a remote Supabase URL.");
    console.error("Set I_KNOW_WHAT_I_AM_DOING_RLS_TEST=true to bypass this safety check.");
    process.exit(1);
}

// Required TEST-only environment variables
const userA_email = process.env.TEST_USER_A_EMAIL;
const userA_pass = process.env.TEST_USER_A_PASS;
const userB_email = process.env.TEST_USER_B_EMAIL;
const userB_pass = process.env.TEST_USER_B_PASS;

if (!userA_email || !userA_pass || !userB_email || !userB_pass) {
    console.error("Missing required TEST environment variables (TEST_USER_A_EMAIL, etc.).");
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Error-code helpers
// ---------------------------------------------------------------------------

/**
 * Assert an operation returned no error.
 * Fails the test immediately if there is any error (unexpected error on a
 * happy-path operation).
 */
function assertNoError(
  error: { code?: string; message?: string } | null,
  context: string,
): void {
  if (error) {
    throw new Error(
      `[${context}] Unexpected Supabase error ${error.code ?? "?"}: ${error.message}`,
    );
  }
}

/**
 * Assert that an operation was denied by RLS (PostgreSQL error 42501).
 *
 * Explicitly rejects foreign-key errors (23503) and enum/type errors as
 * false positives so a misconfigured test cannot accidentally pass.
 *
 * For SELECT operations RLS may return an empty result set instead of an
 * explicit error; callers should check result.data length separately.
 */
function assertRlsDenial(
  error: { code?: string; message?: string } | null,
  context: string,
): void {
  if (!error) {
    throw new Error(
      `[${context}] Expected RLS denial (42501) but the operation succeeded without error.`,
    );
  }

  const code = error.code ?? "";

  if (code === "23503") {
    throw new Error(
      `[${context}] False positive: got foreign-key error (23503) instead of RLS denial (42501). ` +
        `Ensure the referenced row (e.g. customer) still exists at the point this test runs. ` +
        `Error: ${error.message}`,
    );
  }

  if (["22P02", "22007", "22023", "P0001"].includes(code)) {
    throw new Error(
      `[${context}] False positive: got enum/type error (${code}) instead of RLS denial (42501). ` +
        `Check the appointment status value used in the test. Error: ${error.message}`,
    );
  }

  if (code !== "42501") {
    throw new Error(
      `[${context}] Unexpected error code ${code} — expected 42501 (RLS denial). ` +
        `Error: ${error.message}`,
    );
  }
  // code === "42501" → correct RLS denial, assertion passes
}

// ---------------------------------------------------------------------------
// Main test runner
// ---------------------------------------------------------------------------

async function runTest() {
  console.log("--- Starting Hardened RLS Isolation Integration Test ---");

  const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

  // ── Authenticate User A ──────────────────────────────────────────────────
  const { data: authA, error: errorA } = await supabase.auth.signInWithPassword({
    email: userA_email!,
    password: userA_pass!,
  });
  if (errorA) { console.error("User A Authentication failed:", errorA.message); process.exit(1); }

  const clientA = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `Bearer ${authA!.session!.access_token}` } },
  });

  const { data: membershipsA, error: memErrA } =
    await clientA.from("center_memberships").select("center_id");
  if (memErrA) { console.error("Failed to read User A memberships:", memErrA.message); process.exit(1); }
  const centerA = membershipsA?.[0]?.center_id;
  if (!centerA) { console.error("User A has no center membership."); process.exit(1); }

  // ── Authenticate User B ──────────────────────────────────────────────────
  const { data: authB, error: errorB } = await supabase.auth.signInWithPassword({
    email: userB_email!,
    password: userB_pass!,
  });
  if (errorB) { console.error("User B Authentication failed:", errorB.message); process.exit(1); }

  const clientB = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `Bearer ${authB!.session!.access_token}` } },
  });

  const { data: membershipsB, error: memErrB } =
    await clientB.from("center_memberships").select("center_id");
  if (memErrB) { console.error("Failed to read User B memberships:", memErrB.message); process.exit(1); }
  const centerB = membershipsB?.[0]?.center_id;
  if (!centerB) { console.error("User B has no center membership."); process.exit(1); }

  if (centerA === centerB) {
    console.error("TEST ERROR: User A and User B belong to the same center. Cannot test isolation.");
    process.exit(1);
  }

  // ── Assertion tracker ───────────────────────────────────────────────────
  let failures = 0;

  function assert(condition: boolean, message: string): void {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      failures++;
    } else {
      console.log(`✅ PASSED: ${message}`);
    }
  }

  // IDs of rows created by this run — collected here for cleanup
  let customerAId: string | null = null;
  let customerBId: string | null = null; // kept alive until cross-table appointment test
  let appointmentAId: string | null = null;
  const uploadedStoragePaths: string[] = [];

  try {
    // ────────────────────────────────────────────────────────────────────────
    // CUSTOMERS — cross-center SELECT denial
    // ────────────────────────────────────────────────────────────────────────

    const { data: crossSelect, error: crossSelectErr } =
      await clientA.from("customers").select("*").eq("center_id", centerB);
    if (crossSelectErr) {
      // Unexpected error on a SELECT — could be RLS but we treat any error as a
      // failure because SELECT-RLS normally silently returns empty, not an error.
      assertNoError(crossSelectErr, "User A cross-center SELECT customers");
    }
    assert(
      !crossSelect || crossSelect.length === 0,
      "User A cannot SELECT customers from Center B",
    );

    // ────────────────────────────────────────────────────────────────────────
    // CUSTOMERS — same-center CRUD (User A)
    // ────────────────────────────────────────────────────────────────────────

    const { data: sameInsert, error: sameInsertErr } = await clientA
      .from("customers")
      .insert({ name: "User A Customer", center_id: centerA })
      .select()
      .single();

    assertNoError(sameInsertErr, "User A INSERT into own center");
    assert(!sameInsertErr, "User A can INSERT into their own center");

    if (sameInsert) {
      customerAId = sameInsert.id;

      const { error: sameUpdateErr } = await clientA
        .from("customers")
        .update({ name: "Updated" })
        .eq("id", sameInsert.id);
      assertNoError(sameUpdateErr, "User A UPDATE own customer");
      assert(!sameUpdateErr, "User A can UPDATE their own customer");
    }

    // ────────────────────────────────────────────────────────────────────────
    // CUSTOMERS — cross-center INSERT denial
    // ────────────────────────────────────────────────────────────────────────

    const { error: crossInsertErr } = await clientA
      .from("customers")
      .insert({ name: "Malicious Insert", center_id: centerB });
    try {
      assertRlsDenial(crossInsertErr, "User A INSERT into Center B");
      assert(true, "User A cannot INSERT into Center B");
    } catch (e) {
      console.error((e as Error).message);
      failures++;
    }

    // ────────────────────────────────────────────────────────────────────────
    // CUSTOMERS — cross-center UPDATE / DELETE denial
    // User B seeds a customer; User A tries to tamper with it.
    // customerBId is intentionally kept alive until after the appointment test.
    // ────────────────────────────────────────────────────────────────────────

    const { data: bCust, error: bCustErr } = await clientB
      .from("customers")
      .insert({ name: "User B Private Customer", center_id: centerB })
      .select()
      .single();
    assertNoError(bCustErr, "User B seed customer for cross-center tests");

    if (bCust) {
      customerBId = bCust.id;

      // Cross-center UPDATE
      await clientA.from("customers").update({ name: "Hacked" }).eq("id", bCust.id);
      const { data: checkBCust, error: checkBCustErr } = await clientB
        .from("customers")
        .select("name")
        .eq("id", bCust.id)
        .single();
      assertNoError(checkBCustErr, "User B re-read own customer after cross-center UPDATE attempt");
      assert(
        checkBCust?.name === "User B Private Customer",
        "User A cannot UPDATE User B's customer",
      );

      // Cross-center DELETE — create a second customer to test deletion
      const { data: bCust2, error: bCust2Err } = await clientB
        .from("customers")
        .insert({ name: "User B Another Customer", center_id: centerB })
        .select()
        .single();
      assertNoError(bCust2Err, "User B seed second customer for DELETE test");

      if (bCust2) {
        await clientA.from("customers").delete().eq("id", bCust2.id);
        const { data: checkBCust2, error: checkBCust2Err } = await clientB
          .from("customers")
          .select("*")
          .eq("id", bCust2.id)
          .maybeSingle();
        assertNoError(checkBCust2Err, "User B re-read second customer after cross-center DELETE attempt");
        assert(!!checkBCust2, "User A cannot DELETE User B's customer");

        // Cleanup second customer (bCust still intentionally alive)
        await clientB.from("customers").delete().eq("id", bCust2.id);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // APPOINTMENTS — same-center INSERT (User A happy path)
    // ────────────────────────────────────────────────────────────────────────

    if (customerAId) {
      const { data: apptA, error: apptAErr } = await clientA
        .from("appointments")
        .insert({
          center_id: centerA,
          customer_id: customerAId,
          date_time: new Date().toISOString(),
          status: "SCHEDULED",      // real enum value from appointment_status
        })
        .select()
        .single();
      assertNoError(apptAErr, "User A INSERT same-center appointment");
      assert(!apptAErr, "User A can INSERT an appointment in their own center");
      if (apptA) {
        appointmentAId = apptA.id;
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // APPOINTMENTS — cross-table integrity (User A, Center A appointment,
    // but customer_id references Center B's customer)
    //
    // customerBId is still alive here — no FK error possible, only RLS.
    // ────────────────────────────────────────────────────────────────────────

    if (customerBId) {
      const { error: crossTableErr } = await clientA
        .from("appointments")
        .insert({
          center_id: centerA,
          customer_id: customerBId, // customer belongs to Center B — RLS WITH CHECK must reject
          date_time: new Date().toISOString(),
          status: "SCHEDULED",
        });
      try {
        assertRlsDenial(
          crossTableErr,
          "User A create appointment with cross-center customer_id",
        );
        assert(
          true,
          "User A cannot create an appointment referencing a customer from Center B",
        );
      } catch (e) {
        console.error((e as Error).message);
        failures++;
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // STORAGE — same-center upload + list (User A happy path)
    // ────────────────────────────────────────────────────────────────────────

    const uploadPath = `${centerA}/rls-test-${Date.now()}.txt`;
    const { error: uploadErr } = await clientA.storage
      .from("center-assets")
      .upload(uploadPath, "rls-test-content");
    assertNoError(uploadErr as typeof uploadErr & { code?: string; message?: string } | null,
      "User A upload to own center storage");
    assert(!uploadErr, "User A can upload to their own center's storage folder");
    if (!uploadErr) {
      uploadedStoragePaths.push(uploadPath);
    }

    const { data: listOwn, error: listOwnErr } = await clientA.storage
      .from("center-assets")
      .list(centerA);
    assertNoError(listOwnErr as typeof listOwnErr & { code?: string; message?: string } | null,
      "User A list own center storage");
    assert(Array.isArray(listOwn), "User A can list their own center's storage folder");

    // ────────────────────────────────────────────────────────────────────────
    // STORAGE — cross-center upload denial
    // ────────────────────────────────────────────────────────────────────────

    const { error: storageUploadErr } = await clientA.storage
      .from("center-assets")
      .upload(`${centerB}/malicious.txt`, "content");
    try {
      assertRlsDenial(
        storageUploadErr as { code?: string; message?: string } | null,
        "User A upload to Center B storage",
      );
      assert(true, "User A cannot upload to Center B's storage folder");
    } catch (e) {
      console.error((e as Error).message);
      failures++;
    }

    // ────────────────────────────────────────────────────────────────────────
    // STORAGE — cross-center list denial
    // ────────────────────────────────────────────────────────────────────────

    const { data: storageList, error: storageListErr } = await clientA.storage
      .from("center-assets")
      .list(centerB);

    if (storageListErr) {
      try {
        assertRlsDenial(
          storageListErr as { code?: string; message?: string } | null,
          "User A list Center B storage",
        );
        assert(true, "User A cannot list Center B's storage folder");
      } catch (e) {
        console.error((e as Error).message);
        failures++;
      }
    } else {
      assert(
        !storageList || storageList.length === 0,
        "User A cannot list Center B's storage folder",
      );
    }

  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────
    // Runs even when an assertion throws.

    if (appointmentAId) {
      await clientA.from("appointments").delete().eq("id", appointmentAId);
    }
    if (customerAId) {
      await clientA.from("customers").delete().eq("id", customerAId);
    }
    // customerBId is deleted here (after all tests that need it have run)
    if (customerBId) {
      await clientB.from("customers").delete().eq("id", customerBId);
    }
    if (uploadedStoragePaths.length > 0) {
      await clientA.storage.from("center-assets").remove(uploadedStoragePaths);
    }
  }

  // ── Result ────────────────────────────────────────────────────────────────
  if (failures > 0) {
    console.error(`\n--- Test Failed with ${failures} failures ---`);
    process.exit(1);
  } else {
    console.log("\n--- All RLS Isolation Tests Passed ---");
    process.exit(0);
  }
}

runTest();
