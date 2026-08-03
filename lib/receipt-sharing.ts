export function receiptShareMessage(
  receiptNumber: string,
  familyName: string,
  amount: string,
) {
  return [
    `IPSM Music School receipt ${receiptNumber}`,
    `Family: ${familyName}`,
    `Amount: ${amount}`,
    "",
    "The receipt PDF has been downloaded. Please attach it to this WhatsApp message.",
  ].join("\n");
}

export function normalizeWhatsAppPhone(phone?: string | null) {
  if (!phone) return "";
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  return digits;
}

export function whatsappShareUrl(message: string, phone?: string | null) {
  const recipient = normalizeWhatsAppPhone(phone);
  return recipient
    ? `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function isShareCancellation(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function isLikelyMobileBrowser(userAgent: string) {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
}
