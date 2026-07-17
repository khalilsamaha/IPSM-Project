import type { PrismaClient } from "@prisma/client";
import { formatCurrency, formatFormalDate } from "@/lib/records/format";
import { formatPaymentMethod } from "@/lib/payment-methods";
import { generateUniqueReceiptNumber } from "@/lib/payments/receipt-repair";

type PaymentStore = Pick<PrismaClient, "payment">;
type ReceiptPayment = {
  receiptNumber: string | null;
  paymentDate: Date;
  paymentMethod: string;
  totalAmountCents: number;
  family: { familyCode?: string | null; name: string; email: string | null; phone: string | null; fatherPhone?: string | null; motherPhone?: string | null; fatherEmail?: string | null; motherEmail?: string | null } | null;
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

export async function generateReceiptNumber(store: PaymentStore, date = new Date()) {
  return generateUniqueReceiptNumber(store, date);
}

export function receiptPdfPath(paymentId: string) {
  return `/api/receipts/${paymentId}`;
}

export type ReceiptLayout = "a5" | "a4-two-copies";

type DrawCommand = string;
type PageSpec = { width: number; height: number; commands: DrawCommand[] };

const A5 = { width: 420, height: 595 };
const A4 = { width: 595, height: 842 };

function textWidth(text: string, size: number) { return normalize(text).length * size * 0.52; }
function wrapText(text: string, maxWidth: number, size: number) {
  const words = normalize(text || "-").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words.length ? words : ["-"]) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size) <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      if (textWidth(word, size) <= maxWidth) line = word;
      else {
        const charsPerLine = Math.max(4, Math.floor(maxWidth / (size * 0.52)));
        for (let i = 0; i < word.length; i += charsPerLine) lines.push(word.slice(i, i + charsPerLine));
        line = "";
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}
function addWrappedText(commands: string[], x: number, y: number, text: string, width: number, options: PdfTextOptions = {}) {
  const size = options.size ?? 8;
  const leading = options.leading ?? size + 2;
  const lines = wrapText(text, width, size);
  lines.forEach((line, index) => addText(commands, x, y - index * leading, line, options));
  return lines.length * leading;
}
function drawField(commands: string[], x: number, y: number, label: string, value: string, width: number) {
  addText(commands, x, y, `${label}:`, { size: 7, font: "bold" });
  return addWrappedText(commands, x + 72, y, value || "-", width - 74, { size: 7, leading: 8 });
}
function addDashedLine(commands: string[], x1: number, y: number, x2: number) { commands.push(`[4 3] 0 d ${x1} ${y} m ${x2} ${y} l S [] 0 d`); }

function receiptFacts(payment: ReceiptPayment) {
  const receiptYear = payment.receiptNumber?.match(/RCPT-(\d{4})-/)?.[1] ?? String(payment.paymentDate.getUTCFullYear());
  const students = unique(payment.items.map((item) => `${item.enrollment.student.firstName} ${item.enrollment.student.lastName}`));
  const studentIds = unique(payment.items.map((item) => item.enrollment.student.studentCode));
  const seasons = unique(payment.items.map((item) => item.enrollment.season.name));
  const courses = unique(payment.items.map((item) => `${item.enrollment.course?.name ?? item.enrollment.courseName}${item.enrollment.level?.name ? ` / ${item.enrollment.level.name}` : ""}`));
  const levels = unique(payment.items.map((item) => item.enrollment.level?.name));
  const remainingBalance = payment.items.reduce((sum, item) => sum + item.enrollment.remainingCents, 0);
  const payerName = payment.family?.name ?? (payment.student ? `${payment.student.studentCode} - ${payment.student.firstName} ${payment.student.lastName}` : "Independent Student");
  const contact = payment.family ? unique([payment.family.phone, payment.family.email, payment.family.fatherPhone, payment.family.motherPhone, payment.family.fatherEmail, payment.family.motherEmail]).join(" / ") || "Not available" : unique([payment.student?.phone, payment.student?.email]).join(" / ") || "Not available";
  const receivedBy = payment.createdBy?.name ?? payment.createdBy?.email ?? "IPSM Staff";
  return { receiptYear, students, studentIds, seasons, courses, levels, remainingBalance, payerName, contact, receivedBy };
}

function drawA5Receipt(payment: ReceiptPayment, copyLabel = "", allocationStart = 0): PageSpec[] {
  const facts = receiptFacts(payment);
  const pages: PageSpec[] = [];
  let index = allocationStart;
  let pageNo = 1;
  do {
    const commands = ["0.20 w", "0 0 0 RG"];
    const margin = 24;
    addRect(commands, margin, 552, 54, 28);
    addText(commands, margin + 8, 562, "IPSM", { size: 10, font: "bold" });
    addText(commands, 88, 568, "IPSM Music School", { size: 15, font: "bold" });
    addText(commands, 88, 553, `Official Payment Receipt${copyLabel ? ` - ${copyLabel}` : ""}`, { size: 9 });
    addText(commands, 260, 570, `Receipt No: ${payment.receiptNumber ?? "Pending"}`, { size: 8, font: "bold" });
    addText(commands, 260, 558, `Payment date: ${formatFormalDate(payment.paymentDate)}`, { size: 8 });
    addText(commands, 260, 546, `Year: ${facts.receiptYear}`, { size: 8 });
    addLine(commands, margin, 538, A5.width - margin, 538);

    let y = 522;
    const fields: [string, string][] = [
      ["Family code", payment.family?.familyCode ?? "-"], ["Student code(s)", facts.studentIds.join(", ") || "-"],
      ["Student name(s)", facts.students.join(", ") || "-"], ["Family/group", facts.payerName],
      ["Season", facts.seasons.join(", ") || "-"], ["Course/instrument", facts.courses.join(", ") || "-"],
      ["Level", facts.levels.join(", ") || "-"], ["Payment method", formatPaymentMethod(payment.paymentMethod)],
      ["Contact", facts.contact],
    ];
    for (const [label, value] of fields) { const used = drawField(commands, margin, y, label, value, A5.width - margin * 2); y -= Math.max(11, used) + 2; }

    y -= 4;
    addText(commands, margin, y, pageNo === 1 ? "Payment allocation" : "Payment allocation (continued)", { size: 10, font: "bold" });
    y -= 15;
    const tableX = margin, tableW = A5.width - margin * 2;
    const col = [tableX + 4, tableX + 154, tableX + 218, tableX + 276, tableX + 330];
    addRect(commands, tableX, y - 3, tableW, 15);
    ["Activity / Student", "Amount due", "Discount", "Paid now", "Remaining"].forEach((h, i) => addText(commands, col[i], y + 2, h, { size: 6.5, font: "bold" }));
    y -= 10;
    while (index < payment.items.length && y > 144) {
      const item = payment.items[index];
      const e = item.enrollment;
      const course = `${e.course?.name ?? e.courseName}${e.level?.name ? ` / ${e.level.name}` : ""} - ${e.student.studentCode} ${e.student.firstName} ${e.student.lastName}`;
      const lines = wrapText(course, 145, 6.5);
      const rowH = Math.max(14, lines.length * 8 + 5);
      if (y - rowH < 132) break;
      addRect(commands, tableX, y - rowH + 4, tableW, rowH);
      lines.forEach((line, lineNo) => addText(commands, col[0], y - lineNo * 8, line, { size: 6.5 }));
      addText(commands, col[1], y, moneyText(e.feeCents), { size: 6.5 });
      addText(commands, col[2], y, moneyText(e.discountCents), { size: 6.5 });
      addText(commands, col[3], y, moneyText(item.amountCents), { size: 6.5 });
      addText(commands, col[4], y, moneyText(e.remainingCents), { size: 6.5 });
      y -= rowH;
      index++;
    }
    if (index < payment.items.length) addText(commands, margin, 124, `Continued on next A5 page (${payment.items.length - index} allocation(s) remaining).`, { size: 7, font: "bold" });

    addRect(commands, margin, 58, 175, 58);
    addText(commands, margin + 8, 101, "Signature / Stamp", { size: 9, font: "bold" });
    addLine(commands, margin + 18, 78, margin + 150, 78);
    addText(commands, margin + 18, 66, "Authorized signature", { size: 6.5 });
    addRect(commands, 218, 58, 178, 58);
    addText(commands, 226, 101, `Total paid: ${formatCurrency(payment.totalAmountCents)}`, { size: 9, font: "bold" });
    addWrappedText(commands, 226, 88, `Amount in words: ${amountInWords(payment.totalAmountCents)}`, 160, { size: 6.5, leading: 8 });
    addText(commands, 226, 72, `Remaining: ${formatCurrency(facts.remainingBalance)}`, { size: 7, font: "bold" });
    addText(commands, 226, 62, `Received by: ${facts.receivedBy}`, { size: 6.5 });
    addText(commands, margin, 42, "Reprinting reuses the same receipt number and does not create a new payment.", { size: 6 });
    
    pages.push({ width: A5.width, height: A5.height, commands });
    pageNo++;
  } while (index < payment.items.length);
  return pages;
}

function renderPdf(pages: PageSpec[]) {
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.push("");
  objects.push("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");
  objects.push("5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj");
  pages.forEach((page) => {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    const stream = page.commands.join("\n");
    pageObjectIds.push(pageId);
    objects.push(`${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents ${contentId} 0 R >> endobj`);
    objects.push(`${contentId} 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream endobj`);
  });
  objects[1] = `2 0 obj << /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >> endobj`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) { offsets.push(Buffer.byteLength(pdf, "utf8")); pdf += `${object}\n`; }
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((o) => String(o).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export function buildReceiptPdf(payment: ReceiptPayment, layout: ReceiptLayout = "a5") {
  if (layout === "a4-two-copies") {
    const pages: PageSpec[] = [];
    for (const label of ["Customer Copy", "School Copy"]) {
      const a5Pages = drawA5Receipt(payment, label);
      a5Pages.forEach((a5, i) => {
        const topOffset = label === "Customer Copy" ? A4.height - A5.height + 8 : 8;
        const commands = ["0.20 w", "0 0 0 RG", `q 1 0 0 1 88 ${topOffset} cm`, ...a5.commands, "Q"];
        if (label === "Customer Copy" && i === 0) addDashedLine(commands, 24, A4.height / 2, A4.width - 24);
        pages.push({ width: A4.width, height: A4.height, commands });
      });
    }
    if (pages.length === 2) return renderPdf([{ width: A4.width, height: A4.height, commands: [...pages[0].commands, ...pages[1].commands] }]);
    return renderPdf(pages);
  }
  return renderPdf(drawA5Receipt(payment));
}
