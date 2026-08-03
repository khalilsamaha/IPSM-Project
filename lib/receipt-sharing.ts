export function receiptShareMessage(
  receiptNumber: string,
  familyName: string,
  amount: string,
) {
  return [
    `IPSM Music School receipt ${receiptNumber}`,
    `Family: ${familyName}`,
    `Amount paid: ${amount}`,
    "",
    "Please find the official receipt PDF attached.",
  ].join("\n");
}

export function normalizeWhatsappPhone(phone?: string | null) {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits.length >= 8 ? digits : "";
}

export function whatsappShareUrl(
  message: string,
  phone?: string | null,
) {
  const target = normalizeWhatsappPhone(phone);
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
}

export function isShareCancellation(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
