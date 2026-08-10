import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260810000003_appointment_overlap_integrity.sql"),
  "utf8",
);
const behavior = readFileSync(
  resolve(process.cwd(), "supabase/tests/20260810000003_appointment_overlap_integrity.sql"),
  "utf8",
);
const rollback = readFileSync(
  resolve(process.cwd(), "supabase/rollbacks/20260810000003_appointment_overlap_integrity.md"),
  "utf8",
);

describe("duration-aware appointment overlap migration", () => {
  it("stores a database-owned service-duration snapshot", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS duration_minutes_snapshot INTEGER");
    expect(migration).toContain("SET duration_minutes_snapshot = service.duration_minutes");
    expect(migration).toContain("NEW.duration_minutes_snapshot := v_service_duration");
    expect(migration).toContain("NEW.duration_minutes_snapshot := OLD.duration_minutes_snapshot");
  });

  it("uses a concurrent-safe half-open exclusion constraint for scheduled staff ranges", () => {
    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS btree_gist");
    expect(migration).toContain("appointments_no_scheduled_staff_overlap");
    expect(migration).toContain("EXCLUDE USING gist");
    expect(migration).toContain("employee_id WITH =");
    expect(migration).toContain("duration_minutes_snapshot * INTERVAL '1 minute'");
    expect(migration).toContain("tsrange(");
    expect(migration).toContain("date_time AT TIME ZONE 'UTC'");
    expect(migration).not.toContain("tstzrange(");
    expect(migration).toContain("'[)'");
    expect(migration).toContain("WITH &&");
    expect(migration).toContain("WHERE (status = 'SCHEDULED')");
  });

  it("keeps the terminal-state protections while replacing exact-time conflict logic", () => {
    expect(migration).toContain("terminal_appointment_cannot_be_changed");
    expect(migration).toContain("terminal_appointment_cannot_be_deleted");
    expect(migration).toContain("invalid_appointment_status_transition");
    expect(migration).not.toContain("a.date_time = NEW.date_time");
  });

  it("ships executable behavioral coverage for overlap boundaries and mutations", () => {
    expect(behavior).toContain("2026-08-11 10:00:00+04");
    expect(behavior).toContain("2026-08-11 10:30:00+04");
    expect(behavior).toContain("2026-08-11 11:00:00+04");
    expect(behavior).toContain("WHEN exclusion_violation THEN NULL");
    expect(behavior).toContain("expected reschedule overlap rejection");
    expect(behavior).toContain("expected changed-service overlap rejection");
    expect(behavior).toContain("catalog edit changed a historical appointment snapshot");
    expect(behavior).toContain("expected terminal update rejection");
    expect(behavior).toContain("expected terminal delete rejection");
    expect(behavior.trimEnd()).toMatch(/ROLLBACK;$/);
  });

  it("documents a bounded rollback to the previous appointment trigger", () => {
    expect(rollback).toContain("DROP CONSTRAINT IF EXISTS appointments_no_scheduled_staff_overlap");
    expect(rollback).toContain("CREATE TRIGGER enforce_appointment_integrity_v1");
    expect(rollback).toContain("DROP COLUMN IF EXISTS duration_minutes_snapshot");
    expect(rollback).toContain("Do not drop btree_gist");
  });
});
