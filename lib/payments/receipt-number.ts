export function nextReceiptNumber(latestReceiptNumber: string | null | undefined, date = new Date()) {
  const year = date.getUTCFullYear();
  const match = latestReceiptNumber?.match(/^RCPT-(\d{4})-(\d{6,})$/);
  const sequence = match?.[1] === String(year) ? Number(match[2]) + 1 : 1;
  return `RCPT-${year}-${String(sequence).padStart(6, "0")}`;
}
