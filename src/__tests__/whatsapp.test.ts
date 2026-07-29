import { describe, expect, it } from "vitest";
import { buildWhatsAppLink, normalizePhone } from "../infrastructure/services/whatsappService";

describe("WhatsApp wa.me deep links", () => {
  it("strips non-digits and a leading 00 country prefix", () => {
    expect(normalizePhone("+968-9123-4567")).toBe("96891234567");
    expect(normalizePhone("0096891234567")).toBe("96891234567");
    expect(normalizePhone("  968 9123 4567 ")).toBe("96891234567");
  });

  it("builds a plain wa.me link with no message", () => {
    expect(buildWhatsAppLink("+96891234567")).toBe("https://wa.me/96891234567");
  });

  it("encodes the message into the text query param", () => {
    const link = buildWhatsAppLink("96891234567", "مرحباً، تذكير بموعدك غداً");
    expect(link.startsWith("https://wa.me/96891234567?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe("مرحباً، تذكير بموعدك غداً");
  });

  it("does not include an empty text param when message is blank", () => {
    expect(buildWhatsAppLink("96891234567", "")).toBe("https://wa.me/96891234567");
    expect(buildWhatsAppLink("96891234567", "   ")).toBe("https://wa.me/96891234567");
  });
});
