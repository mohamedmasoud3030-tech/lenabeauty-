import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase configuration in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyVulnerability() {
  console.log("--- RLS Vulnerability Verification ---");

  // 1. Check if we can see all centers
  const { data: centers, error: centersError } = await supabase.from("centers").select("*");
  if (centersError) {
    console.error("Error fetching centers:", centersError.message);
  } else {
    console.log(`Successfully fetched ${centers?.length} centers (should be limited if RLS was on).`);
    console.table(centers);
  }

  // 2. Try to fetch customers without filtering by center_id
  const { data: customers, error: customersError } = await supabase.from("customers").select("*").limit(5);
  if (customersError) {
    console.error("Error fetching customers:", customersError.message);
  } else {
    console.log(`Successfully fetched ${customers?.length} customers without center_id filter (RLS is OFF).`);
  }

  // 3. Try to insert a customer into the configured center_id
  const centerId = process.env.VITE_CENTER_ID;
  if (centerId) {
    const { data: insertData, error: insertError } = await supabase.from("customers").insert({
      name: "Vulnerability Test Customer",
      center_id: centerId
    }).select();

    if (insertError) {
      console.log("Insert rejected:", insertError.message);
    } else {
      console.log("CRITICAL: Successfully inserted customer into center_id! RLS is likely OFF or broad.");
      // Cleanup
      if (insertData && insertData[0]) {
        await supabase.from("customers").delete().eq("id", insertData[0].id);
        console.log("Cleaned up test customer.");
      }
    }
  }

  // 4. Try to insert with a random center_id (to test cross-center isolation)
  const randomCenterId = "11111111-1111-1111-1111-111111111111";
  const { data: crossData, error: crossError } = await supabase.from("customers").insert({
    name: "Cross-Center Test Customer",
    center_id: randomCenterId
  }).select();

  if (crossError) {
    console.log("Cross-center insert rejected (expected if RLS is on or FK fails):", crossError.message);
  } else {
    console.log("CRITICAL: Successfully inserted customer into a RANDOM center_id! NO CROSS-CENTER ISOLATION.");
    if (crossData && crossData[0]) {
        await supabase.from("customers").delete().eq("id", crossData[0].id);
        console.log("Cleaned up cross-center test customer.");
    }
  }
}

verifyVulnerability();
