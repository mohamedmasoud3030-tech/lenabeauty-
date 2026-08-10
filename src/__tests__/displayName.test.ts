import { describe, expect, it } from "vitest";
import {
  getDisplayName,
  getInitials,
  type DisplayablePerson,
} from "../shared/displayName";

describe("getDisplayName", () => {
  it("returns the name when present", () => {
    expect(getDisplayName({ name: "Layla Hassan" }, "Unnamed")).toBe("Layla Hassan");
  });

  it("falls back to username when name is missing", () => {
    expect(getDisplayName({ username: "lena_admin" }, "Unnamed")).toBe("lena_admin");
  });

  it("falls back through the chain: name -> username -> phone", () => {
    expect(getDisplayName({ name: "", username: null, phone: "91234567" }, "Unnamed")).toBe(
      "91234567"
    );
  });

  it("returns the fallback when every field is missing (the crash case)", () => {
    // This is the exact shape that produced `undefined is not an object
    // (evaluating 't.username[0]')` — username undefined, no name.
    expect(getDisplayName({ username: undefined }, "Unnamed")).toBe("Unnamed");
    expect(getDisplayName({}, "Unnamed")).toBe("Unnamed");
    expect(getDisplayName(null, "Unnamed")).toBe("Unnamed");
    expect(getDisplayName(undefined, "Unnamed")).toBe("Unnamed");
  });

  it("treats whitespace-only values as missing", () => {
    expect(getDisplayName({ name: "   ", username: "  " }, "Unnamed")).toBe("Unnamed");
  });

  it("accepts a raw string", () => {
    expect(getDisplayName("Swedish Massage", "Unnamed")).toBe("Swedish Massage");
    expect(getDisplayName("   ", "Unnamed")).toBe("Unnamed");
  });

  it("trims surrounding whitespace", () => {
    expect(getDisplayName({ name: "  Layla  " }, "Unnamed")).toBe("Layla");
  });

  it("handles an incomplete relation object (appointment.customer)", () => {
    // Joined relations can arrive partially loaded; only the known name-like
    // fields are read, extra runtime keys (e.g. id) are ignored.
    const incomplete = { id: "c1" } as unknown as DisplayablePerson;
    expect(getDisplayName(incomplete, "Unnamed")).toBe("Unnamed");
    expect(getDisplayName({ name: "Fatima" }, "Unnamed")).toBe("Fatima");
  });
});

describe("getInitials", () => {
  it("takes the first letter of the first two tokens", () => {
    expect(getInitials({ name: "Layla Hassan" })).toBe("LH");
  });

  it("returns a single initial for a one-word name", () => {
    expect(getInitials({ name: "Layla" })).toBe("L");
  });

  it("never crashes on a missing username (the release blocker)", () => {
    expect(getInitials({ username: undefined })).toBe("·");
    expect(getInitials({})).toBe("·");
    expect(getInitials(null)).toBe("·");
  });

  it("treats whitespace-only names as missing", () => {
    expect(getInitials({ name: "   " })).toBe("·");
  });

  it("does not derive initials from a phone number", () => {
    // A customer with only a phone should not render "91" as initials.
    expect(getInitials({ phone: "91234567" })).toBe("·");
  });

  it("respects Arabic multi-byte characters", () => {
    expect(getInitials({ name: "ليلى محمد" })).toBe("لم");
    expect(getInitials({ name: "فاطمة" })).toBe("ف");
  });

  it("uppercases Latin initials", () => {
    expect(getInitials({ name: "layla hassan" })).toBe("LH");
  });

  it("accepts a raw string and a custom fallback", () => {
    expect(getInitials("Swedish Massage", "?")).toBe("SM");
    expect(getInitials("   ", "?")).toBe("?");
  });

  it("falls back from name to username for initials", () => {
    expect(getInitials({ username: "ahmed" })).toBe("A");
  });
});
