import { 
  AuthRepository, CustomerRepository, EmployeeRepository, ServiceRepository, 
  AppointmentRepository, ProductRepository, ExpenseRepository, InvoiceRepository, 
  SettingsRepository, DashboardRepository, ReportRepository, Result, DomainError, AuthError 
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
  mapAuthSession, mapInvoice
} from "./mappers";
import { tenantContext, requireConfiguredCenterId } from "../tenantContext";
import { CheckoutPayload, InvoicePrintData, DashboardSummary, PnlData, ChartData, SalesReportRow, AppointmentReportRow, InventoryReportRow, BackupPayload } from "../../application/dto";

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
  async list(_query?: string): Promise<Result<Customer[], DomainError>> {
    const centerRes = getCenterIdFor("Customer.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('customers')
        .select('*')
        .eq('center_id', centerRes.data)
        .order('created_at', { ascending: false });

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
        // center_id is intentionally omitted, trusting the backend trigger or function to assign it if required.
        // It's possible the current schema draft will cause this to fail if no default exists.
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

  async getHistory(): Promise<Result<{ appointments: Appointment[], invoices: Invoice[] }, DomainError>> {
    return { ok: false, error: createUnsupportedReadError("Customer.getHistory") };
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
        notes: data.notes
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
    return { ok: false, error: createUnsupportedWriteError("Expense.update") };
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
        p_items: payload.items
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
    return { ok: false, error: createUnsupportedReadError("Invoice.getForPrint") };
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
  async update(): Promise<Result<CenterSettings, DomainError>> {
    return { ok: false, error: createUnsupportedWriteError("Settings.update") };
  }
  async uploadLogo(): Promise<Result<{ logoPath: string }, DomainError>> {
    return { ok: false, error: createUnsupportedWriteError("Settings.uploadLogo") };
  }
  async backup(): Promise<Result<{ message: string }, DomainError>> {
    return { ok: false, error: createUnsupportedWriteError("Settings.backup") };
  }
  async exportData(): Promise<Result<unknown, DomainError>> {
    return { ok: false, error: createUnsupportedWriteError("Settings.exportData") };
  }
  async restore(): Promise<Result<void, DomainError>> {
    return { ok: false, error: createUnsupportedWriteError("Settings.restore") };
  }
}

class SupabaseDashboardAdapter implements DashboardRepository {
  async getSummary(): Promise<Result<DashboardSummary, DomainError>> {
    const centerRes = getCenterIdFor("Dashboard.getSummary");
    if (!centerRes.ok) return centerRes as any;

    try {
      const client = getSupabaseClient();
      
      const [custRes, apptRes, prodRes] = await Promise.all([
        client.from('customers').select('*', { count: 'exact', head: true }).eq('center_id', centerRes.data),
        client.from('appointments').select('*', { count: 'exact', head: true }).eq('center_id', centerRes.data),
        client.from('products').select('*', { count: 'exact', head: true }).eq('center_id', centerRes.data).lte('stock_quantity', 5)
      ]);

      if (custRes.error) throw new Error(custRes.error.message);
      if (apptRes.error) throw new Error(apptRes.error.message);
      if (prodRes.error) throw new Error(prodRes.error.message);

      const data: DashboardSummary = {
        customers: custRes.count || 0,
        appointments: apptRes.count || 0,
        sales: 0,
        revenue: 0,
        canViewRevenue: false, // Explicitly false as it's unsupported
        lowStockCount: prodRes.count || 0,
      };

      return { ok: true, data };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Dashboard.getSummary", (e as Error).message) };
    }
  }
  async getPnlMonth(): Promise<Result<PnlData, DomainError>> {
    return { ok: false, error: createUnsupportedReadError("Dashboard.getPnlMonth") };
  }
  async getRevenueLast7Days(): Promise<Result<ChartData[], DomainError>> {
    return { ok: false, error: createUnsupportedReadError("Dashboard.getRevenueLast7Days") };
  }
}

class SupabaseReportAdapter implements ReportRepository {
  async getSales(): Promise<Result<SalesReportRow[], DomainError>> {
    return { ok: false, error: createUnsupportedReadError("Report.getSales") };
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
  SupabaseReportAdapter
};
