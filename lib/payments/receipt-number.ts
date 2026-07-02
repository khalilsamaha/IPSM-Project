export type ParsedReceiptNumber = { year: number; sequence: number };

const receiptNumberPattern = /^RCPT-(\d{4})-(\d{4,})$/;

export function parseReceiptNumber(receiptNumber: string | null | undefined): ParsedReceiptNumber | null {
  const match = receiptNumber?.match(receiptNumberPattern);
  if (!match) return null;
  return { year: Number(match[1]), sequence: Number(match[2]) };
}

export function formatReceiptNumber(year: number, sequence: number) {
  return `RCPT-${year}-${String(sequence).padStart(6, "0")}`;
}

export function nextReceiptNumber(latestReceiptNumber: string | null | undefined, date = new Date()) {
  const year = date.getUTCFullYear();
  const parsed = parseReceiptNumber(latestReceiptNumber);
  const sequence = parsed?.year === year ? parsed.sequence + 1 : 1;
  return formatReceiptNumber(year, sequence);
}

export function nextReceiptNumberFromExisting(receiptNumbers: (string | null | undefined)[], date = new Date()) {
  const year = date.getUTCFullYear();
  const latestSequence = receiptNumbers.reduce((max, receiptNumber) => {
    const parsed = parseReceiptNumber(receiptNumber);
    return parsed?.year === year && parsed.sequence > max ? parsed.sequence : max;
  }, 0);
  return formatReceiptNumber(year, latestSequence + 1);
}
