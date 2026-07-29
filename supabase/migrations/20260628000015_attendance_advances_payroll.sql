-- ============================================================
-- LenaBeauty — Staff operations: Attendance, Advances, Payroll
-- (Phase 1)
-- ------------------------------------------------------------
-- Adds three feature areas previously rendered as DEMO-only pages
-- (AttendancePage, AdvancesPage, PayrollPageEnhanced, StaffAnalyticsPage)
-- with real, tenant-isolated tables. Every table is keyed by center_id
-- and protected by RLS via app_private.is_center_member(center_id),
-- exactly like the rest of the schema.
--
-- Salary model (single salon, 1-3 staff):
--   net_salary = base_salary - advances_deducted
--   advances_deducted = SUM(amount) of APPROVED advances for the
--   employee in the same YYYY-MM as the payroll run.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste & run
--             (run AFTER 20260628000014_client_portal_lockout.sql).
-- ============================================================

-- Ensure the updated_at trigger helper exists (idempotent).
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ------------------------------------------------------------
-- 1. attendance_records
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id    UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  check_in_time  TIME,
  check_out_time TIME,
  method       TEXT NOT NULL DEFAULT 'MANUAL'
                 CHECK (method IN ('MANUAL', 'BIOMETRIC', 'MOBILE')),
  work_hours   NUMERIC(6,2) NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'PRESENT'
                 CHECK (status IN ('PRESENT', 'LATE', 'ABSENT', 'HALF_DAY')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_center       ON public.attendance_records(center_id);
CREATE INDEX IF NOT EXISTS idx_attendance_center_date  ON public.attendance_records(center_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee     ON public.attendance_records(center_id, employee_id);

DO $$ BEGIN CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 2. employee_advances
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_advances (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id  UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount     NUMERIC(12,3) NOT NULL DEFAULT 0,
  reason     TEXT,
  advance_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  status     TEXT NOT NULL DEFAULT 'PENDING'
               CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'DEDUCTED')),
  deducted_in_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advances_center        ON public.employee_advances(center_id);
CREATE INDEX IF NOT EXISTS idx_advances_employee      ON public.employee_advances(center_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_advances_center_date   ON public.employee_advances(center_id, advance_date);

DO $$ BEGIN CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.employee_advances
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 3. payroll_runs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id   UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL,  -- 'YYYY-MM'
  run_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (center_id, period_month)  -- one finalized run per month
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_center ON public.payroll_runs(center_id);

DO $$ BEGIN CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 4. payroll_line_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_line_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id        UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  payroll_run_id   UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id      UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  base_salary      NUMERIC(12,3) NOT NULL DEFAULT 0,
  advances_deducted NUMERIC(12,3) NOT NULL DEFAULT 0,
  net_salary       NUMERIC(12,3) NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_lines_run     ON public.payroll_line_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_center  ON public.payroll_line_items(center_id);

DO $$ BEGIN CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payroll_line_items
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 5. RLS — tenant isolation via app_private.is_center_member
-- ------------------------------------------------------------
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_advances   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_line_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_tenant ON public.attendance_records;
CREATE POLICY attendance_tenant ON public.attendance_records
  FOR ALL USING (app_private.is_center_member(center_id))
  WITH CHECK (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS advances_tenant ON public.employee_advances;
CREATE POLICY advances_tenant ON public.employee_advances
  FOR ALL USING (app_private.is_center_member(center_id))
  WITH CHECK (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS payroll_runs_tenant ON public.payroll_runs;
CREATE POLICY payroll_runs_tenant ON public.payroll_runs
  FOR ALL USING (app_private.is_center_member(center_id))
  WITH CHECK (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS payroll_lines_tenant ON public.payroll_line_items;
CREATE POLICY payroll_lines_tenant ON public.payroll_line_items
  FOR ALL USING (app_private.is_center_member(center_id))
  WITH CHECK (app_private.is_center_member(center_id));
