import {
  PublicAccessRepository,
  PublicCenterInfo,
  PublicServiceOption,
  PublicStaffOption,
  PublicTakenSlot,
  PublicBookingRequest,
  PublicBookingConfirmation,
  PortalCredentials,
  PortalProfile,
  InvoiceRatingLookup,
  InvoiceRatingSaved,
} from "../../../domain/ports/repositories";
import { DomainError, Result } from "../../../domain/ports/repositories";
import { createQueryError } from "../errors";
import { getSupabaseClient } from "../client";

/**
 * Anonymous public surface: online booking (#/book) and the client portal
 * (#/portal).
 *
 * Everything here calls SECURITY DEFINER RPCs granted to `anon` by the
 * canonical migration chain. There is NO membership guard (the caller is not
 * signed in) and no direct table access — the server functions own every
 * check: active service/staff, slot availability, past-time rejection,
 * exact phone+code credentials, and portal lockout after repeated failures.
 *
 * Error mapping stays uniform with the rest of the layer: infrastructure
 * failures surface the server message; the pages translate what they can.
 */

function toDomainError(context: string, message: string): DomainError {
  return createQueryError(context, message);
}

function isMissingBackendFeature(message: string | undefined): boolean {
  return Boolean(message && (message.includes("PGRST202") || message.includes("42883") || message.includes("Could not find the function")));
}

export class SupabasePublicAccessAdapter implements PublicAccessRepository {
  async getCenterInfo(centerId: string): Promise<Result<PublicCenterInfo, DomainError>> {
    try {
      const { data, error } = await getSupabaseClient().rpc("public_center_info_v1", { p_center_id: centerId });
      if (error) return { ok: false, error: toDomainError("Public.centerInfo", error.message) };
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return { ok: false, error: toDomainError("Public.centerInfo", "NOT_FOUND") };
      return {
        ok: true,
        data: {
          name: String(row.name || ""),
          currency: String(row.currency || "OMR"),
          phone: typeof row.phone === "string" ? row.phone : null,
          address: typeof row.address === "string" ? row.address : null,
        },
      };
    } catch (e: unknown) {
      return { ok: false, error: toDomainError("Public.centerInfo", (e as Error).message) };
    }
  }

  async listServices(centerId: string): Promise<Result<PublicServiceOption[], DomainError>> {
    try {
      const { data, error } = await getSupabaseClient().rpc("public_list_services_v1", { p_center_id: centerId });
      if (error) return { ok: false, error: toDomainError("Public.listServices", error.message) };
      const rows = Array.isArray(data) ? data : [];
      return {
        ok: true,
        data: rows.map((row: any) => ({
          id: String(row.id),
          name: String(row.name || ""),
          price: Number(row.price) || 0,
          durationMinutes: Number(row.duration_minutes) || 30,
        })),
      };
    } catch (e: unknown) {
      return { ok: false, error: toDomainError("Public.listServices", (e as Error).message) };
    }
  }

  async listStaff(centerId: string): Promise<Result<PublicStaffOption[], DomainError>> {
    try {
      const { data, error } = await getSupabaseClient().rpc("public_list_staff_v1", { p_center_id: centerId });
      if (error) return { ok: false, error: toDomainError("Public.listStaff", error.message) };
      const rows = Array.isArray(data) ? data : [];
      return {
        ok: true,
        data: rows.map((row: any) => ({ id: String(row.id), name: String(row.name || "") })),
      };
    } catch (e: unknown) {
      return { ok: false, error: toDomainError("Public.listStaff", (e as Error).message) };
    }
  }

  async listTakenSlots(centerId: string, day: Date): Promise<Result<PublicTakenSlot[], DomainError>> {
    try {
      const { data, error } = await getSupabaseClient().rpc("public_taken_slots_v1", {
        p_center_id: centerId,
        p_day: day.toISOString().slice(0, 10),
      });
      if (error) return { ok: false, error: toDomainError("Public.takenSlots", error.message) };
      const rows = Array.isArray(data) ? data : [];
      return {
        ok: true,
        data: rows.map((row: any) => ({
          dateTime: new Date(row.date_time),
          employeeId: row.employee_id ? String(row.employee_id) : null,
        })),
      };
    } catch (e: unknown) {
      return { ok: false, error: toDomainError("Public.takenSlots", (e as Error).message) };
    }
  }

  async createBooking(request: PublicBookingRequest): Promise<Result<PublicBookingConfirmation, DomainError>> {
    try {
      const { data, error } = await getSupabaseClient().rpc("public_create_booking_v1", {
        p_center_id: request.centerId,
        p_service_id: request.serviceId,
        p_employee_id: request.employeeId,
        p_customer_name: request.customerName,
        p_customer_phone: request.customerPhone,
        p_date_time: request.dateTime.toISOString(),
        p_notes: request.notes?.trim() ? request.notes.trim() : null,
      });
      if (error) return { ok: false, error: toDomainError("Public.createBooking", error.message) };
      const row = (data ?? {}) as any;
      if (!row?.appointment_id) return { ok: false, error: toDomainError("Public.createBooking", "Booking response missing appointment id") };
      return {
        ok: true,
        data: {
          appointmentId: String(row.appointment_id),
          customerId: String(row.customer_id ?? ""),
          status: String(row.status ?? "SCHEDULED"),
        },
      };
    } catch (e: unknown) {
      return { ok: false, error: toDomainError("Public.createBooking", (e as Error).message) };
    }
  }

  async portalLogin(credentials: PortalCredentials): Promise<Result<{ customerId: string; name: string }, DomainError>> {
    try {
      const { data, error } = await getSupabaseClient().rpc("public_client_portal_login_v1", {
        p_center_id: credentials.centerId,
        p_phone: credentials.phone,
        p_token: credentials.token,
      });
      if (error) return { ok: false, error: toDomainError("Portal.login", error.message) };
      const customer = (data as any)?.customer;
      if (!customer?.id) return { ok: false, error: toDomainError("Portal.login", "Portal login response missing customer") };
      return { ok: true, data: { customerId: String(customer.id), name: String(customer.name || "") } };
    } catch (e: unknown) {
      return { ok: false, error: toDomainError("Portal.login", (e as Error).message) };
    }
  }

  async portalProfile(credentials: PortalCredentials): Promise<Result<PortalProfile, DomainError>> {
    try {
      // Login first: it returns the customer id and normalizes the phone the
      // profile RPC re-verifies (exact phone + code, lockout-aware).
      const login = await this.portalLogin(credentials);
      if (!login.ok) return login as Result<PortalProfile, DomainError>;

      const { data, error } = await getSupabaseClient().rpc("public_client_portal_profile_v2", {
        p_center_id: credentials.centerId,
        p_customer_id: login.data.customerId,
        p_phone: credentials.phone,
        p_token: credentials.token,
      });
      if (error) {
        if (isMissingBackendFeature(error.message)) {
          return { ok: false, error: toDomainError("Portal.profile", "BACKEND_METHOD_UNSUPPORTED") };
        }
        return { ok: false, error: toDomainError("Portal.profile", error.message) };
      }
      const row = (data ?? {}) as any;
      const customer = row?.customer ?? {};
      const appointments = Array.isArray(row?.appointments) ? row.appointments : [];
      const invoices = Array.isArray(row?.invoices) ? row.invoices : [];
      return {
        ok: true,
        data: {
          customerId: String(customer.id ?? login.data.customerId),
          name: String(customer.name || login.data.name),
          phone: typeof customer.phone === "string" ? customer.phone : null,
          loyaltyPoints: Number(customer.loyalty_points) || 0,
          totalSpent: Number(customer.total_spent) || 0,
          appointments: appointments.map((a: any) => ({
            id: String(a.id),
            dateTime: new Date(a.date_time),
            status: String(a.status || ""),
            notes: typeof a.notes === "string" ? a.notes : null,
            employeeName: a.employee_name ? String(a.employee_name) : null,
            serviceName: a.service_name ? String(a.service_name) : null,
          })),
          invoices: invoices.map((i: any) => ({
            id: String(i.id),
            serialNumber: typeof i.serial_number === "string" ? i.serial_number : null,
            date: new Date(i.date),
            totalAmount: Number(i.total_amount) || 0,
            tax: Number(i.tax) || 0,
            paymentMethod: String(i.payment_method || ""),
          })),
          // The customer's own reviews — the portal surfaces them so the
          // "how was this visit?" stars show the existing rating.
          reviews: (Array.isArray(row?.reviews) ? row.reviews : []).map((r: any) => ({
            id: String(r.id),
            appointmentId: r.appointment_id ? String(r.appointment_id) : null,
            rating: Number(r.rating) || 0,
            comment: typeof r.comment === "string" ? r.comment : null,
            isPublished: Boolean(r.is_published),
            createdAtISO: String(r.created_at || ""),
          })),
        },
      };
    } catch (e: unknown) {
      return { ok: false, error: toDomainError("Portal.profile", (e as Error).message) };
    }
  }

  async cancelBooking(credentials: PortalCredentials, appointmentId: string, reason?: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await getSupabaseClient().rpc("public_cancel_booking_v1", {
        p_center_id: credentials.centerId,
        p_appointment_id: appointmentId,
        p_phone: credentials.phone,
        p_portal_token: credentials.token,
        p_reason: reason?.trim() ? reason.trim() : null,
      });
      if (error) return { ok: false, error: toDomainError("Portal.cancelBooking", error.message) };
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: toDomainError("Portal.cancelBooking", (e as Error).message) };
    }
  }

  async rescheduleBooking(credentials: PortalCredentials, appointmentId: string, newDateTime: Date, reason?: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await getSupabaseClient().rpc("public_reschedule_booking_v1", {
        p_center_id: credentials.centerId,
        p_appointment_id: appointmentId,
        p_phone: credentials.phone,
        p_portal_token: credentials.token,
        p_new_date_time: newDateTime.toISOString(),
        p_new_employee_id: null,
        p_reason: reason?.trim() ? reason.trim() : null,
      });
      if (error) return { ok: false, error: toDomainError("Portal.rescheduleBooking", error.message) };
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: toDomainError("Portal.rescheduleBooking", (e as Error).message) };
    }
  }

  async portalRateVisit(credentials: PortalCredentials, appointmentId: string, rating: number, comment?: string): Promise<Result<InvoiceRatingSaved, DomainError>> {
    try {
      // Same credential dance as portalProfile: the login RPC resolves the
      // customer row, then the write RPC re-validates it server-side.
      const login = await this.portalLogin(credentials);
      if (!login.ok) return { ok: false, error: login.error };
      const { data, error } = await getSupabaseClient().rpc("public_client_portal_rate_visit_v1", {
        p_center_id: credentials.centerId,
        p_customer_id: login.data.customerId,
        p_appointment_id: appointmentId,
        p_phone: credentials.phone,
        p_token: credentials.token,
        p_rating: rating,
        p_comment: comment?.trim() ? comment.trim() : null,
      });
      if (error) return { ok: false, error: toDomainError("Portal.rateVisit", error.message) };
      const row = (data ?? {}) as any;
      if (!row?.id) return { ok: false, error: toDomainError("Portal.rateVisit", "Invalid response") };
      return { ok: true, data: mapRatingRow(row) };
    } catch (e: unknown) {
      return { ok: false, error: toDomainError("Portal.rateVisit", (e as Error).message) };
    }
  }

  async lookupInvoiceRating(invoiceId: string): Promise<Result<InvoiceRatingLookup, DomainError>> {
    try {
      const { data, error } = await getSupabaseClient().rpc("public_invoice_rating_lookup_v1", {
        p_invoice_id: invoiceId,
      });
      if (error) {
        if (isMissingBackendFeature(error.message)) {
          return { ok: false, error: toDomainError("Public.invoiceRating", "BACKEND_METHOD_UNSUPPORTED") };
        }
        return { ok: false, error: toDomainError("Public.invoiceRating", error.message) };
      }
      const row = (data ?? {}) as any;
      if (!row?.invoice_id) return { ok: false, error: toDomainError("Public.invoiceRating", "NOT_FOUND") };
      return {
        ok: true,
        data: {
          centerId: String(row.center_id),
          centerName: typeof row.center_name === "string" ? row.center_name : null,
          invoiceId: String(row.invoice_id),
          date: new Date(row.date),
          totalAmount: Number(row.total_amount) || 0,
          appointmentId: row.appointment_id ? String(row.appointment_id) : null,
          serviceName: typeof row.service_name === "string" ? row.service_name : null,
          employeeName: typeof row.employee_name === "string" ? row.employee_name : null,
          existingRating: row.existing_rating === null || row.existing_rating === undefined ? null : Number(row.existing_rating),
        },
      };
    } catch (e: unknown) {
      return { ok: false, error: toDomainError("Public.invoiceRating", (e as Error).message) };
    }
  }

  async rateFromInvoice(invoiceId: string, rating: number, comment?: string): Promise<Result<InvoiceRatingSaved, DomainError>> {
    try {
      const { data, error } = await getSupabaseClient().rpc("public_invoice_rate_visit_v1", {
        p_invoice_id: invoiceId,
        p_rating: rating,
        p_comment: comment?.trim() ? comment.trim() : null,
      });
      if (error) {
        if (isMissingBackendFeature(error.message)) {
          return { ok: false, error: toDomainError("Public.invoiceRating", "BACKEND_METHOD_UNSUPPORTED") };
        }
        return { ok: false, error: toDomainError("Public.invoiceRating", error.message) };
      }
      const row = (data ?? {}) as any;
      if (!row?.id) return { ok: false, error: toDomainError("Public.invoiceRating", "Invalid response") };
      return { ok: true, data: mapRatingRow(row) };
    } catch (e: unknown) {
      return { ok: false, error: toDomainError("Public.invoiceRating", (e as Error).message) };
    }
  }
}

function mapRatingRow(row: any): InvoiceRatingSaved {
  return {
    id: String(row.id),
    appointmentId: row.appointment_id ? String(row.appointment_id) : null,
    rating: Number(row.rating) || 0,
    comment: typeof row.comment === "string" ? row.comment : null,
    isPublished: Boolean(row.is_published),
    createdAtISO: String(row.created_at || ""),
  };
}
