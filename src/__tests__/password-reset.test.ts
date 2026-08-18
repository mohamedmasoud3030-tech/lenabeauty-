import { describe, expect, it } from "vitest";
import { passwordResetRedirectUrl } from "../shared/auth/passwordResetRedirect";

describe("password reset redirect", () => {
  it("keeps HashRouter destinations after the hash", () => {
    expect(passwordResetRedirectUrl({ origin: "https://app.example", pathname: "/" })).toBe(
      "https://app.example/#/reset-password",
    );
  });
});
