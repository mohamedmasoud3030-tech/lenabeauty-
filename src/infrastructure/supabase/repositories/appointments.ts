import { AppointmentRepository, Result, DomainError } from "../../../domain/ports/repositories";
import { Appointment, AppointmentStatus, VisitStage } from "../../../domain/entities";
import { createUnsupportedWriteError, createQueryError } from ".././errors";
import { getSupabaseClient } from ".././client";
import { TablesInsert, TablesUpdate } from ".././database.types";
import { mapAppointment } from ".././mappers";
import { requiredText, nonNegativeNumber, dateField } from "../../../domain/validation";
import { validatePayload, okValue, getCenterIdFor, deleteById } from "./shared";

export class SupabaseAppointmentAdapter implements AppointmentRepository {
  async list(range: { fromISO: string, toISO: string }): Promise<Result<Appointment[], DomainError>> {
    const centerRes = getCenterIdFor("Appointment.list");
    if (!centerRes.ok) return centerRes as any;

    try {
      const { data, error } = await getSupabaseClient()
        .from('appointments')
        .select(`
          *,
          customers (id, name, phone),
          employees (id, name),
          services (id, name, category_id, price, duration_minutes)
        `)
        .eq('center_id', centerRes.data)
        .gte('date_time', range.fromISO)
        .lt('date_time', range.toISO)
        .order('date_time', { ascending: true });

      if (error) return { ok: false, error: createQueryError("Appointment.list", error.message) };
      return { ok: true, data: data.map(mapAppointment) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Appointment.list", (e as Error).message) };
    }
  }

  async getById(id: string): Promise<Result<Appointment, DomainError>> {
    const centerRes = getCenterIdFor("Appointment.getById");
    if (!centerRes.ok) return centerRes as any;

    if (typeof id !== "string" || !id) {
      return { ok: false, error: createQueryError("Appointment.getById", "Appointment id is required") };
    }

    try {
      const { data, error } = await getSupabaseClient()
        .from('appointments')
        .select(`
          *,
          customers (id, name, phone),
          employees (id, name),
          services (id, name, category_id, price, duration_minutes)
        `)
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .maybeSingle();

      if (error) return { ok: false, error: createQueryError("Appointment.getById", error.message) };
      if (!data) return { ok: false, error: { name: "DomainError", message: "Not found", code: "NOT_FOUND" } };
      return { ok: true, data: mapAppointment(data) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Appointment.getById", (e as Error).message) };
    }
  }

  async create(data: Partial<Appointment>): Promise<Result<Appointment, DomainError>> {
    const centerRes = getCenterIdFor("Appointment.create");
    if (!centerRes.ok) return centerRes as any;

    const customerR = requiredText(data.customerId);
    const employeeR = requiredText(data.employeeId);
    const serviceR = requiredText(data.serviceId);
    const dateR = data.dateTime ? dateField(data.dateTime.toISOString(), { required: true }) : dateField(undefined, { required: true });
    const depositR = nonNegativeNumber(data.depositAmount ?? 0);
    const noShowFeeR = nonNegativeNumber(data.noShowFeeAmount ?? 0);
    const boundary = validatePayload([
      { field: "customer", result: customerR },
      { field: "employee", result: employeeR },
      { field: "service", result: serviceR },
      { field: "dateTime", result: dateR },
      { field: "depositAmount", result: depositR },
      { field: "noShowFeeAmount", result: noShowFeeR },
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const payload: TablesInsert<"appointments"> = {
        center_id: centerRes.data,
        customer_id: okValue(customerR),
        employee_id: okValue(employeeR),
        service_id: okValue(serviceR),
        date_time: (okValue(dateR) as Date).toISOString(),
        // New appointments always start scheduled; terminal states are reached
        // only through valid transitions enforced by the database trigger.
        status: AppointmentStatus.SCHEDULED,
        notes: data.notes,
        deposit_amount: okValue(depositR),
        no_show_fee_amount: okValue(noShowFeeR),
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

    const customerR = data.customerId !== undefined ? requiredText(data.customerId) : null;
    const dateR = data.dateTime !== undefined ? dateField(data.dateTime.toISOString(), { required: true }) : null;
    const depositR = data.depositAmount !== undefined ? nonNegativeNumber(data.depositAmount) : null;
    const noShowFeeR = data.noShowFeeAmount !== undefined ? nonNegativeNumber(data.noShowFeeAmount) : null;
    const boundary = validatePayload([
      ...(customerR ? [{ field: "customer", result: customerR }] : []),
      ...(dateR ? [{ field: "dateTime", result: dateR }] : []),
      ...(depositR ? [{ field: "depositAmount", result: depositR }] : []),
      ...(noShowFeeR ? [{ field: "noShowFeeAmount", result: noShowFeeR }] : []),
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const payload: TablesUpdate<"appointments"> = {};
      if (data.customerId !== undefined) payload.customer_id = okValue(customerR);
      if (data.employeeId !== undefined) payload.employee_id = data.employeeId;
      if (data.serviceId !== undefined) payload.service_id = data.serviceId;
      if (data.dateTime !== undefined) payload.date_time = (okValue(dateR) as Date).toISOString();
      if (data.status !== undefined) payload.status = data.status;
      if (data.notes !== undefined) payload.notes = data.notes;
      if (data.depositAmount !== undefined) payload.deposit_amount = okValue(depositR);
      if (data.noShowFeeAmount !== undefined) payload.no_show_fee_amount = okValue(noShowFeeR);
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
    return deleteById('appointments', 'Appointment.delete', id);
  }

  async transitionVisit(id: string, stage: VisitStage): Promise<Result<Appointment, DomainError>> {
    const centerRes = getCenterIdFor("Appointment.transitionVisit");
    if (!centerRes.ok) return centerRes as any;

    if (typeof id !== "string" || !id) {
      return { ok: false, error: createQueryError("Appointment.transitionVisit", "Appointment id is required") };
    }

    try {
      const { data, error } = await getSupabaseClient().rpc('transition_visit_v1', {
        p_center_id: centerRes.data,
        p_appointment_id: id,
        p_stage: stage,
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('Could not find the function')) {
          return { ok: false, error: createUnsupportedWriteError("Appointment.transitionVisit") };
        }
        return { ok: false, error: createQueryError("Appointment.transitionVisit", error.message) };
      }
      const rpcRow = (data || {}) as { appointment_id?: unknown };
      if (!rpcRow.appointment_id) {
        return { ok: false, error: createQueryError("Appointment.transitionVisit", "Invalid response from visit transition RPC") };
      }

      // Re-read the authoritative row so the caller receives the updated stage
      // and timestamps (the RPC mutates server-side, not the local copy).
      const { data: row, error: readErr } = await getSupabaseClient()
        .from('appointments')
        .select(`*, customers (id, name, phone), employees (id, name), services (id, name, category_id, price, duration_minutes)`)
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .maybeSingle();
      if (readErr) return { ok: false, error: createQueryError("Appointment.transitionVisit", readErr.message) };
      if (!row) return { ok: false, error: createQueryError("Appointment.transitionVisit", "No data returned after transition") };
      return { ok: true, data: mapAppointment(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Appointment.transitionVisit", (e as Error).message) };
    }
  }
}
