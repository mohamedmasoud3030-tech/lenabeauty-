import { 
  AuthRepository, CustomerRepository, EmployeeRepository, ServiceRepository, 
  AppointmentRepository, ProductRepository, ExpenseRepository, InvoiceRepository, 
  SettingsRepository, DashboardRepository, ReportRepository, Result, DomainError, AuthError,
  BookingRepository, BookingInput, PublicService, PublicStaff, PublicCenterInfo, GiftCardRepository, ServicePackageRepository,
  CustomerExperienceRepository, ForecastRepository, AccountingRepository, AdvancedRepository
} from "../../domain/ports/repositories";
import { 
  Customer, Employee, Service, Appointment, Product, Expense, Invoice, 
  CenterSettings
} from "../../domain/entities";
import { SessionState } from "../../domain/entities/Session";
import { 
  createUnsupportedWriteError, createUnsupportedReadError, createQueryError, createUnsupportedAuthError
} from "./errors";
import { getSupabaseClient } from "./client";
import { 
  mapCustomer, mapEmployee, mapService, mapProduct, mapAppointment, mapExpense, mapCenterSettings,
  mapAuthSession, mapInvoice, mapInvoiceItem, mapGiftCard, mapGiftCardTransaction, mapServicePackage,
  mapNotificationSettings, mapPaymentGatewaySettings, mapCustomerReview, mapServiceFile, mapAccountingJournalEntry, mapAiBookingLead
} from "./mappers";
import { tenantContext, requireConfiguredCenterId } from "../tenantContext";
import { CheckoutPayload, InvoicePrintData, DashboardSummary, PnlData, ChartData, SalesReportRow, AppointmentReportRow, InventoryReportRow, BackupPayload, validateBackupPayload } from "../../application/dto";

function getCenterIdFor(operation: string): Result<string, DomainError> {
  try {
     const id = requireConfiguredCenterId();
     return { ok: true, data: id };
  } catch (e: any) {
     return { ok: false, error: createQueryError(operation, e.message) };
  }
}

function createAuthError(code: "INVALID_CREDENTIALS" | "INFRASTRUCTURE_ERROR", message: string): AuthError {
  const err = new Error(message) as AuthError;
  err.code = code;
  return err;
}

function isMissingBackendFeature(error: { code?: string; message?: string } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() || "";
  return error?.code === "PGRST202"
    || error?.code === "42883"
    || error?.code === "42P01"
    || error?.code === "42703"
    || message.includes("could not find the function")
    || message.includes("could not find the table")
    || message.includes("does not exist");
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

class SupabaseAuthAdapter implements AuthRepository {
  async login(username: string, password: string): Promise<Result<SessionState, AuthError>> {
    try {
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({
        email: username,
        password: password,
      });

      if (error) {
         if (error.message.toLowerCase().includes("invalid login credentials")) {
             return { ok: false, error: createAuthError("INVALID_CREDENTIALS", "Invalid credentials") };
         }
         return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", error.message) };
      }
      
      const sessionState = mapAuthSession(data.session);
      if (sessionState.status === "error") {
          return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", sessionState.error.message) };
      }
      
      return { ok: true, data: sessionState };
    } catch (e: unknown) {
      return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", (e as Error).message) };
    }
  }
  
  async logout(): Promise<Result<void, AuthError>> {
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) {
        return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", error.message) };
      }
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", (e as Error).message) };
    }
  }
  
  async getSession(): Promise<Result<SessionState, AuthError>> {
    try {
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error) {
        return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", error.message) };
      }
      const sessionState = mapAuthSession(data.session);
      if (sessionState.status === "error") {
          return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", sessionState.error.message) };
      }
      return { ok: true, data: sessionState };
    } catch (e: unknown) {
      return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", (e as Error).message) };
    }
  }

  async getMyCenters(): Promise<Result<{ id: string, name: string }[], AuthError>> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('center_memberships')
        .select(`
          center_id,
          centers (
            name
          )
        `);
      if (error) {
         return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", error.message) };
      }
      const mapped = data.map((d: any) => ({
        id: d.center_id,
        name: d.centers?.name || 'Unknown Center'
      })).sort((a,b) => a.name.localeCompare(b.name));
      return { ok: true, data: mapped };
    } catch (e: unknown) {
       return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", (e as Error).message) };
    }
  }
}

class SupabaseCustomerAdapter implements CustomerRepository {
  async list(query?: string): Promise<Result<Customer[], DomainError>> {
    const centerRes = getCenterIdFor("Customer.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      let req = getSupabaseClient()
        .from('customers')
        .select('*')
        .eq('center_id', centerRes.data)
        .order('created_at', { ascending: false });

      if (query && query.trim().length > 0) {
        const q = query.trim();
        req = req.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
      }

      const { data, error } = await req;
      if (error) return { ok: false, error: createQueryError("Customer.list", error.message) };
      return { ok: true, data: data.map(mapCustomer) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Customer.list", (e as Error).message) };
    }
  }

  async getById(id: string): Promise<Result<Customer, DomainError>> {
    const centerRes = getCenterIdFor("Customer.getById");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('customers')
        .select('*')
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Customer.getById", error.message) };
      if (!data) return { ok: false, error: { name: "DomainError", message: "Not found", code: "NOT_FOUND" } };
      return { ok: true, data: mapCustomer(data) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Customer.getById", (e as Error).message) };
    }
  }

  async create(data: Partial<Customer>): Promise<Result<Customer, DomainError>> {
    const centerRes = getCenterIdFor("Customer.create");
    if (!centerRes.ok) return centerRes as any;
    try {
      const payload: Record<string, unknown> = {
        center_id: centerRes.data,
        name: data.name,
        category: data.category,
        phone: data.phone,
        email: data.email,
        notes: data.notes,
        total_spent: data.totalSpent,
        loyalty_points: data.loyaltyPoints,
      };

      const { data: row, error } = await getSupabaseClient()
        .from('customers')
        .insert(payload)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Customer.create", error.message) };
      if (!row) return { ok: false, error: createQueryError("Customer.create", "No data returned after insert") };
      return { ok: true, data: mapCustomer(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Customer.create", (e as Error).message) };
    }
  }

  async update(id: string, data: Partial<Customer>): Promise<Result<Customer, DomainError>> {
    const centerRes = getCenterIdFor("Customer.update");
    if (!centerRes.ok) return centerRes as any;
    try {
      const payload: Record<string, unknown> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.category !== undefined) payload.category = data.category;
      if (data.phone !== undefined) payload.phone = data.phone;
      if (data.email !== undefined) payload.email = data.email;
      if (data.notes !== undefined) payload.notes = data.notes;
      if (data.totalSpent !== undefined) payload.total_spent = data.totalSpent;
      if (data.loyaltyPoints !== undefined) payload.loyalty_points = data.loyaltyPoints;
      
      // Explicitly delete center_id from payload if it exists to prevent tenant reassignment
      delete payload.center_id;

      const { data: row, error } = await getSupabaseClient()
        .from('customers')
        .update(payload)
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Customer.update", error.message) };
      if (!row) return { ok: false, error: createQueryError("Customer.update", "No data returned after update") };
      return { ok: true, data: mapCustomer(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Customer.update", (e as Error).message) };
    }
  }

  async rotatePortalToken(id: string): Promise<Result<{ customerId: string; portalAccessToken: string }, DomainError>> {
    const centerRes = getCenterIdFor("Customer.rotatePortalToken");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc('rotate_customer_portal_token_v1', {
        p_center_id: centerRes.data,
        p_customer_id: id,
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) {
          return { ok: false, error: createUnsupportedWriteError("Customer.rotatePortalToken") };
        }
        return { ok: false, error: createQueryError("Customer.rotatePortalToken", error.message) };
      }
      const row = (data || {}) as any;
      if (!row.customer_id || !row.portal_access_token) {
        return { ok: false, error: createQueryError("Customer.rotatePortalToken", "Invalid response from portal token RPC") };
      }
      return { ok: true, data: { customerId: String(row.customer_id), portalAccessToken: String(row.portal_access_token) } };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Customer.rotatePortalToken", (e as Error).message) };
    }
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    const centerRes = getCenterIdFor("Customer.delete");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { error } = await getSupabaseClient()
        .from('customers')
        .delete()
        .eq('id', id)
        .eq('center_id', centerRes.data);

      if (error) return { ok: false, error: createQueryError("Customer.delete", error.message) };
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Customer.delete", (e as Error).message) };
    }
  }

  async getHistory(id: string): Promise<Result<{ appointments: Appointment[], invoices: Invoice[] }, DomainError>> {
    const centerRes = getCenterIdFor("Customer.getHistory");
    if (!centerRes.ok) return centerRes as any;
    try {
      const client = getSupabaseClient();
      const [apptsRes, invsRes] = await Promise.all([
        client.from('appointments').select('*').eq('customer_id', id).eq('center_id', centerRes.data).order('date_time', { ascending: false }),
        client.from('invoices').select('*').eq('customer_id', id).eq('center_id', centerRes.data).order('date', { ascending: false })
      ]);

      if (apptsRes.error) return { ok: false, error: createQueryError("Customer.getHistory", apptsRes.error.message) };
      if (invsRes.error) return { ok: false, error: createQueryError("Customer.getHistory", invsRes.error.message) };

      return {
        ok: true,
        data: {
          appointments: (apptsRes.data || []).map(mapAppointment),
          invoices: (invsRes.data || []).map(mapInvoice)
        }
      };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Customer.getHistory", (e as Error).message) };
    }
  }
}

class SupabaseEmployeeAdapter implements EmployeeRepository {
  async list(): Promise<Result<Employee[], DomainError>> {
    const centerRes = getCenterIdFor("Employee.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('employees')
        .select('*')
        .eq('center_id', centerRes.data)
        .order('name', { ascending: true });

      if (error) return { ok: false, error: createQueryError("Employee.list", error.message) };
      return { ok: true, data: data.map(mapEmployee) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Employee.list", (e as Error).message) };
    }
  }

  async create(data: Partial<Employee>): Promise<Result<Employee, DomainError>> {
    const centerRes = getCenterIdFor("Employee.create");
    if (!centerRes.ok) return centerRes as any;
    try {
      const payload: Record<string, unknown> = {
        center_id: centerRes.data,
        name: data.name,
        phone: data.phone,
        role: data.role,
        salary: data.salary,
        base_salary: data.baseSalary,
        commission_percentage: data.commissionPercentage,
        is_active: data.isActive !== undefined ? data.isActive : true
      };
      const { data: row, error } = await getSupabaseClient()
        .from('employees')
        .insert(payload)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Employee.create", error.message) };
      if (!row) return { ok: false, error: createQueryError("Employee.create", "No data returned") };
      return { ok: true, data: mapEmployee(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Employee.create", (e as Error).message) };
    }
  }

  async update(id: string, data: Partial<Employee>): Promise<Result<Employee, DomainError>> {
    const centerRes = getCenterIdFor("Employee.update");
    if (!centerRes.ok) return centerRes as any;
    try {
      const payload: Record<string, unknown> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.phone !== undefined) payload.phone = data.phone;
      if (data.role !== undefined) payload.role = data.role;
      if (data.salary !== undefined) payload.salary = data.salary;
      if (data.baseSalary !== undefined) payload.base_salary = data.baseSalary;
      if (data.commissionPercentage !== undefined) payload.commission_percentage = data.commissionPercentage;
      if (data.isActive !== undefined) payload.is_active = data.isActive;

      delete payload.center_id;

      const { data: row, error } = await getSupabaseClient()
        .from('employees')
        .update(payload)
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Employee.update", error.message) };
      if (!row) return { ok: false, error: createQueryError("Employee.update", "No data returned") };
      return { ok: true, data: mapEmployee(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Employee.update", (e as Error).message) };
    }
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    const centerRes = getCenterIdFor("Employee.delete");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { error } = await getSupabaseClient()
        .from('employees')
        .delete()
        .eq('id', id)
        .eq('center_id', centerRes.data);

      if (error) return { ok: false, error: createQueryError("Employee.delete", error.message) };
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Employee.delete", (e as Error).message) };
    }
  }
}

class SupabaseServiceAdapter implements ServiceRepository {
  async list(): Promise<Result<Service[], DomainError>> {
    const centerRes = getCenterIdFor("Service.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('services')
        .select('*')
        .eq('center_id', centerRes.data)
        .order('name', { ascending: true });

      if (error) return { ok: false, error: createQueryError("Service.list", error.message) };
      return { ok: true, data: data.map(mapService) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Service.list", (e as Error).message) };
    }
  }

  async create(data: Partial<Service>): Promise<Result<Service, DomainError>> {
    const centerRes = getCenterIdFor("Service.create");
    if (!centerRes.ok) return centerRes as any;
    try {
      const payload: Record<string, unknown> = {
        center_id: centerRes.data,
        name: data.name,
        category_id: data.categoryId || null,
        price: data.price,
        duration_minutes: data.durationMinutes,
        is_active: data.isActive !== undefined ? data.isActive : true
      };

      const { data: row, error } = await getSupabaseClient()
        .from('services')
        .insert(payload)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Service.create", error.message) };
      if (!row) return { ok: false, error: createQueryError("Service.create", "No data returned after insert") };
      return { ok: true, data: mapService(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Service.create", (e as Error).message) };
    }
  }

  async update(id: string, data: Partial<Service>): Promise<Result<Service, DomainError>> {
    const centerRes = getCenterIdFor("Service.update");
    if (!centerRes.ok) return centerRes as any;
    try {
      const payload: Record<string, unknown> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.categoryId !== undefined) payload.category_id = data.categoryId || null;
      if (data.price !== undefined) payload.price = data.price;
      if (data.durationMinutes !== undefined) payload.duration_minutes = data.durationMinutes;
      if (data.isActive !== undefined) payload.is_active = data.isActive;

      delete payload.center_id;

      const { data: row, error } = await getSupabaseClient()
        .from('services')
        .update(payload)
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Service.update", error.message) };
      if (!row) return { ok: false, error: createQueryError("Service.update", "No data returned after update") };
      return { ok: true, data: mapService(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Service.update", (e as Error).message) };
    }
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    const centerRes = getCenterIdFor("Service.delete");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { error } = await getSupabaseClient()
        .from('services')
        .delete()
        .eq('id', id)
        .eq('center_id', centerRes.data);

      if (error) return { ok: false, error: createQueryError("Service.delete", error.message) };
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Service.delete", (e as Error).message) };
    }
  }
}

class SupabaseAppointmentAdapter implements AppointmentRepository {
  async list(range: { fromISO: string, toISO: string }): Promise<Result<Appointment[], DomainError>> {
    const centerRes = getCenterIdFor("Appointment.list");
    if (!centerRes.ok) return centerRes as any;

    try {
      const { data, error } = await getSupabaseClient()
        .from('appointments')
        .select('*')
        .eq('center_id', centerRes.data)
        .gte('date_time', range.fromISO)
        .lte('date_time', range.toISO)
        .order('date_time', { ascending: true });

      if (error) return { ok: false, error: createQueryError("Appointment.list", error.message) };
      return { ok: true, data: data.map(mapAppointment) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Appointment.list", (e as Error).message) };
    }
  }

  async create(data: Partial<Appointment>): Promise<Result<Appointment, DomainError>> {
    const centerRes = getCenterIdFor("Appointment.create");
    if (!centerRes.ok) return centerRes as any;
    
    try {
      const payload: Record<string, unknown> = {
        center_id: centerRes.data,
        customer_id: data.customerId,
        employee_id: data.employeeId,
        service_id: data.serviceId,
        date_time: data.dateTime?.toISOString(),
        status: data.status || 'SCHEDULED', // Map AppointmentStatus
        notes: data.notes,
        deposit_amount: data.depositAmount ?? 0,
        no_show_fee_amount: data.noShowFeeAmount ?? 0,
        no_show_note: data.noShowNote
      };

      const { data: row, error } = await getSupabaseClient()
        .from('appointments')
        .insert(payload)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Appointment.create", error.message) };
      if (!row) return { ok: false, error: createQueryError("Appointment.create", "No data returned") };
      return { ok: true, data: mapAppointment(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Appointment.create", (e as Error).message) };
    }
  }

  async update(id: string, data: Partial<Appointment>): Promise<Result<Appointment, DomainError>> {
    const centerRes = getCenterIdFor("Appointment.update");
    if (!centerRes.ok) return centerRes as any;
    try {
      const payload: Record<string, unknown> = {};
      if (data.customerId !== undefined) payload.customer_id = data.customerId;
      if (data.employeeId !== undefined) payload.employee_id = data.employeeId;
      if (data.serviceId !== undefined) payload.service_id = data.serviceId;
      if (data.dateTime !== undefined) payload.date_time = data.dateTime.toISOString();
      if (data.status !== undefined) payload.status = data.status;
      if (data.notes !== undefined) payload.notes = data.notes;
      if (data.depositAmount !== undefined) payload.deposit_amount = data.depositAmount;
      if (data.noShowFeeAmount !== undefined) payload.no_show_fee_amount = data.noShowFeeAmount;
      if (data.noShowFeeCharged !== undefined) payload.no_show_fee_charged = data.noShowFeeCharged;
      if (data.noShowMarkedAt !== undefined) payload.no_show_marked_at = data.noShowMarkedAt?.toISOString();
      if (data.noShowNote !== undefined) payload.no_show_note = data.noShowNote;

      delete payload.center_id;

      const { data: row, error } = await getSupabaseClient()
        .from('appointments')
        .update(payload)
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Appointment.update", error.message) };
      if (!row) return { ok: false, error: createQueryError("Appointment.update", "No data returned") };
      return { ok: true, data: mapAppointment(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Appointment.update", (e as Error).message) };
    }
  }

  async markNoShow(id: string, input?: { chargeNoShowFee?: boolean; note?: string }): Promise<Result<{ appointment: Appointment; chargedAmount: number }, DomainError>> {
    const centerRes = getCenterIdFor("Appointment.markNoShow");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc('mark_appointment_no_show_v1', {
        p_center_id: centerRes.data,
        p_appointment_id: id,
        p_charge_no_show_fee: input?.chargeNoShowFee ?? true,
        p_note: input?.note || null,
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) {
          return { ok: false, error: createUnsupportedWriteError("Appointment.markNoShow") };
        }
        return { ok: false, error: createQueryError("Appointment.markNoShow", error.message) };
      }
      const row = (data || {}) as any;
      if (!row.appointment) return { ok: false, error: createQueryError("Appointment.markNoShow", "Invalid response from no-show RPC") };
      return {
        ok: true,
        data: {
          appointment: mapAppointment(row.appointment),
          chargedAmount: Number(row.charged_amount) || 0,
        }
      };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Appointment.markNoShow", (e as Error).message) };
    }
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    const centerRes = getCenterIdFor("Appointment.delete");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { error } = await getSupabaseClient()
        .from('appointments')
        .delete()
        .eq('id', id)
        .eq('center_id', centerRes.data);

      if (error) return { ok: false, error: createQueryError("Appointment.delete", error.message) };
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Appointment.delete", (e as Error).message) };
    }
  }
}

class SupabaseProductAdapter implements ProductRepository {
  async list(): Promise<Result<Product[], DomainError>> {
    const centerRes = getCenterIdFor("Product.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('products')
        .select('*')
        .eq('center_id', centerRes.data)
        .order('name', { ascending: true });

      if (error) return { ok: false, error: createQueryError("Product.list", error.message) };
      return { ok: true, data: data.map(mapProduct) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Product.list", (e as Error).message) };
    }
  }

  async listFull(): Promise<Result<Product[], DomainError>> {
    return this.list(); // Same mapped entity for now
  }

  async create(data: Partial<Product>): Promise<Result<Product, DomainError>> {
    const centerRes = getCenterIdFor("Product.create");
    if (!centerRes.ok) return centerRes as any;
    try {
      const payload: Record<string, unknown> = {
        center_id: centerRes.data,
        name: data.name,
        barcode: data.barcode,
        stock_quantity: data.stockQuantity || 0,
        price: data.price || 0,
        cost: data.cost || 0
      };

      const { data: row, error } = await getSupabaseClient()
        .from('products')
        .insert(payload)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Product.create", error.message) };
      if (!row) return { ok: false, error: createQueryError("Product.create", "No data returned") };
      return { ok: true, data: mapProduct(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Product.create", (e as Error).message) };
    }
  }

  async update(id: string, data: Partial<Product>): Promise<Result<Product, DomainError>> {
    const centerRes = getCenterIdFor("Product.update");
    if (!centerRes.ok) return centerRes as any;
    try {
      const payload: Record<string, unknown> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.barcode !== undefined) payload.barcode = data.barcode;
      if (data.stockQuantity !== undefined) payload.stock_quantity = data.stockQuantity;
      if (data.price !== undefined) payload.price = data.price;
      if (data.cost !== undefined) payload.cost = data.cost;

      delete payload.center_id;

      const { data: row, error } = await getSupabaseClient()
        .from('products')
        .update(payload)
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Product.update", error.message) };
      if (!row) return { ok: false, error: createQueryError("Product.update", "No data returned") };
      return { ok: true, data: mapProduct(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Product.update", (e as Error).message) };
    }
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    const centerRes = getCenterIdFor("Product.delete");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { error } = await getSupabaseClient()
        .from('products')
        .delete()
        .eq('id', id)
        .eq('center_id', centerRes.data);

      if (error) return { ok: false, error: createQueryError("Product.delete", error.message) };
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Product.delete", (e as Error).message) };
    }
  }
}

class SupabaseExpenseAdapter implements ExpenseRepository {
  async list(): Promise<Result<Expense[], DomainError>> {
    const centerRes = getCenterIdFor("Expense.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('expenses')
        .select('*')
        .eq('center_id', centerRes.data)
        .order('date', { ascending: false });

      if (error) return { ok: false, error: createQueryError("Expense.list", error.message) };
      return { ok: true, data: data.map(mapExpense) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Expense.list", (e as Error).message) };
    }
  }

  async create(data: Partial<Expense>): Promise<Result<Expense, DomainError>> {
    const centerRes = getCenterIdFor("Expense.create");
    if (!centerRes.ok) return centerRes as any;
    try {
      const payload: Record<string, unknown> = {
        center_id: centerRes.data,
        amount: data.amount || 0,
        category: data.category,
        description: data.description,
        date: data.date?.toISOString() || new Date().toISOString()
      };

      const { data: row, error } = await getSupabaseClient()
        .from('expenses')
        .insert(payload)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Expense.create", error.message) };
      if (!row) return { ok: false, error: createQueryError("Expense.create", "No data returned") };
      return { ok: true, data: mapExpense(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Expense.create", (e as Error).message) };
    }
  }

  async update(id: string, data: Partial<Expense>): Promise<Result<Expense, DomainError>> {
    const centerRes = getCenterIdFor("Expense.update");
    if (!centerRes.ok) return centerRes as any;
    try {
      const payload: Record<string, unknown> = {};
      if (data.amount !== undefined) payload.amount = data.amount;
      if (data.category !== undefined) payload.category = data.category;
      if (data.description !== undefined) payload.description = data.description;
      if (data.date !== undefined) payload.date = data.date.toISOString();

      delete payload.center_id;

      const { data: row, error } = await getSupabaseClient()
        .from('expenses')
        .update(payload)
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Expense.update", error.message) };
      if (!row) return { ok: false, error: createQueryError("Expense.update", "No data returned") };
      return { ok: true, data: mapExpense(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Expense.update", (e as Error).message) };
    }
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    const centerRes = getCenterIdFor("Expense.delete");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { error } = await getSupabaseClient()
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('center_id', centerRes.data);

      if (error) return { ok: false, error: createQueryError("Expense.delete", error.message) };
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Expense.delete", (e as Error).message) };
    }
  }
}

class SupabaseInvoiceAdapter implements InvoiceRepository {
  async checkout(payload: CheckoutPayload): Promise<Result<{ invoice: Invoice, total: number, earned: number }, DomainError>> {
    const centerRes = getCenterIdFor("Invoice.checkout");
    if (!centerRes.ok) return centerRes as any;

    try {
      const { data, error } = await getSupabaseClient().rpc('process_checkout_v1', {
        p_center_id: centerRes.data,
        p_customer_id: payload.customerId,
        p_employee_id: payload.employeeId || null,
        p_payment_method: payload.paymentMethod,
        p_discount_amount: payload.discountAmount || 0,
        p_use_loyalty_points: payload.useLoyaltyPoints || false,
        p_items: payload.items,
        p_gift_card_code: payload.giftCardCode || null
      });
      
      if (error) {
        // Handle missing RPC function specifically.
        // PostgREST returns PGRST202 or Postgres returns 42883 if not found.
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) {
           return { ok: false, error: createUnsupportedWriteError("Invoice.checkout") };
        }
        return { ok: false, error: createQueryError("Invoice.checkout", error.message) };
      }
      
      if (!data || typeof data !== 'object') {
         return { ok: false, error: createQueryError("Invoice.checkout", "Invalid response from checkout RPC") };
      }

      return { 
        ok: true, 
        data: {
          invoice: mapInvoice((data as any).invoice),
          total: Number((data as any).total) || 0,
          earned: Number((data as any).earned) || 0
        }
      };

    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Invoice.checkout", (e as Error).message) };
    }
  }

  async getForPrint(id: string): Promise<Result<InvoicePrintData, DomainError>> {
    const centerRes = getCenterIdFor("Invoice.getForPrint");
    if (!centerRes.ok) return centerRes as any;

    try {
      const client = getSupabaseClient();
      const [invoiceRes, itemRes, settingsRes] = await Promise.all([
        client
          .from('invoices')
          .select('*')
          .eq('id', id)
          .eq('center_id', centerRes.data)
          .maybeSingle(),
        client
          .from('invoice_items')
          .select(`
            *,
            services (name),
            products (name)
          `)
          .eq('invoice_id', id)
          .order('created_at', { ascending: true }),
        client
          .from('center_settings')
          .select('*')
          .eq('center_id', centerRes.data)
          .maybeSingle()
      ]);

      if (invoiceRes.error) {
        if (isMissingBackendFeature(invoiceRes.error)) return { ok: false, error: createUnsupportedReadError("Invoice.getForPrint") };
        return { ok: false, error: createQueryError("Invoice.getForPrint", invoiceRes.error.message) };
      }
      if (itemRes.error) {
        if (isMissingBackendFeature(itemRes.error)) return { ok: false, error: createUnsupportedReadError("Invoice.getForPrint") };
        return { ok: false, error: createQueryError("Invoice.getForPrint", itemRes.error.message) };
      }
      if (settingsRes.error) return { ok: false, error: createQueryError("Invoice.getForPrint", settingsRes.error.message) };
      if (!invoiceRes.data) return { ok: false, error: { name: "DomainError", message: "Not found", code: "NOT_FOUND" } };

      const invoice = mapInvoice(invoiceRes.data);
      let customer: Customer | undefined;
      if (invoice.customerId) {
        const customerRes = await client
          .from('customers')
          .select('*')
          .eq('id', invoice.customerId)
          .eq('center_id', centerRes.data)
          .maybeSingle();
        if (customerRes.error) return { ok: false, error: createQueryError("Invoice.getForPrint", customerRes.error.message) };
        customer = customerRes.data ? mapCustomer(customerRes.data) : undefined;
      }

      const items = (itemRes.data || []).map((row: any) => {
        const item = mapInvoiceItem(row);
        const type: "service" | "product" = item.serviceId ? "service" : "product";
        const joinedName = item.serviceId ? row.services?.name : row.products?.name;
        return {
          id: item.id,
          type,
          name: typeof joinedName === "string" ? joinedName : type === "service" ? "Service" : "Product",
          price: item.price,
          qty: item.quantity
        };
      });

      return {
        ok: true,
        data: {
          invoice,
          items,
          customer,
          settings: settingsRes.data ? mapCenterSettings(settingsRes.data) : undefined
        }
      };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Invoice.getForPrint", (e as Error).message) };
    }
  }
}

class SupabaseSettingsAdapter implements SettingsRepository {
  async get(): Promise<Result<CenterSettings, DomainError>> {
    const centerRes = getCenterIdFor("Settings.get");
    if (!centerRes.ok) return centerRes as any;
    try {
      // Assuming a single row per tenant via RLS
      const { data, error } = await getSupabaseClient()
        .from('center_settings')
        .select('*')
        .eq('center_id', centerRes.data)
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Settings.get", error.message) };
      if (!data) return { ok: false, error: { name: "DomainError", message: "Not found", code: "NOT_FOUND" } };
      return { ok: true, data: mapCenterSettings(data) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Settings.get", (e as Error).message) };
    }
  }
  async update(data: Partial<CenterSettings>): Promise<Result<CenterSettings, DomainError>> {
    const centerRes = getCenterIdFor("Settings.update");
    if (!centerRes.ok) return centerRes as any;
    try {
      const payload: Record<string, unknown> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.currency !== undefined) payload.currency = data.currency;
      if (data.taxRate !== undefined) payload.tax_rate = data.taxRate;
      if (data.logoPath !== undefined) payload.logo_path = data.logoPath;
      if (data.address !== undefined) payload.address = data.address;
      if (data.phone !== undefined) payload.phone = data.phone;
      if (data.cr !== undefined) payload.cr = data.cr;
      if (data.postalCode !== undefined) payload.postal_code = data.postalCode;

      delete payload.center_id;

      const { data: row, error } = await getSupabaseClient()
        .from('center_settings')
        .update(payload)
        .eq('center_id', centerRes.data)
        .select()
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Settings.update", error.message) };
      if (!row) return { ok: false, error: createQueryError("Settings.update", "No data returned after update") };
      return { ok: true, data: mapCenterSettings(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Settings.update", (e as Error).message) };
    }
  }
  async uploadLogo(file: File): Promise<Result<{ logoPath: string }, DomainError>> {
    const centerRes = getCenterIdFor("Settings.uploadLogo");
    if (!centerRes.ok) return centerRes as any;
    try {
      const client: any = getSupabaseClient();
      if (!client.storage?.from) return { ok: false, error: createUnsupportedWriteError("Settings.uploadLogo") };
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const logoPath = `${centerRes.data}/logo-${Date.now()}-${safeName}`;
      const { error } = await client.storage.from('center-assets').upload(logoPath, file, { upsert: true });
      if (error) return { ok: false, error: createQueryError("Settings.uploadLogo", error.message) };
      const updateRes = await this.update({ logoPath });
      if (!updateRes.ok) return updateRes as any;
      return { ok: true, data: { logoPath } };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Settings.uploadLogo", (e as Error).message) };
    }
  }
  async backup(): Promise<Result<{ message: string }, DomainError>> {
    const exported = await this.exportData();
    if (!exported.ok) return exported as any;
    return { ok: true, data: { message: JSON.stringify(exported.data) } };
  }
  async exportData(): Promise<Result<BackupPayload, DomainError>> {
    const centerRes = getCenterIdFor("Settings.exportData");
    if (!centerRes.ok) return centerRes as any;
    try {
      const client = getSupabaseClient();
      const [customers, employees, services, appointments, products, expenses, settings, invoices] = await Promise.all([
        client.from('customers').select('*').eq('center_id', centerRes.data),
        client.from('employees').select('*').eq('center_id', centerRes.data),
        client.from('services').select('*').eq('center_id', centerRes.data),
        client.from('appointments').select('*').eq('center_id', centerRes.data),
        client.from('products').select('*').eq('center_id', centerRes.data),
        client.from('expenses').select('*').eq('center_id', centerRes.data),
        client.from('center_settings').select('*').eq('center_id', centerRes.data).maybeSingle(),
        client.from('invoices').select('*').eq('center_id', centerRes.data)
      ]);

      const responses = [customers, employees, services, appointments, products, expenses, settings, invoices];
      for (const response of responses) {
        if (response.error) {
          if (isMissingBackendFeature(response.error)) return { ok: false, error: createUnsupportedReadError("Settings.exportData") };
          return { ok: false, error: createQueryError("Settings.exportData", response.error.message) };
        }
      }

      return {
        ok: true,
        data: {
          version: "1.0.0",
          timestamp: new Date().toISOString(),
          data: {
            customers: (customers.data || []).map(mapCustomer),
            employees: (employees.data || []).map(mapEmployee),
            services: (services.data || []).map(mapService),
            appointments: (appointments.data || []).map(mapAppointment),
            products: (products.data || []).map(mapProduct),
            expenses: (expenses.data || []).map(mapExpense),
            settings: settings.data ? mapCenterSettings(settings.data) : undefined,
            invoices: (invoices.data || []).map(mapInvoice)
          }
        }
      };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Settings.exportData", (e as Error).message) };
    }
  }
  async getNotificationSettings(): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("Settings.getNotificationSettings");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('notification_settings')
        .select('*')
        .eq('center_id', centerRes.data)
        .maybeSingle();
      if (error) return { ok: false, error: createQueryError("Settings.getNotificationSettings", error.message) };
      if (!data) return { ok: false, error: { name: "DomainError", message: "Not found", code: "NOT_FOUND" } };
      return { ok: true, data: mapNotificationSettings(data) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Settings.getNotificationSettings", (e as Error).message) };
    }
  }

  async updateNotificationSettings(data: any): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("Settings.updateNotificationSettings");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data: row, error } = await getSupabaseClient().rpc('upsert_notification_settings_v1', {
        p_center_id: centerRes.data,
        p_whatsapp_enabled: data.whatsappEnabled,
        p_sms_enabled: data.smsEnabled,
        p_reminder_enabled: data.reminderEnabled,
        p_reminder_hours_before: data.reminderHoursBefore,
        p_whatsapp_sender_name: data.whatsappSenderName || null,
        p_sms_sender_name: data.smsSenderName || null,
        p_whatsapp_template_booking: data.whatsappTemplateBooking || null,
        p_whatsapp_template_reminder: data.whatsappTemplateReminder || null,
        p_sms_template_reminder: data.smsTemplateReminder || null,
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) {
          return { ok: false, error: createUnsupportedWriteError("Settings.updateNotificationSettings") };
        }
        return { ok: false, error: createQueryError("Settings.updateNotificationSettings", error.message) };
      }
      if (!(row as any)?.notification_settings) return { ok: false, error: createQueryError("Settings.updateNotificationSettings", "Invalid response from notification settings RPC") };
      return { ok: true, data: mapNotificationSettings((row as any).notification_settings) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Settings.updateNotificationSettings", (e as Error).message) };
    }
  }

  async getPaymentGatewaySettings(): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("Settings.getPaymentGatewaySettings");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('payment_gateway_settings')
        .select('*')
        .eq('center_id', centerRes.data)
        .maybeSingle();
      if (error) return { ok: false, error: createQueryError("Settings.getPaymentGatewaySettings", error.message) };
      if (!data) return { ok: false, error: { name: "DomainError", message: "Not found", code: "NOT_FOUND" } };
      return { ok: true, data: mapPaymentGatewaySettings(data) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Settings.getPaymentGatewaySettings", (e as Error).message) };
    }
  }

  async updatePaymentGatewaySettings(data: any): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("Settings.updatePaymentGatewaySettings");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data: row, error } = await getSupabaseClient().rpc('upsert_payment_gateway_settings_v1', {
        p_center_id: centerRes.data,
        p_provider: data.provider,
        p_is_enabled: data.isEnabled,
        p_is_sandbox: data.isSandbox,
        p_public_key: data.publicKey || null,
        p_merchant_identifier: data.merchantIdentifier || null,
        p_webhook_secret_hint: data.webhookSecretHint || null,
        p_booking_deposit_enabled: data.bookingDepositEnabled,
        p_booking_deposit_type: data.bookingDepositType,
        p_booking_deposit_value: data.bookingDepositValue,
        p_success_url: data.successUrl || null,
        p_cancel_url: data.cancelUrl || null,
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) {
          return { ok: false, error: createUnsupportedWriteError("Settings.updatePaymentGatewaySettings") };
        }
        return { ok: false, error: createQueryError("Settings.updatePaymentGatewaySettings", error.message) };
      }
      if (!(row as any)?.payment_gateway_settings) return { ok: false, error: createQueryError("Settings.updatePaymentGatewaySettings", "Invalid response from payment gateway RPC") };
      return { ok: true, data: mapPaymentGatewaySettings((row as any).payment_gateway_settings) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Settings.updatePaymentGatewaySettings", (e as Error).message) };
    }
  }

  async restore(data: BackupPayload): Promise<Result<void, DomainError>> {
    if (!validateBackupPayload(data)) {
      return { ok: false, error: { name: "DomainError", message: "Invalid backup payload", code: "VALIDATION_ERROR" } };
    }

    const centerRes = getCenterIdFor("Settings.restore");
    if (!centerRes.ok) return centerRes as any;
    const centerId = centerRes.data;

    try {
      const client = getSupabaseClient();
      const d = data.data || {};

      // Stamp every row with the active center so a backup can only ever be
      // restored into the caller's own tenant (RLS also enforces this).
      const withCenter = <T extends Record<string, any>>(rows: T[] | undefined): any[] =>
        (rows || []).map((r) => ({ ...r, center_id: centerId }));

      // Customers
      if (d.customers?.length) {
        const rows = withCenter(
          d.customers.map((c) => ({
            id: c.id,
            name: c.name,
            category: c.category ?? null,
            phone: c.phone ?? null,
            email: c.email ?? null,
            notes: c.notes ?? null,
            total_spent: c.totalSpent ?? 0,
            loyalty_points: c.loyaltyPoints ?? 0,
          }))
        );
        const { error } = await client.from("customers").upsert(rows, { onConflict: "id" });
        if (error) return { ok: false, error: createQueryError("Settings.restore", error.message) };
      }

      // Employees
      if (d.employees?.length) {
        const rows = withCenter(
          d.employees.map((e) => ({
            id: e.id,
            name: e.name,
            role: e.role,
            phone: e.phone ?? null,
            salary: e.salary ?? 0,
            base_salary: e.baseSalary ?? 0,
            commission_percentage: e.commissionPercentage ?? 0,
            is_active: e.isActive ?? true,
          }))
        );
        const { error } = await client.from("employees").upsert(rows, { onConflict: "id" });
        if (error) return { ok: false, error: createQueryError("Settings.restore", error.message) };
      }

      // Services
      if (d.services?.length) {
        const rows = withCenter(
          d.services.map((s) => ({
            id: s.id,
            name: s.name,
            category_id: s.categoryId ?? null,
            price: s.price ?? 0,
            duration_minutes: s.durationMinutes ?? 30,
            is_active: s.isActive ?? true,
          }))
        );
        const { error } = await client.from("services").upsert(rows, { onConflict: "id" });
        if (error) return { ok: false, error: createQueryError("Settings.restore", error.message) };
      }

      // Products
      if (d.products?.length) {
        const rows = withCenter(
          d.products.map((p) => ({
            id: p.id,
            name: p.name,
            barcode: p.barcode ?? null,
            price: p.price ?? 0,
            cost: p.cost ?? 0,
            stock_quantity: p.stockQuantity ?? 0,
          }))
        );
        const { error } = await client.from("products").upsert(rows, { onConflict: "id" });
        if (error) return { ok: false, error: createQueryError("Settings.restore", error.message) };
      }

      // Expenses
      if (d.expenses?.length) {
        const rows = withCenter(
          d.expenses.map((x) => ({
            id: x.id,
            amount: x.amount ?? 0,
            category: x.category,
            description: x.description ?? null,
            date: x.date instanceof Date ? x.date.toISOString() : x.date,
          }))
        );
        const { error } = await client.from("expenses").upsert(rows, { onConflict: "id" });
        if (error) return { ok: false, error: createQueryError("Settings.restore", error.message) };
      }

      // Center settings (single row, keyed by center_id)
      if (d.settings) {
        const s = d.settings;
        const { error } = await client
          .from("center_settings")
          .update({
            name: s.name,
            currency: s.currency,
            tax_rate: s.taxRate ?? 0,
            logo_path: s.logoPath ?? null,
            address: s.address ?? null,
            phone: s.phone ?? null,
            cr: s.cr ?? null,
            postal_code: s.postalCode ?? null,
          })
          .eq("center_id", centerId);
        if (error) return { ok: false, error: createQueryError("Settings.restore", error.message) };
      }

      // NOTE: invoices/invoice_items are intentionally NOT restored — they are
      // financial records created only via the checkout RPC and protected by
      // deny-direct-insert RLS. Restoring them would bypass integrity controls.

      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Settings.restore", (e as Error).message) };
    }
  }
}

class SupabaseDashboardAdapter implements DashboardRepository {
  async getSummary(): Promise<Result<DashboardSummary, DomainError>> {
    const centerRes = getCenterIdFor("Dashboard.getSummary");
    if (!centerRes.ok) return centerRes as any;

    try {
      const client = getSupabaseClient();
      
      const [custRes, apptRes, prodRes, invoiceRes] = await Promise.all([
        client.from('customers').select('*', { count: 'exact', head: true }).eq('center_id', centerRes.data),
        client.from('appointments').select('*', { count: 'exact', head: true }).eq('center_id', centerRes.data),
        client.from('products').select('*', { count: 'exact', head: true }).eq('center_id', centerRes.data).lte('stock_quantity', 5),
        client.from('invoices').select('total_amount').eq('center_id', centerRes.data).gte('date', toDateOnly(new Date()))
      ]);

      if (custRes.error) throw new Error(custRes.error.message);
      if (apptRes.error) throw new Error(apptRes.error.message);
      if (prodRes.error) throw new Error(prodRes.error.message);

      const data: DashboardSummary = {
        customers: custRes.count || 0,
        appointments: apptRes.count || 0,
        sales: 0,
        revenue: 0,
        canViewRevenue: false,
        lowStockCount: prodRes.count || 0,
      };

      if (!invoiceRes.error) {
        const revenue = (invoiceRes.data || []).reduce((sum: number, row: any) => sum + Number(row.total_amount || 0), 0);
        data.sales = invoiceRes.data?.length || 0;
        data.revenue = revenue;
        data.todayRevenue = revenue;
        data.canViewRevenue = true;
      } else if (!isMissingBackendFeature(invoiceRes.error)) {
        throw new Error(invoiceRes.error.message);
      }

      return { ok: true, data };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Dashboard.getSummary", (e as Error).message) };
    }
  }
  async getPnlMonth(): Promise<Result<PnlData, DomainError>> {
    const centerRes = getCenterIdFor("Dashboard.getPnlMonth");
    if (!centerRes.ok) return centerRes as any;
    try {
      const client = getSupabaseClient();
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const [invoiceRes, expenseRes, employeeRes] = await Promise.all([
        client.from('invoices').select('total_amount').eq('center_id', centerRes.data).gte('date', from).lt('date', to),
        client.from('expenses').select('amount').eq('center_id', centerRes.data).gte('date', from).lt('date', to),
        client.from('employees').select('base_salary, salary, commission_percentage, month_commission_total').eq('center_id', centerRes.data).eq('is_active', true)
      ]);

      for (const response of [invoiceRes, expenseRes, employeeRes]) {
        if (response.error) {
          if (isMissingBackendFeature(response.error)) return { ok: false, error: createUnsupportedReadError("Dashboard.getPnlMonth") };
          return { ok: false, error: createQueryError("Dashboard.getPnlMonth", response.error.message) };
        }
      }

      const revenue = (invoiceRes.data || []).reduce((sum: number, row: any) => sum + Number(row.total_amount || 0), 0);
      const expenses = (expenseRes.data || []).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
      const baseSalaries = (employeeRes.data || []).reduce((sum: number, row: any) => sum + Number(row.base_salary ?? row.salary ?? 0), 0);
      const commissions = (employeeRes.data || []).reduce((sum: number, row: any) => sum + Number(row.month_commission_total || 0), 0);

      return {
        ok: true,
        data: {
          revenue,
          baseSalaries,
          commissions,
          expenses,
          profit: revenue - baseSalaries - commissions - expenses
        }
      };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Dashboard.getPnlMonth", (e as Error).message) };
    }
  }
  async getRevenueLast7Days(): Promise<Result<ChartData[], DomainError>> {
    const centerRes = getCenterIdFor("Dashboard.getRevenueLast7Days");
    if (!centerRes.ok) return centerRes as any;
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 6);
      fromDate.setHours(0, 0, 0, 0);
      const { data, error } = await getSupabaseClient()
        .from('invoices')
        .select('date, total_amount')
        .eq('center_id', centerRes.data)
        .gte('date', fromDate.toISOString())
        .order('date', { ascending: true });

      if (error) {
        if (isMissingBackendFeature(error)) return { ok: false, error: createUnsupportedReadError("Dashboard.getRevenueLast7Days") };
        return { ok: false, error: createQueryError("Dashboard.getRevenueLast7Days", error.message) };
      }

      const buckets = new Map<string, number>();
      for (let i = 0; i < 7; i++) {
        const day = new Date(fromDate);
        day.setDate(fromDate.getDate() + i);
        buckets.set(toDateOnly(day), 0);
      }
      for (const row of data || []) {
        const key = toDateOnly(new Date((row as any).date));
        buckets.set(key, (buckets.get(key) || 0) + Number((row as any).total_amount || 0));
      }

      return { ok: true, data: Array.from(buckets, ([date, revenue]) => ({ date, revenue })) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Dashboard.getRevenueLast7Days", (e as Error).message) };
    }
  }
}

class SupabaseReportAdapter implements ReportRepository {
  async getSales(fromStr: string, toStr: string): Promise<Result<SalesReportRow[], DomainError>> {
    const centerRes = getCenterIdFor("Report.getSales");
    if (!centerRes.ok) return centerRes as any;

    try {
      const { data, error } = await getSupabaseClient()
        .from('invoices')
        .select(`
          *,
          customers (name),
          invoice_items (
            id,
            service_id,
            product_id,
            price,
            quantity,
            services (name),
            products (name)
          )
        `)
        .eq('center_id', centerRes.data)
        .gte('date', fromStr)
        .lte('date', toStr)
        .order('date', { ascending: false });

      if (error) {
        if (isMissingBackendFeature(error)) return { ok: false, error: createUnsupportedReadError("Report.getSales") };
        return { ok: false, error: createQueryError("Report.getSales", error.message) };
      }

      const rows: SalesReportRow[] = (data || []).map((row: any) => {
        const invoice = mapInvoice(row);
        return {
          id: invoice.id,
          date: invoice.date.toISOString(),
          totalAmount: invoice.totalAmount,
          discount: invoice.discount,
          customer: typeof row.customers?.name === "string" ? row.customers.name : undefined,
          items: (row.invoice_items || []).map((itemRow: any) => {
            const item = mapInvoiceItem(itemRow);
            const type: "service" | "product" = item.serviceId ? "service" : "product";
            return {
              id: item.id,
              name: typeof itemRow.services?.name === "string" ? itemRow.services.name : typeof itemRow.products?.name === "string" ? itemRow.products.name : type,
              type,
              price: item.price,
              qty: item.quantity
            };
          })
        };
      });

      return { ok: true, data: rows };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Report.getSales", (e as Error).message) };
    }
  }
  async getAppointments(fromStr: string, toStr: string): Promise<Result<AppointmentReportRow[], DomainError>> {
    const centerRes = getCenterIdFor("Report.getAppointments");
    if (!centerRes.ok) return centerRes as any;

    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('appointments')
        .select(`
          id, date_time, status,
          customer_id, employee_id, service_id,
          customers (name),
          employees (name),
          services (name)
        `)
        .eq('center_id', centerRes.data)
        .gte('date_time', fromStr)
        .lte('date_time', toStr)
        .order('date_time', { ascending: false });

      if (error) return { ok: false, error: createQueryError("Report.getAppointments", error.message) };

      const rows: AppointmentReportRow[] = data.map((d: any) => ({
        id: d.id,
        dateTime: d.date_time,
        status: d.status,
        customer: d.customers ? { name: d.customers.name } : undefined,
        employee: d.employees ? { name: d.employees.name } : undefined,
        service: d.services ? { name: d.services.name } : undefined
      }));

      return { ok: true, data: rows };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Report.getAppointments", (e as Error).message) };
    }
  }
  async getInventory(): Promise<Result<InventoryReportRow[], DomainError>> {
    const centerRes = getCenterIdFor("Report.getInventory");
    if (!centerRes.ok) return centerRes as any;

    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('products')
        .select('id, name, cost, price, stock_quantity')
        .eq('center_id', centerRes.data)
        .order('name', { ascending: true });

      if (error) return { ok: false, error: createQueryError("Report.getInventory", error.message) };

      const rows: InventoryReportRow[] = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        cost: Number(d.cost) || 0,
        price: Number(d.price) || 0,
        stockQuantity: Number(d.stock_quantity) || 0
      }));

      return { ok: true, data: rows };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Report.getInventory", (e as Error).message) };
    }
  }
}

class SupabaseGiftCardAdapter implements GiftCardRepository {
  async list(): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("GiftCard.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('gift_cards')
        .select('*')
        .eq('center_id', centerRes.data)
        .order('created_at', { ascending: false });
      if (error) return { ok: false, error: createQueryError("GiftCard.list", error.message) };
      return { ok: true, data: (data || []).map(mapGiftCard) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("GiftCard.list", (e as Error).message) };
    }
  }

  async issue(input: { code: string; initialBalance: number; customerId?: string; note?: string; expiresAtISO?: string }): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("GiftCard.issue");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc('issue_gift_card_v1', {
        p_center_id: centerRes.data,
        p_code: input.code,
        p_initial_balance: input.initialBalance,
        p_customer_id: input.customerId || null,
        p_note: input.note || null,
        p_expires_at: input.expiresAtISO || null,
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) {
          return { ok: false, error: createUnsupportedWriteError("GiftCard.issue") };
        }
        return { ok: false, error: createQueryError("GiftCard.issue", error.message) };
      }
      const row = (data || {}) as any;
      if (!row.gift_card) return { ok: false, error: createQueryError("GiftCard.issue", "Invalid response from gift card RPC") };
      return { ok: true, data: mapGiftCard(row.gift_card) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("GiftCard.issue", (e as Error).message) };
    }
  }

  async getTransactions(giftCardId: string): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("GiftCard.getTransactions");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('gift_card_transactions')
        .select('*')
        .eq('center_id', centerRes.data)
        .eq('gift_card_id', giftCardId)
        .order('created_at', { ascending: false });
      if (error) return { ok: false, error: createQueryError("GiftCard.getTransactions", error.message) };
      return { ok: true, data: (data || []).map(mapGiftCardTransaction) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("GiftCard.getTransactions", (e as Error).message) };
    }
  }
}

class SupabaseServicePackageAdapter implements ServicePackageRepository {
  async list(): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("ServicePackage.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('service_packages')
        .select(`
          *,
          service_package_items (*)
        `)
        .eq('center_id', centerRes.data)
        .order('created_at', { ascending: false });
      if (error) return { ok: false, error: createQueryError("ServicePackage.list", error.message) };
      return { ok: true, data: (data || []).map(mapServicePackage) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("ServicePackage.list", (e as Error).message) };
    }
  }

  async create(input: { name: string; description?: string; packagePrice: number; items: { serviceId: string; quantity: number }[] }): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("ServicePackage.create");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc('create_service_package_v1', {
        p_center_id: centerRes.data,
        p_name: input.name,
        p_description: input.description || null,
        p_package_price: input.packagePrice,
        p_items: input.items.map((item) => ({ serviceId: item.serviceId, quantity: item.quantity })),
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) {
          return { ok: false, error: createUnsupportedWriteError("ServicePackage.create") };
        }
        return { ok: false, error: createQueryError("ServicePackage.create", error.message) };
      }
      const row = (data || {}) as any;
      if (!row.service_package) return { ok: false, error: createQueryError("ServicePackage.create", "Invalid response from package RPC") };
      return { ok: true, data: mapServicePackage({ ...row.service_package, service_package_items: input.items.map((item, idx) => ({ id: `tmp-${idx}`, package_id: row.service_package.id, service_id: item.serviceId, quantity: item.quantity, created_at: new Date().toISOString() })) }) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("ServicePackage.create", (e as Error).message) };
    }
  }
}


class SupabaseCustomerExperienceAdapter implements CustomerExperienceRepository {
  async listReviews(): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("CustomerExperience.listReviews");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().from('customer_reviews').select('*').eq('center_id', centerRes.data).order('created_at', { ascending: false });
      if (error) return { ok: false, error: createQueryError("CustomerExperience.listReviews", error.message) };
      return { ok: true, data: (data || []).map(mapCustomerReview) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("CustomerExperience.listReviews", (e as Error).message) };
    }
  }

  async createReview(input: any): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("CustomerExperience.createReview");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc('create_customer_review_v1', {
        p_center_id: centerRes.data,
        p_customer_id: input.customerId,
        p_appointment_id: input.appointmentId || null,
        p_rating: input.rating,
        p_comment: input.comment || null,
        p_is_published: Boolean(input.isPublished),
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) return { ok: false, error: createUnsupportedWriteError("CustomerExperience.createReview") };
        return { ok: false, error: createQueryError("CustomerExperience.createReview", error.message) };
      }
      const row=(data||{}) as any;
      if (!row.review) return { ok:false, error:createQueryError("CustomerExperience.createReview","Invalid response") };
      return { ok:true, data: mapCustomerReview(row.review) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("CustomerExperience.createReview", (e as Error).message) };
    }
  }

  async listServiceFiles(customerId?: string): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("CustomerExperience.listServiceFiles");
    if (!centerRes.ok) return centerRes as any;
    try {
      let query = getSupabaseClient().from('service_files').select('*, images:service_file_images(*)').eq('center_id', centerRes.data).order('created_at', { ascending: false });
      if (customerId) query = query.eq('customer_id', customerId);
      const { data, error } = await query;
      if (error) return { ok: false, error: createQueryError("CustomerExperience.listServiceFiles", error.message) };
      return { ok: true, data: (data || []).map(mapServiceFile) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("CustomerExperience.listServiceFiles", (e as Error).message) };
    }
  }

  async createServiceFile(input: any): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("CustomerExperience.createServiceFile");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc('create_service_file_v1', {
        p_center_id: centerRes.data,
        p_customer_id: input.customerId,
        p_appointment_id: input.appointmentId || null,
        p_service_id: input.serviceId || null,
        p_title: input.title,
        p_note: input.note || null,
        p_before_images: input.beforeImages || [],
        p_after_images: input.afterImages || [],
        p_reference_images: input.referenceImages || [],
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) return { ok: false, error: createUnsupportedWriteError("CustomerExperience.createServiceFile") };
        return { ok: false, error: createQueryError("CustomerExperience.createServiceFile", error.message) };
      }
      const row=(data||{}) as any;
      if (!row.service_file) return { ok:false, error:createQueryError("CustomerExperience.createServiceFile","Invalid response") };
      return { ok:true, data: mapServiceFile({ ...row.service_file, images: [] }) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("CustomerExperience.createServiceFile", (e as Error).message) };
    }
  }
}

class SupabaseForecastAdapter implements ForecastRepository {
  async getInventoryForecast(): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("Forecast.getInventoryForecast");
    if (!centerRes.ok) return centerRes as any;
    try {
      const client = getSupabaseClient();
      const [productsRes, itemsRes] = await Promise.all([
        client.from('products').select('*').eq('center_id', centerRes.data),
        client.from('invoice_items').select('product_id, quantity, created_at').not('product_id', 'is', null).gte('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString())
      ]);
      if (productsRes.error) return { ok:false, error:createQueryError("Forecast.getInventoryForecast", productsRes.error.message)};
      if (itemsRes.error) return { ok:false, error:createQueryError("Forecast.getInventoryForecast", itemsRes.error.message)};
      const usage = new Map();
      for (const item of (itemsRes.data||[])) usage.set(item.product_id, (usage.get(item.product_id)||0)+Number(item.quantity||0));
      return { ok:true, data:(productsRes.data||[]).map((p:any)=>{ const sold=Number(usage.get(p.id)||0); const avg=sold/30; const stock=Number(p.stock_quantity)||0; const days=avg>0?stock/avg:999; return { productId:String(p.id), productName:String(p.name||''), stockQuantity:stock, averageDailyUnits:Number(avg.toFixed(2)), daysRemaining:Number(days.toFixed(1)), reorderAlert:days <= 14 || stock <= 5 }; }) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Forecast.getInventoryForecast", (e as Error).message) };
    }
  }

  async getFinancialForecast(): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("Forecast.getFinancialForecast");
    if (!centerRes.ok) return centerRes as any;
    try {
      const client = getSupabaseClient();
      const since = new Date(Date.now() - 30*24*60*60*1000).toISOString();
      const [invoicesRes, expensesRes] = await Promise.all([
        client.from('invoices').select('total_amount, tax, created_at').eq('center_id', centerRes.data).gte('created_at', since),
        client.from('expenses').select('amount, created_at').eq('center_id', centerRes.data).gte('created_at', since),
      ]);
      if (invoicesRes.error) return { ok:false, error:createQueryError("Forecast.getFinancialForecast", invoicesRes.error.message)};
      if (expensesRes.error) return { ok:false, error:createQueryError("Forecast.getFinancialForecast", expensesRes.error.message)};
      const revenue=(invoicesRes.data||[]).reduce((s:any,r:any)=>s+Number(r.total_amount||0),0);
      const expenses=(expensesRes.data||[]).reduce((s:any,r:any)=>s+Number(r.amount||0),0);
      const daily=revenue/30;
      return { ok:true, data:{ projectedMonthlyRevenue:Number(revenue.toFixed(2)), projectedMonthlyExpenses:Number(expenses.toFixed(2)), projectedMonthlyProfit:Number((revenue-expenses).toFixed(2)), revenueRunRateDaily:Number(daily.toFixed(2)) } };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Forecast.getFinancialForecast", (e as Error).message) };
    }
  }
}

class SupabaseAccountingAdapter implements AccountingRepository {
  async listJournalEntries(): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("Accounting.listJournalEntries");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().from('accounting_journal_entries').select('*').eq('center_id', centerRes.data).order('entry_date', { ascending: false }).order('created_at', { ascending: false });
      if (error) return { ok:false, error:createQueryError("Accounting.listJournalEntries", error.message) };
      return { ok:true, data:(data||[]).map(mapAccountingJournalEntry) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Accounting.listJournalEntries", (e as Error).message) };
    }
  }
  async createJournalEntry(input: any): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("Accounting.createJournalEntry");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc('create_accounting_journal_entry_v1', {
        p_center_id: centerRes.data,
        p_entry_date: input.entryDateISO || null,
        p_entry_type: input.entryType,
        p_reference_type: input.referenceType || null,
        p_reference_id: input.referenceId || null,
        p_description: input.description,
        p_debit_account: input.debitAccount,
        p_credit_account: input.creditAccount,
        p_amount: input.amount,
        p_currency: input.currency || 'OMR',
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) return { ok: false, error: createUnsupportedWriteError("Accounting.createJournalEntry") };
        return { ok: false, error: createQueryError("Accounting.createJournalEntry", error.message) };
      }
      const row=(data||{}) as any;
      if (!row.entry) return { ok:false, error:createQueryError("Accounting.createJournalEntry","Invalid response") };
      return { ok:true, data: mapAccountingJournalEntry(row.entry) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Accounting.createJournalEntry", (e as Error).message) };
    }
  }
}

class SupabaseAdvancedAdapter implements AdvancedRepository {
  async listAiBookingLeads(): Promise<Result<any[], DomainError>> {
    const centerRes = getCenterIdFor("Advanced.listAiBookingLeads");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().from('ai_booking_leads').select('*').eq('center_id', centerRes.data).order('created_at', { ascending: false });
      if (error) return { ok:false, error:createQueryError("Advanced.listAiBookingLeads", error.message) };
      return { ok:true, data:(data||[]).map(mapAiBookingLead) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Advanced.listAiBookingLeads", (e as Error).message) };
    }
  }
  async createAiBookingLead(input: any): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("Advanced.createAiBookingLead");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc('create_ai_booking_lead_v1', {
        p_center_id: centerRes.data,
        p_customer_name: input.customerName,
        p_customer_phone: input.customerPhone || null,
        p_preferred_service_id: input.preferredServiceId || null,
        p_preferred_date: input.preferredDateISO || null,
        p_source_channel: input.sourceChannel || 'WEB',
        p_summary: input.summary || null,
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) return { ok: false, error: createUnsupportedWriteError("Advanced.createAiBookingLead") };
        return { ok: false, error: createQueryError("Advanced.createAiBookingLead", error.message) };
      }
      const row=(data||{}) as any;
      if (!row.lead) return { ok:false, error:createQueryError("Advanced.createAiBookingLead","Invalid response") };
      return { ok:true, data: mapAiBookingLead(row.lead) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Advanced.createAiBookingLead", (e as Error).message) };
    }
  }
}

class SupabaseBookingAdapter implements BookingRepository {
  async listServices(): Promise<Result<PublicService[], DomainError>> {
    const centerRes = getCenterIdFor("Booking.listServices");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc("public_list_services_v1", { p_center_id: centerRes.data });
      if (error) return { ok: false, error: createQueryError("Booking.listServices", error.message) };
      const rows = (data || []) as any[];
      return { ok: true, data: rows.map((r) => ({
        id: String(r.id), name: String(r.name), price: Number(r.price) || 0,
        durationMinutes: Number(r.duration_minutes) || 30,
      })) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Booking.listServices", (e as Error).message) };
    }
  }

  async listStaff(): Promise<Result<PublicStaff[], DomainError>> {
    const centerRes = getCenterIdFor("Booking.listStaff");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc("public_list_staff_v1", { p_center_id: centerRes.data });
      if (error) return { ok: false, error: createQueryError("Booking.listStaff", error.message) };
      const rows = (data || []) as any[];
      return { ok: true, data: rows.map((r) => ({ id: String(r.id), name: String(r.name) })) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Booking.listStaff", (e as Error).message) };
    }
  }

  async getCenterInfo(): Promise<Result<PublicCenterInfo, DomainError>> {
    const centerRes = getCenterIdFor("Booking.getCenterInfo");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc("public_center_info_v1", { p_center_id: centerRes.data });
      if (error) return { ok: false, error: createQueryError("Booking.getCenterInfo", error.message) };
      const row = (Array.isArray(data) ? data[0] : data) as any;
      if (!row) return { ok: false, error: { name: "DomainError", message: "Center not found", code: "NOT_FOUND" } };
      return { ok: true, data: {
        name: String(row.name ?? "Salon"), currency: String(row.currency ?? "OMR"),
        phone: row.phone ?? undefined, address: row.address ?? undefined,
      } };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Booking.getCenterInfo", (e as Error).message) };
    }
  }

  async getTakenSlots(dayISO: string): Promise<Result<{ dateTimeISO: string; employeeId?: string }[], DomainError>> {
    const centerRes = getCenterIdFor("Booking.getTakenSlots");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc("public_taken_slots_v1", { p_center_id: centerRes.data, p_day: dayISO });
      if (error) return { ok: false, error: createQueryError("Booking.getTakenSlots", error.message) };
      const rows = (data || []) as any[];
      return { ok: true, data: rows.map((r) => ({
        dateTimeISO: new Date(r.date_time).toISOString(),
        employeeId: r.employee_id ? String(r.employee_id) : undefined,
      })) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Booking.getTakenSlots", (e as Error).message) };
    }
  }

  async createBooking(input: BookingInput): Promise<Result<{ appointmentId: string }, DomainError>> {
    const centerRes = getCenterIdFor("Booking.createBooking");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc("public_create_booking_v1", {
        p_center_id: centerRes.data,
        p_service_id: input.serviceId,
        p_employee_id: input.employeeId || null,
        p_customer_name: input.customerName,
        p_customer_phone: input.customerPhone,
        p_date_time: input.dateTimeISO,
        p_notes: input.notes || null,
      });
      if (error) return { ok: false, error: createQueryError("Booking.createBooking", error.message) };
      const row = (data || {}) as any;
      if (!row.appointment_id) return { ok: false, error: createQueryError("Booking.createBooking", "Invalid response from booking RPC") };
      return { ok: true, data: { appointmentId: String(row.appointment_id) } };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Booking.createBooking", (e as Error).message) };
    }
  }

  async cancelBooking(input: { appointmentId: string; phone: string; token: string; reason?: string }): Promise<Result<{ appointment: Appointment }, DomainError>> {
    const centerRes = getCenterIdFor("Booking.cancelBooking");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc("public_cancel_booking_v1", {
        p_center_id: centerRes.data,
        p_appointment_id: input.appointmentId,
        p_phone: input.phone,
        p_portal_token: input.token,
        p_reason: input.reason || null,
      });
      if (error) return { ok: false, error: createQueryError("Booking.cancelBooking", error.message) };
      const row = (data || {}) as any;
      if (!row.appointment) return { ok: false, error: createQueryError("Booking.cancelBooking", "Invalid response from booking cancel RPC") };
      return { ok: true, data: { appointment: mapAppointment(row.appointment) } };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Booking.cancelBooking", (e as Error).message) };
    }
  }

  async rescheduleBooking(input: { appointmentId: string; phone: string; token: string; newDateTimeISO: string; newEmployeeId?: string; reason?: string }): Promise<Result<{ appointment: Appointment }, DomainError>> {
    const centerRes = getCenterIdFor("Booking.rescheduleBooking");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc("public_reschedule_booking_v1", {
        p_center_id: centerRes.data,
        p_appointment_id: input.appointmentId,
        p_phone: input.phone,
        p_portal_token: input.token,
        p_new_date_time: input.newDateTimeISO,
        p_new_employee_id: input.newEmployeeId || null,
        p_reason: input.reason || null,
      });
      if (error) return { ok: false, error: createQueryError("Booking.rescheduleBooking", error.message) };
      const row = (data || {}) as any;
      if (!row.appointment) return { ok: false, error: createQueryError("Booking.rescheduleBooking", "Invalid response from booking reschedule RPC") };
      return { ok: true, data: { appointment: mapAppointment(row.appointment) } };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Booking.rescheduleBooking", (e as Error).message) };
    }
  }

  async clientPortalLogin(phone: string, token: string): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("Booking.clientPortalLogin");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc("public_client_portal_login_v1", {
        p_center_id: centerRes.data,
        p_phone: phone,
        p_token: token,
      });
      if (error) return { ok: false, error: createQueryError("Booking.clientPortalLogin", error.message) };
      const row = (data || {}) as any;
      const customer = row.customer;
      if (!customer?.id) return { ok: false, error: createQueryError("Booking.clientPortalLogin", "Invalid response from client portal login RPC") };
      return {
        ok: true,
        data: {
          customerId: String(customer.id),
          name: String(customer.name || ""),
          phone: customer.phone ? String(customer.phone) : undefined,
          loyaltyPoints: Number(customer.loyalty_points) || 0,
          totalSpent: Number(customer.total_spent) || 0,
          lastVisitISO: customer.last_visit ? new Date(customer.last_visit).toISOString() : undefined,
          portalLastLoginAtISO: customer.portal_last_login_at ? new Date(customer.portal_last_login_at).toISOString() : undefined,
        }
      };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Booking.clientPortalLogin", (e as Error).message) };
    }
  }

  async getClientPortalProfile(customerId: string, phone: string, token: string): Promise<Result<any, DomainError>> {
    const centerRes = getCenterIdFor("Booking.getClientPortalProfile");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc("public_client_portal_profile_v2", {
        p_center_id: centerRes.data,
        p_customer_id: customerId,
        p_phone: phone,
        p_token: token,
      });
      if (error) return { ok: false, error: createQueryError("Booking.getClientPortalProfile", error.message) };
      const row = (data || {}) as any;
      if (!row.customer?.id) return { ok: false, error: createQueryError("Booking.getClientPortalProfile", "Invalid response from client portal profile RPC") };
      return {
        ok: true,
        data: {
          customer: {
            id: String(row.customer.id),
            name: String(row.customer.name || ""),
            phone: row.customer.phone ? String(row.customer.phone) : undefined,
            email: row.customer.email ? String(row.customer.email) : undefined,
            notes: row.customer.notes ? String(row.customer.notes) : undefined,
            loyaltyPoints: Number(row.customer.loyalty_points) || 0,
            totalSpent: Number(row.customer.total_spent) || 0,
            lastVisitISO: row.customer.last_visit ? new Date(row.customer.last_visit).toISOString() : undefined,
            portalLastLoginAtISO: row.customer.portal_last_login_at ? new Date(row.customer.portal_last_login_at).toISOString() : undefined,
          },
          appointments: Array.isArray(row.appointments) ? row.appointments.map((item: any) => ({
            id: String(item.id),
            dateTimeISO: new Date(item.date_time).toISOString(),
            status: String(item.status),
            notes: item.notes ? String(item.notes) : undefined,
            depositAmount: Number(item.deposit_amount) || 0,
            noShowFeeAmount: Number(item.no_show_fee_amount) || 0,
            noShowFeeCharged: Number(item.no_show_fee_charged) || 0,
            employeeName: item.employee_name ? String(item.employee_name) : undefined,
            serviceName: item.service_name ? String(item.service_name) : undefined,
          })) : [],
          invoices: Array.isArray(row.invoices) ? row.invoices.map((item: any) => ({
            id: String(item.id),
            serialNumber: item.serial_number ? String(item.serial_number) : undefined,
            dateISO: new Date(item.date).toISOString(),
            totalAmount: Number(item.total_amount) || 0,
            discount: Number(item.discount) || 0,
            tax: Number(item.tax) || 0,
            paymentMethod: String(item.payment_method || ""),
          })) : [],
          reviews: Array.isArray(row.reviews) ? row.reviews.map((item: any) => ({
            id: String(item.id),
            appointmentId: item.appointment_id ? String(item.appointment_id) : undefined,
            rating: Number(item.rating) || 0,
            comment: item.comment ? String(item.comment) : undefined,
            isPublished: Boolean(item.is_published),
            createdAtISO: new Date(item.created_at).toISOString(),
          })) : [],
          serviceFiles: Array.isArray(row.service_files) ? row.service_files.map((item: any) => ({
            id: String(item.id),
            appointmentId: item.appointment_id ? String(item.appointment_id) : undefined,
            serviceId: item.service_id ? String(item.service_id) : undefined,
            title: String(item.title || ''),
            note: item.note ? String(item.note) : undefined,
            createdAtISO: new Date(item.created_at).toISOString(),
            images: Array.isArray(item.images) ? item.images.map((img: any) => ({
              id: String(img.id),
              imageKind: String(img.image_kind || 'REFERENCE') as any,
              imageUrl: String(img.image_url || ''),
              sortOrder: Number(img.sort_order) || 0,
              createdAtISO: new Date(img.created_at).toISOString(),
            })) : [],
          })) : [],
          notificationTimeline: Array.isArray(row.notification_timeline) ? row.notification_timeline.map((item: any) => ({
            id: String(item.id),
            appointmentId: item.appointment_id ? String(item.appointment_id) : undefined,
            channel: String(item.channel || 'SYSTEM'),
            direction: String(item.direction || 'OUTBOUND'),
            templateKey: item.template_key ? String(item.template_key) : undefined,
            messagePreview: String(item.message_preview || ''),
            deliveryStatus: String(item.delivery_status || 'QUEUED'),
            sentAtISO: item.sent_at ? new Date(item.sent_at).toISOString() : undefined,
            createdAtISO: new Date(item.created_at).toISOString(),
          })) : [],
          referral: row.referral ? {
            code: row.referral.code ? String(row.referral.code) : undefined,
            pointsEarned: Number(row.referral.points_earned) || 0,
          } : undefined,
        }
      };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Booking.getClientPortalProfile", (e as Error).message) };
    }
  }
}

export {
  SupabaseAuthAdapter,
  SupabaseCustomerAdapter,
  SupabaseEmployeeAdapter,
  SupabaseServiceAdapter,
  SupabaseAppointmentAdapter,
  SupabaseProductAdapter,
  SupabaseExpenseAdapter,
  SupabaseInvoiceAdapter,
  SupabaseSettingsAdapter,
  SupabaseDashboardAdapter,
  SupabaseReportAdapter,
  SupabaseGiftCardAdapter,
  SupabaseServicePackageAdapter,
  SupabaseCustomerExperienceAdapter,
  SupabaseForecastAdapter,
  SupabaseAccountingAdapter,
  SupabaseAdvancedAdapter,
  SupabaseBookingAdapter
};
