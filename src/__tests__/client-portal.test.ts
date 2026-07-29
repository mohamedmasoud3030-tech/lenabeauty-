import { describe, expect, it } from "vitest";

function maskPortalToken(token: string): string {
  if (token.length <= 4) return token;
  return `${token.slice(0, 2)}${"*".repeat(Math.max(0, token.length - 4))}${token.slice(-2)}`;
}

function canLogin(phone: string, token: string): boolean {
  return phone.trim().length >= 6 && token.trim().length >= 6;
}

describe("client portal helpers", () => {
  it("masks portal tokens for safe display", () => {
    expect(maskPortalToken("ABCDEF123456")).toBe("AB********56");
  });

  it("requires minimum phone/token length for login", () => {
    expect(canLogin("96890000000", "ABC12345")).toBe(true);
    expect(canLogin("123", "ABC12345")).toBe(false);
    expect(canLogin("96890000000", "123")).toBe(false);
  });
});
