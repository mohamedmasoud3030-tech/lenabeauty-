import { describe, expect, it } from "vitest";
import { renderMembershipBootstrap } from "../../scripts/launch/render-membership-bootstrap.mjs";

const userId = "123e4567-e89b-12d3-a456-426614174000";
const centerId = "223e4567-e89b-12d3-a456-426614174000";

describe("first customer membership provisioning", () => {
  it("renders server-side membership and app-metadata role writes", () => {
    const sql = renderMembershipBootstrap({ userId, centerId, role: "staff", fullName: "Mona Hassan" });
    expect(sql).toContain("INSERT INTO public.center_memberships");
    expect(sql).toContain("UPDATE auth.users");
    expect(sql).toContain("'STAFF'");
    expect(sql).toContain("Auth user does not exist");
    expect(sql).not.toMatch(/encrypted_password|password_hash|service[_ -]?role|VITE_/i);
  });

  it("escapes display names rather than interpolating executable SQL", () => {
    const sql = renderMembershipBootstrap({ userId, centerId, role: "MANAGER", fullName: "O'Reilly" });
    expect(sql).toContain("'O''Reilly'");
  });

  it("rejects placeholder UUIDs and unsupported roles", () => {
    expect(() => renderMembershipBootstrap({
      userId: "00000000-0000-0000-0000-000000000000",
      centerId,
      role: "STAFF",
      fullName: "User",
    })).toThrow(/non-placeholder UUID/);

    expect(() => renderMembershipBootstrap({ userId, centerId, role: "OWNER", fullName: "User" }))
      .toThrow("role must be ADMIN, MANAGER, or STAFF");
  });
});
