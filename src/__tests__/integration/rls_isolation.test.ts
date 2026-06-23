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

async function runTest() {
  console.log("--- Starting Hardened RLS Isolation Integration Test ---");

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Authenticate as User A
  const { data: authA, error: errorA } = await supabase.auth.signInWithPassword({
    email: userA_email,
    password: userA_pass,
  });

  if (errorA) {
    console.error("User A Authentication failed:", errorA.message);
    process.exit(1);
  }
  const clientA = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${authA.session.access_token}` } }
  });

  // Get User A's center
  const { data: membershipsA } = await clientA.from("center_memberships").select("center_id");
  const centerA = membershipsA?.[0]?.center_id;
  if (!centerA) {
    console.error("User A has no center membership.");
    process.exit(1);
  }

  // 2. Authenticate as User B
  const { data: authB, error: errorB } = await supabase.auth.signInWithPassword({
    email: userB_email,
    password: userB_pass,
  });

  if (errorB) {
    console.error("User B Authentication failed:", errorB.message);
    process.exit(1);
  }
  const clientB = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${authB.session.access_token}` } }
  });

  // Get User B's center
  const { data: membershipsB } = await clientB.from("center_memberships").select("center_id");
  const centerB = membershipsB?.[0]?.center_id;
  if (!centerB) {
    console.error("User B has no center membership.");
    process.exit(1);
  }

  if (centerA === centerB) {
    console.error("TEST ERROR: User A and User B belong to the same center. Cannot test isolation.");
    process.exit(1);
  }

  let failures = 0;

  async function assert(condition: boolean, message: string) {
      if (!condition) {
          console.error(`❌ FAILED: ${message}`);
          failures++;
      } else {
          console.log(`✅ PASSED: ${message}`);
      }
  }

  // TEST: Cross-Center SELECT
  const { data: crossSelect } = await clientA.from("customers").select("*").eq("center_id", centerB);
  await assert(!crossSelect || crossSelect.length === 0, "User A cannot SELECT customers from Center B");

  // TEST: Same-Center CRUD
  const { data: sameInsert, error: sameInsertErr } = await clientA.from("customers").insert({
    name: "User A Customer",
    center_id: centerA
  }).select().single();

  await assert(!sameInsertErr, "User A can INSERT into their own center");
  
  if (sameInsert) {
      const { error: sameUpdateErr } = await clientA.from("customers").update({ name: "Updated" }).eq("id", sameInsert.id);
      await assert(!sameUpdateErr, "User A can UPDATE their own customer");

      const { error: sameDeleteErr } = await clientA.from("customers").delete().eq("id", sameInsert.id);
      await assert(!sameDeleteErr, "User A can DELETE their own customer");
  }

  // TEST: Cross-Center INSERT (Forge center_id)
  const { error: crossInsertErr } = await clientA.from("customers").insert({
    name: "Malicious Insert",
    center_id: centerB
  });
  await assert(!!crossInsertErr, "User A cannot INSERT into Center B");

  // TEST: Cross-Center UPDATE
  const { data: bCust } = await clientB.from("customers").insert({
    name: "User B Private Customer",
    center_id: centerB
  }).select().single();

  if (bCust) {
    const { error: crossUpdateErr } = await clientA.from("customers").update({ name: "Hacked" }).eq("id", bCust.id);
    const { data: checkBCust } = await clientB.from("customers").select("name").eq("id", bCust.id).single();
    await assert(checkBCust?.name === "User B Private Customer", "User A cannot UPDATE User B's customer");
    
    // Cleanup
    await clientB.from("customers").delete().eq("id", bCust.id);
  }

  // TEST: Cross-Center DELETE
  const { data: bCust2 } = await clientB.from("customers").insert({
    name: "User B Another Customer",
    center_id: centerB
  }).select().single();

  if (bCust2) {
    await clientA.from("customers").delete().eq("id", bCust2.id);
    const { data: checkBCust2 } = await clientB.from("customers").select("*").eq("id", bCust2.id).maybeSingle();
    await assert(!!checkBCust2, "User A cannot DELETE User B's customer");
    
    // Cleanup
    await clientB.from("customers").delete().eq("id", bCust2.id);
  }

  // TEST: Cross-Table Integrity (Appointments)
  // User A attempts to create an appointment in Center A but referencing a Customer from Center B
  if (bCust) {
    const { error: crossTableErr } = await clientA.from("appointments").insert({
      center_id: centerA,
      customer_id: bCust.id,
      date_time: new Date().toISOString(),
      status: "scheduled"
    });
    await assert(!!crossTableErr, "User A cannot create an appointment referencing a customer from Center B");
  }

  // TEST: Storage Isolation
  const { error: storageUploadErr } = await clientA.storage
    .from("center-assets")
    .upload(`${centerB}/malicious.txt`, "content");
  await assert(!!storageUploadErr, "User A cannot upload to Center B's storage folder");

  const { data: storageList } = await clientA.storage
    .from("center-assets")
    .list(centerB);
  await assert(!storageList || storageList.length === 0, "User A cannot list Center B's storage folder");

  if (failures > 0) {
      console.error(`\n--- Test Failed with ${failures} failures ---`);
      process.exit(1);
  } else {
      console.log("\n--- All RLS Isolation Tests Passed ---");
      process.exit(0);
  }
}

runTest();
