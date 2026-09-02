import { AuthRepository, CustomerRepository, EmployeeRepository, ServiceRepository, AppointmentRepository, ProductRepository, ExpenseRepository, InvoiceRepository, SettingsRepository, DashboardRepository, ReportRepository, Result, DomainError, AuthError, BookingRepository, BookingInput, PublicService, PublicStaff, PublicCenterInfo, GiftCardRepository, ServicePackageRepository, EntitlementRepository, CustomerExperienceRepository, ForecastRepository, AccountingRepository, AdvancedRepository, AttendanceRepository, AdvanceRepository, PayrollRepository, ServiceRecipeRepository, RecipeItemInput } from "../../../domain/ports/repositories";
import { Customer, Employee, Service, Appointment, AppointmentStatus, VisitStage, Product, Expense, Invoice, CenterSettings, AttendanceRecord, EmployeeAdvance, PayrollRun, PayrollLineItem, CustomerEntitlement, EntitlementLedgerEntry, ServiceRecipe, InventoryConsumption } from "../../../domain/entities";
import { SessionState } from "../../../domain/entities/Session";
import { createUnsupportedWriteError, createUnsupportedReadError, createQueryError, createUnsupportedAuthError } from ".././errors";
import { getSupabaseClient } from ".././client";
import { Json, TablesInsert, TablesUpdate } from ".././database.types";
import { mapCustomer, mapEmployee, mapService, mapProduct, mapAppointment, mapExpense, mapCenterSettings, mapAuthSession, mapInvoice, mapInvoiceItem, mapGiftCard, mapGiftCardTransaction, mapServicePackage, mapCustomerEntitlement, mapEntitlementLedgerEntry, mapNotificationSettings, mapPaymentGatewaySettings, mapCustomerReview, mapServiceFile, mapAccountingJournalEntry, mapAiBookingLead, mapAttendanceRecord, mapEmployeeAdvance, mapPayrollRun, mapPayrollLineItem, mapServiceRecipe, mapInventoryConsumption } from ".././mappers";
import { tenantContext, requireConfiguredCenterId } from "../../tenantContext";
import { passwordResetRedirectUrl } from "../../../shared/auth/passwordResetRedirect";
import { requiredText, optionalText, nonNegativeNumber, positiveNumber, positiveInteger, nonNegativeInteger, percentField, phoneField, emailField, dateField, notInPastField, collectIssues, numberField, DomainValidationError, ValidationIssue, FieldResult } from "../../../domain/validation";
import { CheckoutPayload, InvoicePrintData, DashboardSummary, PnlData, ChartData, SalesReportRow, AppointmentReportRow, InventoryReportRow, BackupPayload, validateBackupPayload, EntitlementSummary } from "../../../application/dto";
import { mapSalesReportRows, mapInvoicePrintItems } from ".././salesReportMapper";
import { validateCheckoutContract } from "../../../domain/commerce";
import { isCheckoutAfterCheckin } from "../../../domain/attendance";
import { localDateRangeISO } from "../../../shared/dateRange";
import { LENA_BRAND_PALETTE, normalizeBrandColor } from "../../../shared/theme/brandPalette";


/**
 * Repository-boundary validation helper. Validates a payload's fields with the
 * shared domain validators and returns a structured VALIDATION_ERROR result if
 * any field is invalid — BEFORE anything reaches Supabase. This is the second
 * line of defense behind the UI forms and works even when the UI is bypassed.
 */
export function validatePayload(
  fields: { field: string; result: FieldResult<unknown> }[]
): { ok: true; issues: ValidationIssue[] } | { ok: false; error: DomainError } {
  const issues = collectIssues(fields);
  if (issues.length > 0) {
    return { ok: false, error: new DomainValidationError(issues) };
  }
  return { ok: true, issues: [] };
}

/** Assert a validated field result and return its normalized value. */
export function okValue<T>(r: FieldResult<T> | null): T {
  return (r as FieldResult<T> & { ok: true }).value;
}

export function getCenterIdFor(operation: string): Result<string, DomainError> {
  try {
     const id = requireConfiguredCenterId();
     return { ok: true, data: id };
  } catch (e: any) {
     return { ok: false, error: createQueryError(operation, e.message) };
  }
}

export function createAuthError(code: "INVALID_CREDENTIALS" | "INFRASTRUCTURE_ERROR", message: string): AuthError {
  const err = new Error(message) as AuthError;
  err.code = code;
  return err;
}

export function isMissingBackendFeature(error: { code?: string; message?: string } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() || "";
  return error?.code === "PGRST202"
    || error?.code === "42883"
    || error?.code === "42P01"
    || error?.code === "42703"
    || message.includes("could not find the function")
    || message.includes("could not find the table")
    || message.includes("does not exist");
}

export function createOperationId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("Secure UUID generation is unavailable in this runtime");
  }
  return globalThis.crypto.randomUUID();
}

export function toJson(value: unknown): Json {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("JSON payload contains a non-finite number");
    return value;
  }
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === "object") {
    const output: { [key: string]: Json | undefined } = {};
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) output[key] = toJson(child);
    }
    return output;
  }
  throw new Error("JSON payload contains an unsupported value");
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Canonical center-scoped hard delete. Every domain adapter's `delete(id)`
 * was a byte-for-byte duplicate of this query plus the standard center guard
 * and error mapping; one owner keeps center isolation and error shapes
 * identical across the layer. (RPC-based deletes stay inline: they carry a
 * different contract.)
 */
export async function deleteById(
  table: string,
  context: string,
  id: string,
): Promise<Result<void, DomainError>> {
  const centerRes = getCenterIdFor(context);
  if (!centerRes.ok) return centerRes as any;
  try {
    const { error } = await getSupabaseClient()
      .from(table as any)
      .delete()
      .eq('id', id)
      .eq('center_id', centerRes.data);
    if (error) return { ok: false, error: createQueryError(context, error.message) };
    return { ok: true, data: undefined };
  } catch (e: unknown) {
    return { ok: false, error: createQueryError(context, (e as Error).message) };
  }
}

/**
 * PostgREST caps every response at the project's `max_rows` (1000 by default).
 * The cap is applied SILENTLY — HTTP 200, no error, just fewer rows — so a
 * caller that reads `data` cannot tell a complete result from a truncated one.
 *
 * Harmless for a screen showing the newest records; data loss for a full-tenant
 * backup, where a center with more than 1000 invoices would receive a
 * "successful" export missing everything past the cap. Paging with `.range()`
 * until a short page proves the end of the set is the only safe read.
 */
export const EXPORT_PAGE_SIZE = 1000;

/** Hard ceiling so a server that ignores `range` can never loop forever. */
export const EXPORT_MAX_ROWS = 500_000;

interface PagedRows<T> {
  rows: T[];
  error: { message: string } | null;
}

export async function fetchAllRows<T>(
  buildQuery: () => { range: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }> },
): Promise<PagedRows<T>> {
  const rows: T[] = [];

  for (let offset = 0; offset < EXPORT_MAX_ROWS; offset += EXPORT_PAGE_SIZE) {
    const { data, error } = await buildQuery().range(offset, offset + EXPORT_PAGE_SIZE - 1);
    if (error) return { rows: [], error };

    const page = (data ?? []) as T[];
    rows.push(...page);

    // A page shorter than the requested window means the set is exhausted.
    if (page.length < EXPORT_PAGE_SIZE) return { rows, error: null };
  }

  return { rows, error: null };
}

export async function resolveCenterAssetUrl(path: string | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
  const client: any = getSupabaseClient();
  if (!client.storage?.from) return undefined;
  const bucket = client.storage.from('center-assets');
  if (!bucket?.createSignedUrl) return undefined;
  const { data, error } = await bucket.createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return undefined;
  return data.signedUrl;
}

/**
 * Local-timezone date helpers.
 *
 * Root cause this fixes: the dashboard bucketed revenue by UTC date while the
 * salon operates in a local timezone (e.g. OMR/Gulf, UTC+4). Sales made in the
 * early local morning landed on the previous day's bucket, and the "today"
 * filter silently dropped the first hours of the day. All bucketing/filtering
 * now happens in the user's LOCAL calendar day, converted to UTC instants only
 * for the database comparison.
 */
export function toLocalDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function localDayStartISO(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
}

export function localDayEndISO(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Resolve the UI's category name to the canonical center-scoped FK. */
export async function resolveServiceCategoryId(centerId: string, rawCategory: string): Promise<string> {
  const client = getSupabaseClient();
  const category = rawCategory.trim();
  if (UUID_RE.test(category)) {
    const { data, error } = await client
      .from("service_categories")
      .select("id")
      .eq("id", category)
      .eq("center_id", centerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Service category is not available for this center");
    return data.id;
  }

  const { data, error } = await client
    .from("service_categories")
    .upsert({ center_id: centerId, name: category }, { onConflict: "center_id,name", ignoreDuplicates: false })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("No service category returned after upsert");
  return data.id;
}



export const ENTITLEMENT_SELECT = `
  *,
  customers (name),
  service_packages (name),
  gift_cards (code),
  source_invoice:invoices (serial_number),
  package_entitlement_units (
    id,
    center_id,
    entitlement_id,
    service_id,
    total_units,
    used_units,
    created_at,
    services (name)
  )
`;
