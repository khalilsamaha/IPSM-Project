import type { PrismaClient } from "@prisma/client";
import { formatCurrency, formatDate } from "@/lib/records/format";
import { generateUniqueReceiptNumber } from "@/lib/payments/receipt-repair";

type PaymentStore = Pick<PrismaClient, "payment">;
type ReceiptPayment = {
  receiptNumber: string | null;
  paymentDate: Date;
  paymentMethod: string;
  totalAmountCents: number;
  family: { name: string; email: string | null; phone: string | null; fatherPhone?: string | null; motherPhone?: string | null; fatherEmail?: string | null; motherEmail?: string | null } | null;
  student?: { studentCode: string; firstName: string; lastName: string; email: string | null; phone: string | null } | null;
  createdBy?: { name?: string | null; email: string } | null;
  items: {
    amountCents: number;
    enrollment: {
      courseName: string;
      feeCents: number;
      discountCents: number;
      finalFeeCents: number;
      remainingCents: number;
      season: { name: string };
      course?: { name: string } | null;
      level?: { name: string } | null;
      student: { studentCode: string; firstName: string; lastName: string };
    };
  }[];
};

type PdfTextOptions = { size?: number; font?: "regular" | "bold"; leading?: number };

function esc(value: string) { return value.replace(/[\\()]/g, "\\$&"); }
function normalize(value: string) { return value.replace(/[\r\n]+/g, " ").replace(/[^\x20-\x7E]/g, "-"); }
function moneyText(cents: number) { return formatCurrency(cents).replace("$", "USD "); }
function titleCase(value: string) { return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()); }
function unique(values: (string | null | undefined)[]) { return Array.from(new Set(values.filter(Boolean) as string[])); }

function amountInWords(cents: number) {
  const ones = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const underThousand = (value: number): string => {
    if (value < 20) return ones[value];
    if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? `-${ones[value % 10].toLowerCase()}` : ""}`;
    return `${ones[Math.floor(value / 100)]} hundred${value % 100 ? ` ${underThousand(value % 100).toLowerCase()}` : ""}`;
  };
  const dollars = Math.floor(Math.abs(cents) / 100);
  const remainder = Math.abs(cents) % 100;
  const parts: string[] = [];
  if (dollars >= 1_000_000) parts.push(`${underThousand(Math.floor(dollars / 1_000_000))} million`);
  if (Math.floor(dollars / 1000) % 1000) parts.push(`${underThousand(Math.floor(dollars / 1000) % 1000)} thousand`);
  if (dollars % 1000 || !parts.length) parts.push(underThousand(dollars % 1000));
  return `${cents < 0 ? "Negative " : ""}${parts.join(" ")} dollars and ${String(remainder).padStart(2, "0")}/100 only`;
}

function addText(commands: string[], x: number, y: number, text: string, options: PdfTextOptions = {}) {
  commands.push(`BT /${options.font === "bold" ? "F2" : "F1"} ${options.size ?? 9} Tf ${x} ${y} Td (${esc(normalize(text))}) Tj ET`);
}

function addLine(commands: string[], x1: number, y1: number, x2: number, y2: number) { commands.push(`${x1} ${y1} m ${x2} ${y2} l S`); }
function addRect(commands: string[], x: number, y: number, w: number, h: number) { commands.push(`${x} ${y} ${w} ${h} re S`); }
function truncate(value: string, max = 30) { return value.length > max ? `${value.slice(0, max - 1)}...` : value; }

export async function generateReceiptNumber(store: PaymentStore, date = new Date()) {
  return generateUniqueReceiptNumber(store, date);
}

export function receiptPdfPath(paymentId: string) {
  return `/api/receipts/${paymentId}`;
}

export function buildReceiptPdf(payment: ReceiptPayment) {
  const receiptYear = payment.receiptNumber?.match(/RCPT-(\d{4})-/)?.[1] ?? String(payment.paymentDate.getUTCFullYear());
  const students = unique(payment.items.map((item) => `${item.enrollment.student.firstName} ${item.enrollment.student.lastName}`));
  const studentIds = unique(payment.items.map((item) => item.enrollment.student.studentCode));
  const seasons = unique(payment.items.map((item) => item.enrollment.season.name));
  const courses = unique(payment.items.map((item) => `${item.enrollment.course?.name ?? item.enrollment.courseName}${item.enrollment.level?.name ? ` / ${item.enrollment.level.name}` : ""}`));
  const remainingBalance = payment.items.reduce((sum, item) => sum + item.enrollment.remainingCents, 0);
  const payerName = payment.family?.name ?? (payment.student ? `${payment.student.studentCode} — ${payment.student.firstName} ${payment.student.lastName}` : "Independent Student");
  const parentContact = payment.family ? unique([payment.family.phone, payment.family.email, payment.family.fatherPhone, payment.family.motherPhone, payment.family.fatherEmail, payment.family.motherEmail]).join(" / ") || "Not available" : unique([payment.student?.phone, payment.student?.email]).join(" / ") || "Not available";
  const receivedBy = payment.createdBy?.name ?? payment.createdBy?.email ?? "IPSM Staff";
  const commands = ["0.20 w", "0 0 0 RG"];

  addText(commands, 48, 748, "IPSM", { size: 24, font: "bold" });
  addText(commands, 118, 756, "IPSM Music School", { size: 16, font: "bold" });
  addText(commands, 118, 738, "Official Payment Receipt", { size: 12 });
  addText(commands, 420, 756, `Receipt No: ${payment.receiptNumber ?? "Pending"}`, { size: 10, font: "bold" });
  addText(commands, 420, 740, `Year: ${receiptYear}`, { size: 10 });
  addLine(commands, 48, 724, 564, 724);

  const left = [["Payment date", formatDate(payment.paymentDate)], ["Student ID", studentIds.join(", ") || "-"], ["Student full name", students.join(", ") || "-"], [payment.family ? "Family / Group" : "Independent Student", payerName]];
  const right = [["Parent contact", parentContact], ["Season", seasons.join(", ") || "-"], ["Course(s) / Level(s)", courses.join(", ") || "-"], ["Payment method", titleCase(payment.paymentMethod)]];
  left.forEach(([label, value], index) => { const y = 698 - index * 20; addText(commands, 54, y, `${label}:`, { font: "bold" }); addText(commands, 150, y, truncate(value, 40)); });
  right.forEach(([label, value], index) => { const y = 698 - index * 20; addText(commands, 318, y, `${label}:`, { font: "bold" }); addText(commands, 420, y, truncate(value, 32)); });

  addText(commands, 54, 600, "Payment Allocation", { size: 12, font: "bold" });
  addRect(commands, 48, 578, 516, 22);
  const cols = [54, 240, 314, 376, 444, 514];
  ["Fee type / course", "Due", "Discount", "Paid", "Balance"].forEach((header, index) => addText(commands, cols[index], 586, header, { font: "bold" }));
  let y = 556;
  payment.items.slice(0, 9).forEach((item) => {
    const enrollment = item.enrollment;
    addText(commands, cols[0], y, truncate(`${enrollment.course?.name ?? enrollment.courseName}${enrollment.level?.name ? ` / ${enrollment.level.name}` : ""}`, 34));
    addText(commands, cols[1], y, moneyText(enrollment.feeCents));
    addText(commands, cols[2], y, moneyText(enrollment.discountCents));
    addText(commands, cols[3], y, moneyText(item.amountCents));
    addText(commands, cols[4], y, moneyText(enrollment.remainingCents));
    addLine(commands, 48, y - 7, 564, y - 7);
    y -= 22;
  });
  if (payment.items.length > 9) addText(commands, cols[0], y, `Additional allocations omitted from PDF preview: ${payment.items.length - 9}`, { size: 8 });

  addRect(commands, 320, 210, 244, 112);
  addText(commands, 334, 296, `Total paid: ${formatCurrency(payment.totalAmountCents)}`, { size: 12, font: "bold" });
  addText(commands, 334, 276, `Amount in words: ${truncate(amountInWords(payment.totalAmountCents), 42)}`);
  addText(commands, 334, 256, `Received by: ${truncate(receivedBy, 35)}`);
  addText(commands, 334, 236, `Remaining balance after payment: ${formatCurrency(remainingBalance)}`, { font: "bold" });

  addRect(commands, 48, 210, 230, 112);
  addText(commands, 62, 296, "Signature / Stamp", { size: 12, font: "bold" });
  addLine(commands, 72, 246, 248, 246);
  addText(commands, 72, 230, "Authorized signature and school stamp");

  addText(commands, 48, 176, "System-generated note", { font: "bold" });
  addText(commands, 48, 160, "This receipt is generated by the IPSM system and is valid without manual alteration.");
  addText(commands, 48, 146, "Downloading or reprinting this PDF reuses the same receipt number and does not create a new payment allocation.", { size: 8 });

  const stream = commands.join("\n");
  const objects = ["1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj", "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj", "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /Contents 5 0 R >> endobj", "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj", `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`, "6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj"];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) { offsets.push(pdf.length); pdf += `${object}\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((o) => String(o).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}
