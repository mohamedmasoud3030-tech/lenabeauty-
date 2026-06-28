# Phase 2.11.2F.0: MCP & Remote Inspection

> Historical note: This inspection predates the locked v1.0 decision to remove Preview Mode. Current implementation instructions are in `docs/NEXT_IMPLEMENTATION_REMOVE_PREVIEW_MODE.md`; the application must not "exit Preview Mode" because Preview Mode is removed.

## 1. MCP Authentication Status
**BLOCKED**
The Gemini native MCP tools and CLI are structurally inaccessible within this restricted AI workspace sandbox context. Direct, interactive OAuth-based command-line authentication flows using `gemini mcp add` cannot be initiated from within the active container constraints.

## 2. Selected Supabase Project Scope
**UNKNOWN.** No connection could be established.

## 3. Detected Project Type
**UNKNOWN — USER CONFIRMATION REQUIRED.**

## 4. Remote Schema Inventory
**BLOCKED.** Unable to query `information_schema` remotely. 

## 5. Drift Findings
**BLOCKED.** (See `docs/SUPABASE_REMOTE_DRIFT_MATRIX.md`).

## 6. RLS Findings
**BLOCKED.**

## 7. Tenant-Contract Findings
**BLOCKED.** 

## 8. Required Public Frontend Variables
The environment configuration contract inside `src/config/env.ts` has been verified. The application securely mandates three configurations to exit `Preview Mode`:
```env
VITE_DATA_BACKEND=supabase
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=pk_...
```
*Note: The system intentionally leverages the term `_PUBLISHABLE_KEY` rather than the traditional Supabase `_ANON_KEY` to strictly enforce frontend mental models preventing any accidental elevated token exposure.*

## 9. Migration Plan
See: `docs/SUPABASE_STAGING_MIGRATION_PLAN.md`

## 10. Rollback Plan
Documented entirely inside the Staging Migration Plan. Dropping tables safely mandates dropping constraints and triggers sequentially given the deep relationships `invoice_items` and `appointments` hold over `services` and `products`.

## 11. Blockers
*   **MCP Connectivity Constraint:** The agent operates inside a walled AI container environment without access to executing interactive host-level OS tools (`gemini CLI`).
*   **Missing Remote Target:** Cannot execute read operations until a physical proxy connection or `psql` equivalent payload is authorized with standard CI/CD DB connections.

## 12. Recommended Next Approved Action
**MANUAL STAGING DEPLOYMENT APPROVAL REQUIRED.**
Since MCP interactive CLI auth is blocked, the user must either:
1. Provide a direct standard PostgreSQL connection string (`postgresql://postgres.xxx...`) so the agent can execute the drafts via NodeJS/PG sequentially. 
2. Apply the drafts manually via the Supabase Dashboard SQL Editor, and define the `VITE_` variables internally or publicly, enabling the agent to boot `Supabase Mode` locally.
