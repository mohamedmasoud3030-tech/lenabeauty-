import { Result, DomainError, BookingRepository, BookingInput, PublicService, PublicStaff, PublicCenterInfo } from "../../../domain/ports/repositories";
import { Appointment } from "../../../domain/entities";
import { createQueryError } from ".././errors";
import { getSupabaseClient } from ".././client";
import { mapAppointment } from ".././mappers";
import { getCenterIdFor } from "./shared";

export class SupabaseBookingAdapter implements BookingRepository {
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
