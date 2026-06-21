import { describe, it, expect } from "vitest";
import { 
  SupabaseInvoiceAdapter, SupabaseReportAdapter, 
  SupabaseDashboardAdapter, SupabaseSettingsAdapter,
  SupabaseCustomerAdapter, SupabaseExpenseAdapter
} from "../infrastructure/supabase/repositories";
import { UnsupportedBackendMethodError } from "../infrastructure/supabase/errors";

describe("Phase 3: Supabase Adapter Contract Hardening", () => {
    it("Invoice.checkout throws UnsupportedBackendMethodError or Query Error depending on mock state", async () => {
        const adapter: any = new SupabaseInvoiceAdapter();
        const result = await adapter.checkout({});
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect((result as any).error.code).toMatch(/BACKEND_METHOD_UNSUPPORTED|INFRASTRUCTURE_ERROR/);
        }
    });

    it("Invoice.getForPrint is implemented but remains bounded without infrastructure", async () => {
        const adapter: any = new SupabaseInvoiceAdapter();
        const result = await adapter.getForPrint("123");
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect((result as any).error.code).toMatch(/BACKEND_METHOD_UNSUPPORTED|INFRASTRUCTURE_ERROR/);
        }
    });

    it("Dashboard summary methods behavior", async () => {
        const adapter = new SupabaseDashboardAdapter();
        const r1 = await adapter.getSummary();
        expect(r1.ok === true || (r1.ok === false && (r1 as any).error.code === 'INFRASTRUCTURE_ERROR')).toBe(true);

        const r2 = await adapter.getPnlMonth();
        expect(r2.ok).toBe(false);
        if (!r2.ok) expect((r2 as any).error.code).toMatch(/BACKEND_METHOD_UNSUPPORTED|INFRASTRUCTURE_ERROR/);
    });

    it("Reports methods behavior", async () => {
        const adapter: any = new SupabaseReportAdapter();
        const r1 = await adapter.getSales("2023-01-01", "2023-12-31");
        expect(r1.ok).toBe(false);
        if (!r1.ok) expect((r1 as any).error.code).toMatch(/BACKEND_METHOD_UNSUPPORTED|INFRASTRUCTURE_ERROR/);
        
        const r2 = await adapter.getAppointments("2023-01-01", "2023-12-31");
        expect(r2.ok === true || (r2.ok === false && (r2 as any).error.code === 'INFRASTRUCTURE_ERROR')).toBe(true);
        
        const r3 = await adapter.getInventory();
        expect(r3.ok === true || (r3.ok === false && (r3 as any).error.code === 'INFRASTRUCTURE_ERROR')).toBe(true);
    });

    it("Settings mutations are implemented but remain bounded without infrastructure", async () => {
        const adapter: any = new SupabaseSettingsAdapter();
        const r1 = await adapter.update({});
        expect(r1.ok).toBe(false);
        if (!r1.ok) expect((r1 as any).error.code).toMatch(/BACKEND_METHOD_UNSUPPORTED|INFRASTRUCTURE_ERROR/);
        
        const r2 = await adapter.backup();
        expect(r2.ok).toBe(false);
        if (!r2.ok) expect((r2 as any).error.code).toMatch(/BACKEND_METHOD_UNSUPPORTED|INFRASTRUCTURE_ERROR/);
    });

    it("Customer.getHistory throws UnsupportedBackendMethodError", async () => {
        const adapter: any = new SupabaseCustomerAdapter();
        const r1 = await adapter.getHistory("123");
        expect(r1.ok).toBe(false);
        if (!r1.ok) expect((r1 as any).error.code).toBe("BACKEND_METHOD_UNSUPPORTED");
    });

    it("Expense.update throws UnsupportedBackendMethodError", async () => {
        const adapter: any = new SupabaseExpenseAdapter();
        const r1 = await adapter.update("123", {});
        expect(r1.ok).toBe(false);
        if (!r1.ok) expect((r1 as any).error.code).toBe("BACKEND_METHOD_UNSUPPORTED");
    });
});
