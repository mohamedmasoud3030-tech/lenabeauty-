import { describe, expect, it } from "vitest";

function normalizeRecipients(input: string): string[] {
  return input
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function depositLabel(type: "fixed" | "percentage", value: number): string {
  return type === "percentage" ? `${value}%` : `${value.toFixed(2)} OMR`;
}

describe("notifications + payment gateway helpers", () => {
  it("splits recipients by line breaks and commas", () => {
    expect(normalizeRecipients("+96890000000, +96891111111\n+96892222222")).toEqual([
      "+96890000000",
      "+96891111111",
      "+96892222222",
    ]);
  });

  it("formats fixed deposit labels", () => {
    expect(depositLabel("fixed", 10)).toBe("10.00 OMR");
  });

  it("formats percentage deposit labels", () => {
    expect(depositLabel("percentage", 25)).toBe("25%");
  });
});
