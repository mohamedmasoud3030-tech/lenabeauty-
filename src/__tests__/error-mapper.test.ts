import { describe, expect, it } from "vitest";
import { mapErrorToMessageKey } from "../application/errors/ErrorMapper";

describe("ErrorMapper structured validation mapping", () => {
  it("maps a VALIDATION_ERROR to its first field issue key", () => {
    const key = mapErrorToMessageKey({
      code: "VALIDATION_ERROR",
      issues: [{ field: "price", key: "validation.number_non_negative" }],
    });
    expect(key).toBe("validation.number_non_negative");
  });

  it("falls back to the generic validation key when no issues are attached", () => {
    expect(mapErrorToMessageKey({ code: "VALIDATION_ERROR" })).toBe("error.validation");
  });

  it("still maps known codes to stable keys", () => {
    expect(mapErrorToMessageKey({ code: "FORBIDDEN" })).toBe("error.forbidden");
  });
});
