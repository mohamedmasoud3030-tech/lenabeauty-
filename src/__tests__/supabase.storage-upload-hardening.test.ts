import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260817000005_storage_upload_hardening.sql"),
  "utf8",
);
const repository = readFileSync(
  resolve(process.cwd(), "src/infrastructure/supabase/repositories/settings.ts"),
  "utf8",
);

describe("center-assets upload hardening", () => {
  it("enforces server-side size, MIME, center path, and ADMIN policy", () => {
    expect(migration).toContain("file_size_limit");
    expect(migration).toContain("2097152");
    expect(migration).toContain("allowed_mime_types");
    expect(migration).toContain("'image/jpeg'");
    expect(migration).toContain("'image/png'");
    expect(migration).toContain("'image/webp'");
    expect(migration).toContain("center_assets_admin_insert");
    expect(migration).toContain("center_assets_admin_update");
    expect(migration).toContain("app_private.storage_path_center_id(name)");
    expect(migration).toContain("ARRAY['ADMIN']");
  });

  it("validates before upload and uses one stable replacement object", () => {
    expect(repository).toContain('new Set(["image/jpeg", "image/png", "image/webp"])');
    expect(repository).toContain("file.size > 2 * 1024 * 1024");
    expect(repository).toContain("validation.logo_type");
    expect(repository).toContain("validation.logo_size");
    expect(repository).toContain("`${centerRes.data}/logo-current`");
    expect(repository).toContain("contentType: file.type");
  });
});
