import { describe, expect, it } from "vitest";
import {
  normalizeWhatsappPhone,
  receiptShareMessage,
  whatsappShareUrl,
} from "@/lib/receipt-sharing";

describe("receipt WhatsApp sharing", () => {
  it("normalizes international family phone numbers", () => {
    expect(normalizeWhatsappPhone("+961 70 123 456")).toBe("96170123456");
    expect(normalizeWhatsappPhone("00961-70-123-456")).toBe("96170123456");
  });

  it("targets the saved family phone and pre-fills receipt details", () => {
    const message = receiptShareMessage(
      "RCPT-2026-000101",
      "Germanos Family",
      "$40.00",
    );
    const url = whatsappShareUrl(message, "+961 70 123 456");
    expect(url).toContain("https://wa.me/96170123456?text=");
    expect(decodeURIComponent(url)).toContain("Germanos Family");
    expect(decodeURIComponent(url)).toContain("RCPT-2026-000101");
    expect(message).not.toContain("sent successfully");
  });

  it("opens the WhatsApp chooser when no valid number is stored", () => {
    expect(whatsappShareUrl("Receipt", null)).toBe(
      "https://wa.me/?text=Receipt",
    );
  });
});
