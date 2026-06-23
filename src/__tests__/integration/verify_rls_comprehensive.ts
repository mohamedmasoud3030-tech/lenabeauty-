import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase configuration.");
  process.exit(1);
}

// NOTE: We need real user credentials to test RLS properly.
// Since we don't have them, we will attempt to create them if possible,
// or use existing ones if provided via environment variables.
const userA_email = process.env.TEST_USER_A_EMAIL || "userA@example.com";
const userA_pass = process.env.TEST_USER_A_PASS || "password123";
const userB_email = process.env.TEST_USER_B_EMAIL || "userB@example.com";
const userB_pass = process.env.TEST_USER_B_PASS || "password123";

async function runVerification() {
  console.log("--- Starting Comprehensive RLS Verification ---");

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Authenticate as User A
  console.log(`Authenticating as User A: ${userA_email}...`);
  const { data: authA, error: errorA } = await supabase.auth.signInWithPassword({
    email: userA_email,
    password: userA_pass,
  });

  if (errorA) {
    console.error("User A Authentication failed:", errorA.message);
    console.log("Tip: Ensure the users exist in your Supabase project.");
    return;
  }
  console.log("User A Authenticated.");
  const clientA = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${authA.session.access_token}` } }
  });

  // Get User A's center
  const { data: membershipsA } = await clientA.from("center_memberships").select("center_id");
  const centerA = membershipsA?.[0]?.center_id;
  if (!centerA) {
    console.error("User A has no center membership.");
    return;
  }
  console.log(`User A belongs to Center: ${centerA}`);

  // 2. Authenticate as User B
  console.log(`Authenticating as User B: ${userB_email}...`);
  const { data: authB, error: errorB } = await supabase.auth.signInWithPassword({
    email: userB_email,
    password: userB_pass,
  });

  if (errorB) {
    console.error("User B Authentication failed:", errorB.message);
    return;
  }
  console.log("User B Authenticated.");
  const clientB = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${authB.session.access_token}` } }
  });

  // Get User B's center
  const { data: membershipsB } = await clientB.from("center_memberships").select("center_id");
  const centerB = membershipsB?.[0]?.center_id;
  if (!centerB) {
    console.error("User B has no center membership.");
    return;
  }
  console.log(`User B belongs to Center: ${centerB}`);

  if (centerA === centerB) {
    console.error("CRITICAL: User A and User B belong to the same center. Cannot test isolation.");
    return;
  }

  console.log("\n--- Testing Isolation ---");

  // PROVE: User A cannot SELECT data belonging to center B
  const { data: crossSelect } = await clientA.from("customers").select("*").eq("center_id", centerB);
  if (crossSelect && crossSelect.length > 0) {
    console.error("RED: User A can SELECT customers from Center B!");
  } else {
    console.log("GREEN: User A cannot SELECT customers from Center B.");
  }

  // PROVE: User A can perform valid same-center operations
  const { data: sameInsert, error: sameInsertErr } = await clientA.from("customers").insert({
    name: "User A Customer",
    center_id: centerA
  }).select().single();

  if (sameInsertErr) {
    console.error("RED: User A cannot INSERT into their own center:", sameInsertErr.message);
  } else {
    console.log("GREEN: User A can INSERT into their own center.");
    // Cleanup
    await clientA.from("customers").delete().eq("id", sameInsert.id);
  }

  // PROVE: User A cannot INSERT into center B
  const { error: crossInsertErr } = await clientA.from("customers").insert({
    name: "Malicious Insert",
    center_id: centerB
  });
  if (!crossInsertErr) {
    console.error("RED: User A can INSERT into Center B!");
  } else {
    console.log("GREEN: User A cannot INSERT into Center B.");
  }

  // PROVE: User A cannot UPDATE data in center B
  // First, User B creates a customer
  const { data: bCust } = await clientB.from("customers").insert({
    name: "User B Private Customer",
    center_id: centerB
  }).select().single();

  if (bCust) {
    const { error: crossUpdateErr } = await clientA.from("customers").update({ name: "Hacked" }).eq("id", bCust.id);
    if (!crossUpdateErr) {
        // Double check if it actually updated (RLS sometimes returns success but 0 rows)
        const { data: checkBCust } = await clientB.from("customers").select("name").eq("id", bCust.id).single();
        if (checkBCust?.name === "Hacked") {
            console.error("RED: User A successfully UPDATED User B's customer!");
        } else {
            console.log("GREEN: User A's UPDATE on User B's customer had no effect (RLS active).");
        }
    } else {
        console.log("GREEN: User A's UPDATE on User B's customer was rejected.");
    }
    // Cleanup
    await clientB.from("customers").delete().eq("id", bCust.id);
  }

  // PROVE: User A cannot DELETE data in center B
  const { data: bCust2 } = await clientB.from("customers").insert({
    name: "User B Another Customer",
    center_id: centerB
  }).select().single();

  if (bCust2) {
    const { error: crossDeleteErr } = await clientA.from("customers").delete().eq("id", bCust2.id);
    const { data: checkBCust2 } = await clientB.from("customers").select("*").eq("id", bCust2.id).maybeSingle();
    if (!checkBCust2) {
        console.error("RED: User A successfully DELETED User B's customer!");
    } else {
        console.log("GREEN: User A's DELETE on User B's customer was rejected or had no effect.");
    }
    // Cleanup
    await clientB.from("customers").delete().eq("id", bCust2.id);
  }
}

runVerification();
