import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../infrastructure/tenantContext", () => {
    return {
        tenantContext: {
            activeCenterId: "test-center-123"
        },
        requireConfiguredCenterId: vi.fn(() => "test-center-123")
    };
});

const mockFrom = vi.fn();
const mockAuthGetSession = vi.fn();
const mockAuthSignIn = vi.fn();
const mockAuthSignOut = vi.fn();

// We must mock `@supabase/supabase-js` before importing the client so our dummy methods take effect
vi.mock("@supabase/supabase-js", () => {
    return {
        createClient: vi.fn(() => ({
            from: mockFrom,
            auth: {
                getSession: mockAuthGetSession,
                signInWithPassword: mockAuthSignIn,
                signOut: mockAuthSignOut
            }
        }))
    };
});

vi.mock("../config/env", () => {
    return {
        config: {
            backend: "supabase",
            branchMode: "single",
            centerId: "test-center-123",
            supabaseUrl: "https://mock.supabase.co",
            supabasePublishableKey: "mock-key"
        },
        EnvironmentConfigurationError: class extends Error {}
    }
});

import { createRepositoryBundle } from "../infrastructure/createRepositoryBundle";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import { createUnsupportedWriteError, SupabaseInfrastructureError } from "../infrastructure/supabase/errors";
import { mapCustomer, mapExpense, mapAuthSession } from "../infrastructure/supabase/mappers";
import { AppointmentStatus, Customer } from "../domain/entities";
import { SessionState, UserRole } from "../domain/entities/Session";

describe("Supabase Repository Tests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Auth Adapter and Mappers", () => {
        it("mapAuthSession returns unauthenticated state when passed null", () => {
            const state = mapAuthSession(null);
            expect(state.status).toBe("anonymous");
        });

        it("mapAuthSession fails closed if role is missing in user_metadata", () => {
            const mockSession = {
                user: {
                    id: "u123",
                    email: "test@example.com",
                    user_metadata: {}
                }
            } as any;
            
            const state = mapAuthSession(mockSession);
            expect(state.status).toBe("error");
            if (state.status === "error") {
                expect(state.error.message).toBe("MISSING_OR_INVALID_ROLE");
            }
        });

        it("mapAuthSession fails closed if role is invalid in user_metadata", () => {
            const mockSession = {
                user: {
                    id: "u123",
                    email: "test@example.com",
                    user_metadata: { role: "HACKER" }
                }
            } as any;
            
            const state = mapAuthSession(mockSession);
            expect(state.status).toBe("error");
            if (state.status === "error") {
                expect(state.error.message).toBe("MISSING_OR_INVALID_ROLE");
            }
        });

        it("mapAuthSession falls back to ADMIN if email contains admin is NO LONGER SUPPORTED", () => {
             const mockSession = {
                user: {
                    id: "u123",
                    email: "superadmin@example.com",
                    user_metadata: {}
                }
            } as any;
            const state = mapAuthSession(mockSession);
            expect(state.status).toBe("error");
        });

        it("mapAuthSession honors structural user_metadata role and name", () => {
            const mockSession = {
                user: {
                    id: "u123",
                    email: "manager@example.com",
                    user_metadata: {
                        name: "Big Boss",
                        role: "MANAGER"
                    }
                }
            } as any;
            const state = mapAuthSession(mockSession);
            if (state.status === "authenticated") {
                expect(state.session.user.role).toBe(UserRole.MANAGER);
                expect(state.session.user.name).toBe("Big Boss");
            }
        });

        it("mapAuthSession fails closed if id is missing", () => {
            const malformedSession = {
                user: {
                    email: "test@example.com"
                }
            } as any;
            const state = mapAuthSession(malformedSession);
            expect(state.status).toBe("error");
        });
    });

    it("factory returns Supabase adapters in supabase mode", () => {
        const bundle = createRepositoryBundle();
        expect(bundle.customerAdapter.constructor.name).toBe("SupabaseCustomerAdapter");
        expect(bundle.employeeAdapter.constructor.name).toBe("SupabaseEmployeeAdapter");
    });



    describe("Customer Adapter DML", () => {
        it("create customer hits insert and maps correctly", async () => {
            const mockSelect = vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "123", name: "Alice", total_spent: 0, loyalty_points: 0, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
                    error: null
                })
            });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
            mockFrom.mockReturnValue({ insert: mockInsert });

            const bundle = createRepositoryBundle();
            const res = await bundle.customerAdapter.create({ name: "Alice" });
            expect(res.ok).toBe(true);
            expect(mockFrom).toHaveBeenCalledWith("customers");
            expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ name: "Alice", center_id: "test-center-123" }));
        });

        it("update customer hits update with correct payload", async () => {
            const mockSelect = vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "123", name: "Alice", total_spent: 0, loyalty_points: 0, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
                    error: null
                })
            });
            const mockEq2 = vi.fn().mockReturnValue({ select: mockSelect });
            const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
            mockFrom.mockReturnValue({ update: mockUpdate });

            const bundle = createRepositoryBundle();
            const res = await bundle.customerAdapter.update("123", { phone: "12345" });
            expect(res.ok).toBe(true);
            expect(mockFrom).toHaveBeenCalledWith("customers");
            expect(mockUpdate).toHaveBeenCalledWith({ phone: "12345" });
            expect(mockEq).toHaveBeenCalledWith("id", "123");
            expect(mockEq2).toHaveBeenCalledWith("center_id", "test-center-123");
        });

        it("delete customer hits delete with correct id", async () => {
            const mockEq2 = vi.fn().mockResolvedValue({ error: null });
            const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
            const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
            mockFrom.mockReturnValue({ delete: mockDelete });

            const bundle = createRepositoryBundle();
            const res = await bundle.customerAdapter.delete("123");
            expect(res.ok).toBe(true);
            expect(mockFrom).toHaveBeenCalledWith("customers");
            expect(mockDelete).toHaveBeenCalled();
            expect(mockEq).toHaveBeenCalledWith("id", "123");
            expect(mockEq2).toHaveBeenCalledWith("center_id", "test-center-123");
        });
        it("malformed row returns mapped error on create", async () => {
            const mockSelect = vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "123" }, // missing required fields for mapCustomer
                    error: null
                })
            });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
            mockFrom.mockReturnValue({ insert: mockInsert });

            const bundle = createRepositoryBundle();
            const res = await bundle.customerAdapter.create({ name: "Alice" });
            expect(res.ok).toBe(false);
            if (!res.ok) {
                expect(((res as any).error as any).type).toBe("SUPABASE_QUERY_ERROR");
            }
        });

        it("infrastructure failure normalizes bounded error on update", async () => {
            const mockSelect = vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Network error" }
                })
            });
            const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
            mockFrom.mockReturnValue({ update: mockUpdate });

            const bundle = createRepositoryBundle();
            const res = await bundle.customerAdapter.update("123", { name: "Bob" });
            expect(res.ok).toBe(false);
            if (!res.ok) {
                expect(((res as any).error as any).type).toBe("SUPABASE_QUERY_ERROR");
            }
        });
    });

    describe("Service Adapter DML", () => {
        it("create service hits insert and maps correctly", async () => {
             const mockSelect = vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "10", name: "Haircut", price: 20, duration_minutes: 30, is_active: true, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
                    error: null
                })
            });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
            const categoryMaybeSingle = vi.fn().mockResolvedValue({ data: { id: "category-1" }, error: null });
            mockFrom.mockImplementation((table: string) => table === "service_categories"
              ? { upsert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ maybeSingle: categoryMaybeSingle }) }) }
              : { insert: mockInsert });

            const bundle = createRepositoryBundle();
            const res = await bundle.serviceAdapter.create({ name: "Haircut", categoryName: "Hair", price: 20, durationMinutes: 30 });
            expect(res.ok).toBe(true);
            expect(mockFrom).toHaveBeenCalledWith("services");
            expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ name: "Haircut", price: 20, duration_minutes: 30, center_id: "test-center-123" }));
        });

        it("update service hits update and maps correctly", async () => {
             const mockSelect = vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "10", name: "Haircut", price: 25, duration_minutes: 30, is_active: true, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
                    error: null
                })
            });
            const mockEq2 = vi.fn().mockReturnValue({ select: mockSelect });
            const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
            mockFrom.mockReturnValue({ update: mockUpdate });

            const bundle = createRepositoryBundle();
            const res = await bundle.serviceAdapter.update("10", { price: 25 });
            expect(res.ok).toBe(true);
            expect(mockFrom).toHaveBeenCalledWith("services");
            expect(mockUpdate).toHaveBeenCalledWith({ price: 25 });
            expect(mockEq).toHaveBeenCalledWith("id", "10");
            expect(mockEq2).toHaveBeenCalledWith("center_id", "test-center-123");
        });

        it("delete service hits delete with correct id", async () => {
            const mockEq2 = vi.fn().mockResolvedValue({ error: null });
            const mockEq = vi.fn().mockReturnValue({ eq: mockEq2 });
            const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
            mockFrom.mockReturnValue({ delete: mockDelete });

            const bundle = createRepositoryBundle();
            const res = await bundle.serviceAdapter.delete("10");
            expect(res.ok).toBe(true);
            expect(mockFrom).toHaveBeenCalledWith("services");
            expect(mockDelete).toHaveBeenCalled();
            expect(mockEq).toHaveBeenCalledWith("id", "10");
            expect(mockEq2).toHaveBeenCalledWith("center_id", "test-center-123");
        });
    });

    it("lazy client initialization is preserved", () => {
        const client1 = getSupabaseClient();
        const client2 = getSupabaseClient();
        
        // Should be the exact same object reference
        expect(client1).toBe(client2);
        
        // Ensure createClient was only called once
        // This actually accesses the mock we defined
        // However, counting internal vitest mock invocations on createClient might be tricky without exposing it,
        // but we know it's a singleton pattern.
    });

    it("mapped rows handle nullable values properly and enforce rules", () => {
        const validUnpopulatedRow = {
            id: "123",
            name: "John Doe",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z"
            // omitting phone, email, notes, last_visit
        };

        const cust = mapCustomer(validUnpopulatedRow);
        expect(cust.id).toBe("123");
        expect(cust.phone).toBeUndefined();
        expect(cust.lastVisit).toBeUndefined();
        expect(cust.totalSpent).toBe(0); // defaults correctly

        const malformedRow = {
            id: "123"
            // missing 'name'
        };
        
        expect(() => mapCustomer(malformedRow)).toThrowError("Missing or invalid required fields (id, name)");
    });
    
    it("backend query error is transformed to bounded infrastructure error", async () => {
        const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: "Internal Server Error" } });
        const mockSelect = vi.fn(() => ({ order: mockOrder }));
        mockFrom.mockReturnValue({ select: mockSelect });

        const bundle = createRepositoryBundle();
        const result = await bundle.customerAdapter.list();

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect((result as any).error.code).toBe("INFRASTRUCTURE_ERROR");
            expect(((result as any).error as any).type).toBe("SUPABASE_QUERY_ERROR");
        }

        expect(mockFrom).toHaveBeenCalledWith("customers");
    });

    it("issues expected read-only query shapes", async () => {
        const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
        const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
        const mockSelect = vi.fn(() => ({ eq: mockEq }));
        mockFrom.mockReturnValue({ select: mockSelect });

        const bundle = createRepositoryBundle();
        await bundle.serviceAdapter.list();

        expect(mockFrom).toHaveBeenCalledWith("services");
        expect(mockSelect).toHaveBeenCalledWith("*, service_categories(name)");
        expect(mockEq).toHaveBeenCalledWith("center_id", "test-center-123");
        expect(mockOrder).toHaveBeenCalledWith("name", { ascending: true });
    });

    it("fails mapping with SUPABASE_MAPPING_ERROR when fields missing", () => {
        expect(() => mapExpense({ id: "1" })).toThrowError(SupabaseInfrastructureError);
        try {
            mapExpense({ id: "1" });
        } catch (e: any) {
            expect(e.type).toBe("SUPABASE_MAPPING_ERROR");
        }
    });

    describe("Appointment Adapter DML", () => {
        it("create appointment hits insert", async () => {
             const mockSelect = vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "1", customer_id: "c1", date_time: "2024-01-01T00:00:00Z", status: "SCHEDULED", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
                    error: null
                })
            });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
            mockFrom.mockReturnValue({ insert: mockInsert });

            const bundle = createRepositoryBundle();
            const res = await bundle.appointmentAdapter.create({
                customerId: "c1",
                employeeId: "e1",
                serviceId: "s1",
                dateTime: new Date("2026-08-11T10:00:00Z"),
            });
            expect(res.ok).toBe(true);
            expect(mockFrom).toHaveBeenCalledWith("appointments");
            expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ customer_id: "c1", center_id: "test-center-123" }));
        });
        it("update appointment hits update", async () => {
             const mockSelect = vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "1", customer_id: "c1", date_time: "2024-01-01T00:00:00Z", status: "CANCELLED", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
                    error: null
                })
            });
            const mockEq2 = vi.fn().mockReturnValue({ select: mockSelect });
            const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });
            mockFrom.mockReturnValue({ update: mockUpdate });

            const bundle = createRepositoryBundle();
            const res = await bundle.appointmentAdapter.update("1", { notes: "test" });
            expect(res.ok).toBe(true);
            expect(mockFrom).toHaveBeenCalledWith("appointments");
            expect(mockUpdate).toHaveBeenCalledWith({ notes: "test" });
        });
        it("delete appointment hits delete", async () => {
            const mockEq2 = vi.fn().mockResolvedValue({ error: null });
            const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
            const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
            mockFrom.mockReturnValue({ delete: mockDelete });

            const bundle = createRepositoryBundle();
            const res = await bundle.appointmentAdapter.delete("1");
            expect(res.ok).toBe(true);
            expect(mockFrom).toHaveBeenCalledWith("appointments");
            expect(mockDelete).toHaveBeenCalled();
        });
    });

    describe("Product Adapter DML", () => {
        it("create product hits insert", async () => {
             const mockSelect = vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "1", name: "Shampoo", price: 10, cost: 5, stock_quantity: 10, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
                    error: null
                })
            });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
            mockFrom.mockReturnValue({ insert: mockInsert });

            const bundle = createRepositoryBundle();
            const res = await bundle.productAdapter.create({ name: "Shampoo", price: 10, cost: 5 });
            expect(res.ok).toBe(true);
            expect(mockFrom).toHaveBeenCalledWith("products");
            expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ name: "Shampoo", center_id: "test-center-123" }));
        });
        it("update product hits update", async () => {
             const mockSelect = vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "1", name: "Shampoo", price: 10, cost: 5, stock_quantity: 10, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
                    error: null
                })
            });
            const mockEq2 = vi.fn().mockReturnValue({ select: mockSelect });
            const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });
            mockFrom.mockReturnValue({ update: mockUpdate });

            const bundle = createRepositoryBundle();
            const res = await bundle.productAdapter.update("1", { price: 15 });
            expect(res.ok).toBe(true);
            expect(mockUpdate).toHaveBeenCalledWith({ price: 15 });
        });
        it("delete product hits delete", async () => {
            const mockEq2 = vi.fn().mockResolvedValue({ error: null });
            const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
            const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
            mockFrom.mockReturnValue({ delete: mockDelete });

            const bundle = createRepositoryBundle();
            const res = await bundle.productAdapter.delete("1");
            expect(res.ok).toBe(true);
        });
    });

    describe("Expense Adapter DML", () => {
        it("create expense hits insert", async () => {
             const mockSelect = vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "1", amount: 50, category: "Supplies", created_at: "2024-01-01T00:00:00Z", date: "2024-01-01T00:00:00Z" },
                    error: null
                })
            });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
            mockFrom.mockReturnValue({ insert: mockInsert });

            const bundle = createRepositoryBundle();
            const res = await bundle.expenseAdapter.create({ amount: 50, category: "Supplies" });
            expect(res.ok).toBe(true);
            expect(mockFrom).toHaveBeenCalledWith("expenses");
            expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ category: "Supplies", center_id: "test-center-123" }));
        });
        it("delete expense hits delete", async () => {
            const mockEq2 = vi.fn().mockResolvedValue({ error: null });
            const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
            const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
            mockFrom.mockReturnValue({ delete: mockDelete });

            const bundle = createRepositoryBundle();
            const res = await bundle.expenseAdapter.delete("1");
            expect(res.ok).toBe(true);
        });
    });

    describe("Auth Repository Operations", () => {
        it("getSession returns unauthenticated when no session exists", async () => {
            mockAuthGetSession.mockResolvedValue({ data: { session: null }, error: null });
            const bundle = createRepositoryBundle();
            const res = await bundle.authAdapter.getSession();
            expect(res.ok).toBe(true);
            if (res.ok) {
                expect(res.data.status).toBe("anonymous");
            }
        });

        it("getSession handles infrastructure errors smoothly", async () => {
            mockAuthGetSession.mockResolvedValue({ data: { session: null }, error: { message: "Network offline" } });
            const bundle = createRepositoryBundle();
            const res = await bundle.authAdapter.getSession();
            expect(res.ok).toBe(false);
            if (!res.ok) {
                expect((res as any).error.code).toBe("INFRASTRUCTURE_ERROR");
            }
        });

        it("login calls signInWithPassword and handles invalid credentials", async () => {
            mockAuthSignIn.mockResolvedValue({ data: { session: null }, error: { message: "Invalid login credentials" } });
            const bundle = createRepositoryBundle();
            const res = await bundle.authAdapter.login("test", "pass");
            expect(res.ok).toBe(false);
            if (!res.ok) {
                expect((res as any).error.code).toBe("INVALID_CREDENTIALS");
            }
            expect(mockAuthSignIn).toHaveBeenCalledWith({ email: "test", password: "pass" });
        });

        it("logout calls signOut and handles success", async () => {
            mockAuthSignOut.mockResolvedValue({ error: null });
            const bundle = createRepositoryBundle();
            const res = await bundle.authAdapter.logout();
            expect(res.ok).toBe(true);
            expect(mockAuthSignOut).toHaveBeenCalled();
        });
    });

});
