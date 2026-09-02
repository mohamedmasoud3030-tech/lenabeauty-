import { Result, DomainError, AttendanceRepository, AdvanceRepository, PayrollRepository } from "../../../domain/ports/repositories";
import { AttendanceRecord, EmployeeAdvance, PayrollRun, PayrollLineItem } from "../../../domain/entities";
import { createQueryError } from ".././errors";
import { getSupabaseClient } from ".././client";
import { TablesInsert, TablesUpdate } from ".././database.types";
import { mapAttendanceRecord, mapEmployeeAdvance, mapPayrollRun, mapPayrollLineItem } from ".././mappers";
import { requiredText, nonNegativeNumber, positiveNumber, dateField, DomainValidationError } from "../../../domain/validation";
import { isCheckoutAfterCheckin } from "../../../domain/attendance";
import { validatePayload, okValue, getCenterIdFor, toDateOnly } from "./shared";

export class SupabaseAttendanceAdapter implements AttendanceRepository {
  async list(range?: { fromISO: string; toISO: string }): Promise<Result<AttendanceRecord[], DomainError>> {
    const centerRes = getCenterIdFor("Attendance.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      let req = getSupabaseClient()
        .from('attendance_records')
        .select('*')
        .eq('center_id', centerRes.data)
        .order('date', { ascending: false });

      if (range?.fromISO && range?.toISO) {
        req = req.gte('date', toDateOnly(new Date(range.fromISO))).lte('date', toDateOnly(new Date(range.toISO)));
      }

      const { data, error } = await req;
      if (error) return { ok: false, error: createQueryError("Attendance.list", error.message) };
      return { ok: true, data: (data || []).map(mapAttendanceRecord) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Attendance.list", (e as Error).message) };
    }
  }

  async listByEmployee(employeeId: string, range?: { fromISO: string; toISO: string }): Promise<Result<AttendanceRecord[], DomainError>> {
    const centerRes = getCenterIdFor("Attendance.listByEmployee");
    if (!centerRes.ok) return centerRes as any;
    try {
      let req = getSupabaseClient()
        .from('attendance_records')
        .select('*')
        .eq('center_id', centerRes.data)
        .eq('employee_id', employeeId)
        .order('date', { ascending: false });

      if (range?.fromISO && range?.toISO) {
        req = req.gte('date', toDateOnly(new Date(range.fromISO))).lte('date', toDateOnly(new Date(range.toISO)));
      }

      const { data, error } = await req;
      if (error) return { ok: false, error: createQueryError("Attendance.listByEmployee", error.message) };
      return { ok: true, data: (data || []).map(mapAttendanceRecord) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Attendance.listByEmployee", (e as Error).message) };
    }
  }

  async create(data: Partial<AttendanceRecord>): Promise<Result<AttendanceRecord, DomainError>> {
    const centerRes = getCenterIdFor("Attendance.create");
    if (!centerRes.ok) return centerRes as any;

    const employeeR = requiredText(data.employeeId);
    const dateR = dateField(data.date ? new Date(data.date).toISOString() : new Date().toISOString(), { required: true });
    const workHoursR = nonNegativeNumber(data.workHours ?? 0);
    const boundary = validatePayload([
      { field: "employee", result: employeeR },
      { field: "date", result: dateR },
      { field: "workHours", result: workHoursR },
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    // PostgreSQL TIME values are strings such as "09:00"; Date parsing is not
    // reliable for that form, so validate them as explicit times of day.
    if (data.checkInTime && data.checkOutTime && !isCheckoutAfterCheckin(data.checkInTime, data.checkOutTime)) {
      return {
        ok: false,
        error: new DomainValidationError([{ field: "checkOut", key: "validation.checkout_after_checkin" }]),
      };
    }

    try {
      const payload: TablesInsert<"attendance_records"> = {
        center_id: centerRes.data,
        employee_id: okValue(employeeR),
        date: toDateOnly((okValue(dateR) as Date)),
        check_in_time: data.checkInTime || null,
        check_out_time: data.checkOutTime || null,
        method: data.method || 'MANUAL',
        work_hours: okValue(workHoursR),
        status: data.status || 'PRESENT',
        notes: data.notes || null
      };
      const { data: row, error } = await getSupabaseClient()
        .from('attendance_records')
        .insert(payload)
        .select()
        .maybeSingle();
      if (error) return { ok: false, error: createQueryError("Attendance.create", error.message) };
      if (!row) return { ok: false, error: createQueryError("Attendance.create", "No data returned after insert") };
      return { ok: true, data: mapAttendanceRecord(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Attendance.create", (e as Error).message) };
    }
  }

  async update(id: string, data: Partial<AttendanceRecord>): Promise<Result<AttendanceRecord, DomainError>> {
    const centerRes = getCenterIdFor("Attendance.update");
    if (!centerRes.ok) return centerRes as any;
    if (data.checkInTime && data.checkOutTime && !isCheckoutAfterCheckin(data.checkInTime, data.checkOutTime)) {
      return {
        ok: false,
        error: new DomainValidationError([{ field: "checkOut", key: "validation.checkout_after_checkin" }]),
      };
    }
    try {
      const payload: TablesUpdate<"attendance_records"> = {};
      if (data.employeeId !== undefined) payload.employee_id = data.employeeId;
      if (data.date !== undefined) payload.date = toDateOnly(new Date(data.date));
      if (data.checkInTime !== undefined) payload.check_in_time = data.checkInTime || null;
      if (data.checkOutTime !== undefined) payload.check_out_time = data.checkOutTime || null;
      if (data.method !== undefined) payload.method = data.method;
      if (data.workHours !== undefined) payload.work_hours = data.workHours;
      if (data.status !== undefined) payload.status = data.status;
      if (data.notes !== undefined) payload.notes = data.notes || null;

      delete payload.center_id;

      const { data: row, error } = await getSupabaseClient()
        .from('attendance_records')
        .update(payload)
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .select()
        .maybeSingle();
      if (error) return { ok: false, error: createQueryError("Attendance.update", error.message) };
      if (!row) return { ok: false, error: createQueryError("Attendance.update", "No data returned after update") };
      return { ok: true, data: mapAttendanceRecord(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Attendance.update", (e as Error).message) };
    }
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    const centerRes = getCenterIdFor("Attendance.delete");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { error } = await getSupabaseClient()
        .from('attendance_records')
        .delete()
        .eq('id', id)
        .eq('center_id', centerRes.data);
      if (error) return { ok: false, error: createQueryError("Attendance.delete", error.message) };
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Attendance.delete", (e as Error).message) };
    }
  }
}

export class SupabaseAdvanceAdapter implements AdvanceRepository {
  async list(range?: { fromISO: string; toISO: string }): Promise<Result<EmployeeAdvance[], DomainError>> {
    const centerRes = getCenterIdFor("Advance.list");
    if (!centerRes.ok) return centerRes as any;
    try {
      let request = getSupabaseClient()
        .from('employee_advances')
        .select('*')
        .eq('center_id', centerRes.data)
        .order('advance_date', { ascending: false });
      if (range?.fromISO && range?.toISO) {
        request = request.gte('advance_date', range.fromISO).lte('advance_date', range.toISO);
      }
      const { data, error } = await request;
      if (error) return { ok: false, error: createQueryError("Advance.list", error.message) };
      return { ok: true, data: (data || []).map(mapEmployeeAdvance) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Advance.list", (e as Error).message) };
    }
  }

  async listByEmployee(employeeId: string, range?: { fromISO: string; toISO: string }): Promise<Result<EmployeeAdvance[], DomainError>> {
    const centerRes = getCenterIdFor("Advance.listByEmployee");
    if (!centerRes.ok) return centerRes as any;
    try {
      let request = getSupabaseClient()
        .from('employee_advances')
        .select('*')
        .eq('center_id', centerRes.data)
        .eq('employee_id', employeeId)
        .order('advance_date', { ascending: false });
      if (range?.fromISO && range?.toISO) {
        request = request.gte('advance_date', range.fromISO).lte('advance_date', range.toISO);
      }
      const { data, error } = await request;
      if (error) return { ok: false, error: createQueryError("Advance.listByEmployee", error.message) };
      return { ok: true, data: (data || []).map(mapEmployeeAdvance) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Advance.listByEmployee", (e as Error).message) };
    }
  }

  async create(data: Partial<EmployeeAdvance>): Promise<Result<EmployeeAdvance, DomainError>> {
    const centerRes = getCenterIdFor("Advance.create");
    if (!centerRes.ok) return centerRes as any;

    const employeeR = requiredText(data.employeeId);
    const amountR = positiveNumber(data.amount);
    const boundary = validatePayload([
      { field: "employee", result: employeeR },
      { field: "amount", result: amountR },
    ]);
    if (!boundary.ok) return { ok: false, error: boundary.error };

    try {
      const payload: TablesInsert<"employee_advances"> = {
        center_id: centerRes.data,
        employee_id: okValue(employeeR),
        amount: okValue(amountR),
        reason: data.reason || '',
        advance_date: data.advanceDate ? new Date(data.advanceDate).toISOString() : new Date().toISOString(),
        status: data.status || 'PENDING',
        notes: data.notes || null
      };
      const { data: row, error } = await getSupabaseClient()
        .from('employee_advances')
        .insert(payload)
        .select()
        .maybeSingle();
      if (error) return { ok: false, error: createQueryError("Advance.create", error.message) };
      if (!row) return { ok: false, error: createQueryError("Advance.create", "No data returned after insert") };
      return { ok: true, data: mapEmployeeAdvance(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Advance.create", (e as Error).message) };
    }
  }

  async update(id: string, data: Partial<EmployeeAdvance>): Promise<Result<EmployeeAdvance, DomainError>> {
    const centerRes = getCenterIdFor("Advance.update");
    if (!centerRes.ok) return centerRes as any;
    try {
      const payload: TablesUpdate<"employee_advances"> = {};
      if (data.employeeId !== undefined) payload.employee_id = data.employeeId;
      if (data.amount !== undefined) payload.amount = data.amount;
      if (data.reason !== undefined) payload.reason = data.reason;
      if (data.advanceDate !== undefined) payload.advance_date = new Date(data.advanceDate).toISOString();
      if (data.status !== undefined) payload.status = data.status;
      if (data.notes !== undefined) payload.notes = data.notes || null;

      delete payload.center_id;

      const { data: row, error } = await getSupabaseClient()
        .from('employee_advances')
        .update(payload)
        .eq('id', id)
        .eq('center_id', centerRes.data)
        .select()
        .maybeSingle();
      if (error) return { ok: false, error: createQueryError("Advance.update", error.message) };
      if (!row) return { ok: false, error: createQueryError("Advance.update", "No data returned after update") };
      return { ok: true, data: mapEmployeeAdvance(row) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Advance.update", (e as Error).message) };
    }
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    const centerRes = getCenterIdFor("Advance.delete");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { error } = await getSupabaseClient()
        .from('employee_advances')
        .delete()
        .eq('id', id)
        .eq('center_id', centerRes.data);
      if (error) return { ok: false, error: createQueryError("Advance.delete", error.message) };
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Advance.delete", (e as Error).message) };
    }
  }
}

export class SupabasePayrollAdapter implements PayrollRepository {
  async listRuns(): Promise<Result<PayrollRun[], DomainError>> {
    const centerRes = getCenterIdFor("Payroll.listRuns");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient()
        .from('payroll_runs')
        .select('*')
        .eq('center_id', centerRes.data)
        .order('run_date', { ascending: false });
      if (error) return { ok: false, error: createQueryError("Payroll.listRuns", error.message) };
      return { ok: true, data: (data || []).map(mapPayrollRun) };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Payroll.listRuns", (e as Error).message) };
    }
  }

  async getRun(id: string): Promise<Result<{ run: PayrollRun; lines: PayrollLineItem[] }, DomainError>> {
    const centerRes = getCenterIdFor("Payroll.getRun");
    if (!centerRes.ok) return centerRes as any;
    try {
      const client = getSupabaseClient();
      const [runRes, linesRes] = await Promise.all([
        client.from('payroll_runs').select('*').eq('id', id).eq('center_id', centerRes.data).maybeSingle(),
        client.from('payroll_line_items').select('*').eq('payroll_run_id', id).eq('center_id', centerRes.data).order('created_at', { ascending: true })
      ]);
      if (runRes.error) return { ok: false, error: createQueryError("Payroll.getRun", runRes.error.message) };
      if (linesRes.error) return { ok: false, error: createQueryError("Payroll.getRun", linesRes.error.message) };
      if (!runRes.data) return { ok: false, error: { name: "DomainError", message: "Not found", code: "NOT_FOUND" } };
      return {
        ok: true,
        data: {
          run: mapPayrollRun(runRes.data),
          lines: (linesRes.data || []).map(mapPayrollLineItem)
        }
      };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Payroll.getRun", (e as Error).message) };
    }
  }

  async createRun(input: { periodMonth: string; notes?: string }): Promise<Result<{ run: PayrollRun; lines: PayrollLineItem[] }, DomainError>> {
    const centerRes = getCenterIdFor("Payroll.createRun");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { data, error } = await getSupabaseClient().rpc('create_payroll_run_v1', {
        p_center_id: centerRes.data,
        p_period_month: input.periodMonth,
        p_notes: input.notes ?? null,
      });
      if (error) {
        const message = error.code === '23505'
          ? 'A payroll run for this month already exists.'
          : error.message;
        return { ok: false, error: createQueryError("Payroll.createRun", message) };
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, error: createQueryError("Payroll.createRun", "Invalid payroll response") };
      }
      const row = data as { run?: unknown; lines?: unknown[] };
      if (!row.run || !Array.isArray(row.lines)) {
        return { ok: false, error: createQueryError("Payroll.createRun", "Incomplete payroll response") };
      }
      return {
        ok: true,
        data: {
          run: mapPayrollRun(row.run),
          lines: row.lines.map(mapPayrollLineItem),
        },
      };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Payroll.createRun", (e as Error).message) };
    }
  }

  async deleteRun(id: string): Promise<Result<void, DomainError>> {
    const centerRes = getCenterIdFor("Payroll.deleteRun");
    if (!centerRes.ok) return centerRes as any;
    try {
      const { error } = await getSupabaseClient().rpc('delete_payroll_run_v1', {
        p_center_id: centerRes.data,
        p_payroll_run_id: id,
      });
      if (error) return { ok: false, error: createQueryError("Payroll.deleteRun", error.message) };
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createQueryError("Payroll.deleteRun", (e as Error).message) };
    }
  }
}
