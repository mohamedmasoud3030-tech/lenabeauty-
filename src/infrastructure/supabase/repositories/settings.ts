import { SettingsRepository, Result, DomainError } from "../../../domain/ports/repositories";
import { Employee, CenterSettings } from "../../../domain/entities";
import { createUnsupportedWriteError, createUnsupportedReadError, createQueryError } from ".././errors";
import { getSupabaseClient } from ".././client";
import { TablesUpdate } from ".././database.types";
import { mapCustomer, mapEmployee, mapService, mapProduct, mapAppointment, mapExpense, mapCenterSettings, mapInvoice, mapNotificationSettings, mapPaymentGatewaySettings, mapAttendanceRecord, mapEmployeeAdvance, mapPayrollRun, mapPayrollLineItem } from ".././mappers";
import { requiredText, percentField, DomainValidationError } from "../../../domain/validation";
import { BackupPayload, validateBackupPayload } from "../../../application/dto";
import { LENA_BRAND_PALETTE, normalizeBrandColor } from "../../../shared/theme/brandPalette";
import { validatePayload, okValue, getCenterIdFor, isMissingBackendFeature, toDateOnly, fetchAllRows, resolveCenterAssetUrl } from "./shared";

export class SupabaseSettingsAdapter implements SettingsRepository {
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
      const settings = mapCenterSettings(data);
      settings.logoPath = await resolveCenterAssetUrl(settings.logoPath);
      return { ok: true, data: settings };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Settings.get", (e as Error).message) };
    }
  }
  async update(data: Partial<CenterSettings>): Promise<Result<CenterSettings, DomainError>> {
    const centerRes = getCenterIdFor("Settings.update");
    if (!centerRes.ok) return centerRes as any;

    const nameR = data.name !== undefined ? requiredText(data.name) : null;
    const taxR = data.taxRate !== undefined ? percentField(data.taxRate) : null;
    const boundary = validatePayload([
      ...(nameR ? [{ field: "name", result: nameR }] : []),
      ...(taxR ? [{ field: "taxRate", result: taxR }] : []),
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const payload: TablesUpdate<"center_settings"> = {};
      if (data.name !== undefined) payload.name = okValue(nameR);
      if (data.currency !== undefined) payload.currency = data.currency;
      if (data.taxRate !== undefined) payload.tax_rate = okValue(taxR);
      if (data.logoPath !== undefined) payload.logo_path = data.logoPath;
      if (data.address !== undefined) payload.address = data.address;
      if (data.phone !== undefined) payload.phone = data.phone;
      if (data.cr !== undefined) payload.cr = data.cr;
      if (data.postalCode !== undefined) payload.postal_code = data.postalCode;
      if (data.displayName !== undefined) payload.display_name = data.displayName;
      if (data.displayNameAr !== undefined) payload.display_name_ar = data.displayNameAr;
      if (data.brandEmail !== undefined) payload.brand_email = data.brandEmail;
      if (data.brandTaxNumber !== undefined) payload.brand_tax_number = data.brandTaxNumber;
      if (data.brandRegistrationNumber !== undefined) payload.brand_registration_number = data.brandRegistrationNumber;
      // Strict #RRGGBB color contract at the persistence boundary: a crafted
      // request can never store a CSS payload in the branding columns, which
      // would later be interpolated into generated documents/stylesheets.
      if (data.brandPrimaryColor !== undefined) payload.brand_primary_color = normalizeBrandColor(data.brandPrimaryColor, LENA_BRAND_PALETTE.primary);
      if (data.brandSecondaryColor !== undefined) payload.brand_secondary_color = normalizeBrandColor(data.brandSecondaryColor, LENA_BRAND_PALETTE.secondary);
      if (data.brandAccentColor !== undefined) payload.brand_accent_color = normalizeBrandColor(data.brandAccentColor, LENA_BRAND_PALETTE.surfaceAccent);
      if (data.brandFooterText !== undefined) payload.brand_footer_text = data.brandFooterText;
      if (data.brandFooterTextAr !== undefined) payload.brand_footer_text_ar = data.brandFooterTextAr;
      if (data.brandLogoBase64 !== undefined) payload.brand_logo_base64 = data.brandLogoBase64;

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
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      return {
        ok: false,
        error: new DomainValidationError([{ field: "logo", key: "validation.logo_type" }]),
      };
    }
    if (file.size <= 0 || file.size > 2 * 1024 * 1024) {
      return {
        ok: false,
        error: new DomainValidationError([{ field: "logo", key: "validation.logo_size" }]),
      };
    }
    try {
      const client: any = getSupabaseClient();
      if (!client.storage?.from) return { ok: false, error: createUnsupportedWriteError("Settings.uploadLogo") };
      // A stable object key prevents every replacement from accumulating a new
      // orphan. Supabase stores the MIME type from contentType, not the suffix.
      const logoPath = `${centerRes.data}/logo-current`;
      const { error } = await client.storage.from('center-assets').upload(logoPath, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });
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

      // A backup must be COMPLETE. Every tenant-scoped table is paged past the
      // silent PostgREST row cap, ordered by a stable key so paging is
      // deterministic. `center_settings` is a single row and `list_employees_v1`
      // is a bounded RPC, so neither needs paging.
      //
      // Each `.from()` is written as a literal so the database-contract scanner
      // can keep statically resolving which tables the backup touches; a
      // dynamic `from(table)` helper would hide them behind a scanner
      // limitation and silently shrink audit coverage.
      const scoped = (query: any) => query.eq('center_id', centerRes.data).order('id', { ascending: true });

      const [customers, employees, services, appointments, products, expenses, settings, invoices, attendance, advances, payrollRuns, payrollLines] = await Promise.all([
        fetchAllRows<any>(() => scoped(client.from('customers').select('*'))),
        client.rpc('list_employees_v1', { p_center_id: centerRes.data }),
        fetchAllRows<any>(() => scoped(client.from('services').select('*'))),
        fetchAllRows<any>(() => scoped(client.from('appointments').select('*'))),
        fetchAllRows<any>(() => scoped(client.from('products').select('*'))),
        fetchAllRows<any>(() => scoped(client.from('expenses').select('*'))),
        client.from('center_settings').select('*').eq('center_id', centerRes.data).maybeSingle(),
        fetchAllRows<any>(() => scoped(client.from('invoices').select('*'))),
        fetchAllRows<any>(() => scoped(client.from('attendance_records').select('*'))),
        fetchAllRows<any>(() => scoped(client.from('employee_advances').select('*'))),
        fetchAllRows<any>(() => scoped(client.from('payroll_runs').select('*'))),
        fetchAllRows<any>(() => scoped(client.from('payroll_line_items').select('*')))
      ]);

      // EVERY source must be checked. Attendance, advances and payroll were
      // previously omitted, so a failure there was swallowed and `(data || [])`
      // turned it into an empty array — a backup that looked successful while
      // silently containing no attendance, advance or payroll history. A backup
      // that under-reports is more dangerous than no backup at all.
      const responses: { label: string; error: { message: string } | null }[] = [
        { label: "customers", error: customers.error },
        { label: "employees", error: employees.error },
        { label: "services", error: services.error },
        { label: "appointments", error: appointments.error },
        { label: "products", error: products.error },
        { label: "expenses", error: expenses.error },
        { label: "center_settings", error: settings.error },
        { label: "invoices", error: invoices.error },
        { label: "attendance_records", error: attendance.error },
        { label: "employee_advances", error: advances.error },
        { label: "payroll_runs", error: payrollRuns.error },
        { label: "payroll_line_items", error: payrollLines.error },
      ];
      for (const response of responses) {
        if (!response.error) continue;
        if (isMissingBackendFeature(response.error)) return { ok: false, error: createUnsupportedReadError("Settings.exportData") };
        return { ok: false, error: createQueryError("Settings.exportData", `${response.label}: ${response.error.message}`) };
      }

      return {
        ok: true,
        data: {
          version: "1.0.0",
          timestamp: new Date().toISOString(),
          data: {
            customers: customers.rows.map(mapCustomer),
            employees: (Array.isArray((employees.data as any)?.employees) ? (employees.data as any).employees : []).map(mapEmployee),
            services: services.rows.map(mapService),
            appointments: appointments.rows.map(mapAppointment),
            products: products.rows.map(mapProduct),
            expenses: expenses.rows.map(mapExpense),
            settings: settings.data ? mapCenterSettings(settings.data) : undefined,
            invoices: invoices.rows.map(mapInvoice),
            attendance: attendance.rows.map(mapAttendanceRecord),
            advances: advances.rows.map(mapEmployeeAdvance),
            payrollRuns: payrollRuns.rows.map(mapPayrollRun),
            payrollLines: payrollLines.rows.map(mapPayrollLineItem)
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

      // Attendance records
      if (d.attendance?.length) {
        const rows = withCenter(
          d.attendance.map((a) => ({
            id: a.id,
            employee_id: a.employeeId,
            date: a.date instanceof Date ? toDateOnly(a.date) : a.date,
            check_in_time: a.checkInTime || null,
            check_out_time: a.checkOutTime || null,
            method: a.method || 'MANUAL',
            work_hours: a.workHours ?? 0,
            status: a.status || 'PRESENT',
            notes: a.notes ?? null,
          }))
        );
        const { error } = await client.from("attendance_records").upsert(rows, { onConflict: "id" });
        if (error) return { ok: false, error: createQueryError("Settings.restore", error.message) };
      }

      // Employee advances
      if (d.advances?.length) {
        const rows = withCenter(
          d.advances.map((a) => ({
            id: a.id,
            employee_id: a.employeeId,
            amount: a.amount ?? 0,
            reason: a.reason ?? '',
            advance_date: a.advanceDate instanceof Date ? a.advanceDate.toISOString() : a.advanceDate,
            status: a.status || 'PENDING',
            deducted_in_run_id: a.deductedInRunId || null,
            notes: a.notes ?? null,
          }))
        );
        const { error } = await client.from("employee_advances").upsert(rows, { onConflict: "id" });
        if (error) return { ok: false, error: createQueryError("Settings.restore", error.message) };
      }

      // Payroll runs (parent) — restored before line items (child FK)
      if (d.payrollRuns?.length) {
        const rows = withCenter(
          d.payrollRuns.map((r) => ({
            id: r.id,
            period_month: r.periodMonth,
            run_date: r.runDate instanceof Date ? r.runDate.toISOString() : r.runDate,
            notes: r.notes ?? null,
          }))
        );
        const { error } = await client.from("payroll_runs").upsert(rows, { onConflict: "id" });
        if (error) return { ok: false, error: createQueryError("Settings.restore", error.message) };
      }

      // Payroll line items (child)
      if (d.payrollLines?.length) {
        const rows = withCenter(
          d.payrollLines.map((l) => ({
            id: l.id,
            payroll_run_id: l.payrollRunId,
            employee_id: l.employeeId,
            base_salary: l.baseSalary ?? 0,
            advances_deducted: l.advancesDeducted ?? 0,
            net_salary: l.netSalary ?? 0,
            notes: l.notes ?? null,
          }))
        );
        const { error } = await client.from("payroll_line_items").upsert(rows, { onConflict: "id" });
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
