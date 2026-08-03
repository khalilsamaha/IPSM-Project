import { formatFormalDate } from "@/lib/records/format";
import { formatPaymentMethod } from "@/lib/payment-methods";
import {
  buildReceiptPdfV2 as buildLegacyReceiptPdf,
  receiptFamilyBalanceRows,
  receiptFamilyBalanceTotals,
  ReceiptGenerationError,
  type ReceiptLayout,
  type ReceiptMode,
  type ReceiptPaymentV2,
} from "@/lib/payments/receipt-service-v2";

export type { ReceiptLayout, ReceiptMode, ReceiptPaymentV2 };
export { ReceiptGenerationError };

type PageSpec = { width: number; height: number; commands: string[] };
type CopyArea = { x: number; y: number; width: number; height: number; label?: string };

const A5 = { width: 420, height: 595 };
const A4 = { width: 595, height: 842 };

function normalize(value: string) {
  return value.replace(/[\r\n]+/g, " ").replace(/[^\x20-\x7e]/g, "-");
}

function escapePdf(value: string) {
  return normalize(value).replace(/[\\()]/g, "\\$&");
}

function addText(
  commands: string[],
  x: number,
  y: number,
  text: string,
  options: { size?: number; bold?: boolean } = {},
) {
  commands.push(
    `BT /${options.bold ? "F2" : "F1"} ${options.size ?? 8} Tf ${x} ${y} Td (${escapePdf(text)}) Tj ET`,
  );
}

function addLine(commands: string[], x1: number, y1: number, x2: number, y2: number) {
  commands.push(`${x1} ${y1} m ${x2} ${y2} l S`);
}

function addRect(commands: string[], x: number, y: number, width: number, height: number) {
  commands.push(`${x} ${y} ${width} ${height} re S`);
}

function truncate(value: string, max: number) {
  const safe = normalize(value);
  return safe.length > max ? `${safe.slice(0, Math.max(0, max - 3))}...` : safe;
}

function money(cents: number) {
  return `USD ${(cents / 100).toFixed(2)}`;
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

function amountInWords(cents: number) {
  const ones = [
    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const belowThousand = (value: number): string => {
    if (value < 20) return ones[value];
    if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? `-${ones[value % 10].toLowerCase()}` : ""}`;
    return `${ones[Math.floor(value / 100)]} hundred${value % 100 ? ` ${belowThousand(value % 100).toLowerCase()}` : ""}`;
  };
  const dollars = Math.floor(Math.abs(cents) / 100);
  const remainder = Math.abs(cents) % 100;
  const groups: string[] = [];
  if (dollars >= 1_000_000) groups.push(`${belowThousand(Math.floor(dollars / 1_000_000))} million`);
  if (Math.floor(dollars / 1_000) % 1_000) groups.push(`${belowThousand(Math.floor(dollars / 1_000) % 1_000)} thousand`);
  if (dollars % 1_000 || !groups.length) groups.push(belowThousand(dollars % 1_000));
  return `${groups.join(" ")} dollars and ${String(remainder).padStart(2, "0")}/100 only`;
}

function headerFacts(payment: ReceiptPaymentV2) {
  const rows = receiptFamilyBalanceRows(payment);
  const father = [payment.family.fatherFirstName, payment.family.fatherLastName].filter(Boolean).join(" ");
  const mother = [payment.family.motherFirstName, payment.family.motherLastName].filter(Boolean).join(" ");
  return {
    payer: father || mother || payment.family.name,
    students: rows.map((row) => `${row.student.studentCode} - ${row.student.firstName} ${row.student.lastName}`),
    courses: unique(payment.items.map((item) => `${item.enrollment.course?.name ?? item.enrollment.courseName}${item.enrollment.level?.name ? ` / ${item.enrollment.level.name}` : ""}`)).join(", "),
    seasons: unique(payment.items.map((item) => item.enrollment.season.name)).join(", "),
    contact: unique([
      payment.family.phone,
      payment.family.email,
      payment.family.fatherPhone,
      payment.family.motherPhone,
      payment.family.fatherEmail,
      payment.family.motherEmail,
    ]).join(" / ") || "Not available",
    receivedBy: payment.createdBy?.name ?? payment.createdBy?.email ?? "IPSM Staff",
  };
}

function drawCopy(
  commands: string[],
  payment: ReceiptPaymentV2,
  area: CopyArea,
  mode: ReceiptMode,
  rowStart: number,
  rowLimit: number,
) {
  const left = area.x;
  const right = area.x + area.width;
  const top = area.y + area.height;
  const rows = receiptFamilyBalanceRows(payment);
  const totals = receiptFamilyBalanceTotals(payment);
  const facts = headerFacts(payment);
  const rightColumnWidth = area.width > 500 ? 206 : 148;
  const rightColumnX = right - rightColumnWidth;
  const leftColumnWidth = rightColumnX - left - 12;
  const leftCharacterLimit = Math.max(24, Math.floor(leftColumnWidth / 4.2));
  const studentLines = facts.students.slice(0, area.width > 500 ? 4 : 3);
  const hiddenStudents = Math.max(0, facts.students.length - studentLines.length);
  const status = mode === "voided" ? "VOIDED COPY" : mode === "reprint" ? "REPRINT" : "POSTED";

  addText(commands, left, top - 18, "IPSM MUSIC SCHOOL", { size: 15, bold: true });
  addText(commands, left, top - 34, `OFFICIAL PAYMENT RECEIPT${area.label ? ` - ${area.label}` : ""}`, { size: 8, bold: true });
  addText(commands, rightColumnX, top - 18, `Receipt: ${payment.receiptNumber ?? "Pending"}`, { size: 8, bold: true });
  addText(commands, rightColumnX, top - 31, `Date: ${formatFormalDate(payment.paymentDate)}`, { size: 7 });
  addText(commands, rightColumnX, top - 44, `Status: ${status}`, { size: 7, bold: true });
  addLine(commands, left, top - 52, right, top - 52);

  let leftY = top - 69;
  addText(commands, left, leftY, `Received from: ${truncate(facts.payer, leftCharacterLimit - 15)}`, { size: 8, bold: true });
  leftY -= 14;
  addText(commands, left, leftY, `Family: ${truncate(payment.family.name, leftCharacterLimit - 18)} | Code: ${payment.family.familyCode ?? "-"}`, { size: 7 });
  leftY -= 14;
  addText(commands, left, leftY, "Students:", { size: 7, bold: true });
  for (const student of studentLines) {
    leftY -= 12;
    addText(commands, left + 8, leftY, `- ${truncate(student, leftCharacterLimit - 2)}`, { size: 7 });
  }
  if (hiddenStudents) {
    leftY -= 12;
    addText(commands, left + 8, leftY, `- ${hiddenStudents} more student${hiddenStudents === 1 ? "" : "s"} listed below`, { size: 7 });
  }
  leftY -= 14;
  addText(commands, left, leftY, `Paid activity: ${truncate(facts.courses || "-", leftCharacterLimit - 15)}`, { size: 7 });
  leftY -= 14;
  addText(commands, left, leftY, `Season: ${truncate(facts.seasons || "-", Math.floor(leftCharacterLimit / 2))} | Method: ${formatPaymentMethod(payment.paymentMethod)}`, { size: 7 });
  leftY -= 14;
  addText(commands, left, leftY, `Contact: ${truncate(facts.contact, leftCharacterLimit - 10)}`, { size: 7 });

  addText(commands, rightColumnX, top - 69, `TOTAL PAID: ${money(payment.totalAmountCents)}`, { size: 10, bold: true });
  addText(commands, rightColumnX, top - 84, `Family remaining: ${money(totals.remainingCents)}`, { size: 7, bold: true });
  addText(commands, rightColumnX, top - 99, `Received by: ${truncate(facts.receivedBy, area.width > 500 ? 30 : 20)}`, { size: 7 });

  const tableTop = Math.min(top - 160, leftY - 20);
  const colStudent = left + 4;
  const colBefore = left + area.width * 0.52;
  const colPaid = left + area.width * 0.68;
  const colRemaining = left + area.width * 0.84;
  addRect(commands, left, tableTop - 2, area.width, 16);
  addText(commands, colStudent, tableTop + 3, "STUDENT / ACTIVITY", { size: 6.5, bold: true });
  addText(commands, colBefore, tableTop + 3, "BEFORE", { size: 6.5, bold: true });
  addText(commands, colPaid, tableTop + 3, "PAID NOW", { size: 6.5, bold: true });
  addText(commands, colRemaining, tableTop + 3, "REMAINING", { size: 6.5, bold: true });

  let rowY = tableTop - 16;
  const pageRows = rows.slice(rowStart, rowStart + rowLimit);
  for (const row of pageRows) {
    const student = `${row.student.studentCode} ${row.student.firstName} ${row.student.lastName}`;
    addRect(commands, left, rowY - 10, area.width, 20);
    addText(commands, colStudent, rowY + 2, truncate(`${student} - ${row.activity}`, area.width > 500 ? 65 : 43), { size: 6.5 });
    addText(commands, colBefore, rowY + 2, money(row.balanceBeforePaymentCents), { size: 6.5 });
    addText(commands, colPaid, rowY + 2, money(row.paidNowCents), { size: 6.5 });
    addText(commands, colRemaining, rowY + 2, money(row.remainingCents), { size: 6.5 });
    rowY -= 20;
  }

  const finalPage = rowStart + rowLimit >= rows.length;
  if (finalPage) {
    addRect(commands, left, rowY - 10, area.width, 20);
    addText(commands, colStudent, rowY + 2, "FAMILY TOTALS", { size: 6.5, bold: true });
    addText(commands, colBefore, rowY + 2, money(totals.balanceBeforePaymentCents), { size: 6.5, bold: true });
    addText(commands, colPaid, rowY + 2, money(totals.paidNowCents), { size: 6.5, bold: true });
    addText(commands, colRemaining, rowY + 2, money(totals.remainingCents), { size: 6.5, bold: true });
  } else {
    addText(commands, left, rowY - 2, `Continued: ${rows.length - rowStart - rowLimit} balance row(s) on the next page.`, { size: 6.5, bold: true });
  }

  const summaryY = area.y + 74;
  addLine(commands, left, summaryY + 28, right, summaryY + 28);
  addText(commands, left, summaryY + 14, `Amount in words: ${truncate(amountInWords(payment.totalAmountCents), area.width > 500 ? 90 : 62)}`, { size: 6.5, bold: true });
  addText(commands, left, summaryY, "Student balances and family totals reflect this posted payment.", { size: 6 });
  commands.push(`q 112 0 0 48 ${left} ${area.y + 14} cm /Stamp Do Q`);
  addText(commands, left + 120, area.y + 34, "Official stamp", { size: 6.5, bold: true });
  addText(commands, left + 120, area.y + 22, "Authorized IPSM payment record", { size: 6 });

  if (mode === "voided") {
    commands.push(`q 0.80 0 0 RG 2 w 0.707 0.707 -0.707 0.707 ${left + area.width / 2 - 45} ${area.y + area.height / 2} cm BT /F2 42 Tf 0 0 Td (VOID) Tj ET Q`);
  }
}

function extractStampObjects(payment: ReceiptPaymentV2, mode: ReceiptMode, stampPng?: Buffer) {
  const legacy = buildLegacyReceiptPdf(payment, "a5", mode, stampPng).toString("utf8");
  const alpha = legacy.match(/5 0 obj[\s\S]*?endobj/)?.[0];
  const stamp = legacy.match(/6 0 obj[\s\S]*?endobj/)?.[0];
  if (!alpha || !stamp) throw new ReceiptGenerationError("PDF_RENDER_FAILED");
  return { alpha, stamp };
}

function renderPdf(pages: PageSpec[], stampObjects: { alpha: string; stamp: string }) {
  const objects: string[] = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "",
    "3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj",
    stampObjects.alpha,
    stampObjects.stamp,
  ];
  const pageObjectIds: number[] = [];
  for (const page of pages) {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    const stream = page.commands.join("\n");
    pageObjectIds.push(pageId);
    objects.push(`${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Stamp 6 0 R >> >> /Contents ${contentId} 0 R >> endobj`);
    objects.push(`${contentId} 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream endobj`);
  }
  objects[1] = `2 0 obj << /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >> endobj`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object}\n`;
  }
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export function buildReceiptPdfV3(
  payment: ReceiptPaymentV2,
  layout: ReceiptLayout = "a5",
  requestedMode?: ReceiptMode,
  stampPng?: Buffer,
) {
  try {
    const mode = requestedMode ?? (payment.voidedAt ? "voided" : "original");
    const rows = receiptFamilyBalanceRows(payment);
    const stampObjects = extractStampObjects(payment, mode, stampPng);

    if (layout === "a4-two-copies") {
      const rowLimit = 3;
      const pageCount = Math.max(1, Math.ceil(rows.length / rowLimit));
      const pages: PageSpec[] = [];
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const commands = ["0.20 w", "0 0 0 RG"];
        drawCopy(commands, payment, { x: 24, y: 430, width: 547, height: 388, label: "Customer Copy" }, mode, pageIndex * rowLimit, rowLimit);
        commands.push("[4 3] 0 d 24 421 m 571 421 l S [] 0 d");
        drawCopy(commands, payment, { x: 24, y: 24, width: 547, height: 372, label: "School Copy" }, mode, pageIndex * rowLimit, rowLimit);
        pages.push({ width: A4.width, height: A4.height, commands });
      }
      return renderPdf(pages, stampObjects);
    }

    const rowLimit = 6;
    const pageCount = Math.max(1, Math.ceil(rows.length / rowLimit));
    const pages: PageSpec[] = [];
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const commands = ["0.20 w", "0 0 0 RG"];
      drawCopy(
        commands,
        payment,
        { x: 24, y: 24, width: A5.width - 48, height: A5.height - 48 },
        mode,
        pageIndex * rowLimit,
        rowLimit,
      );
      pages.push({ width: A5.width, height: A5.height, commands });
    }
    return renderPdf(pages, stampObjects);
  } catch (error) {
    if (error instanceof ReceiptGenerationError) throw error;
    throw new ReceiptGenerationError("PDF_RENDER_FAILED", { cause: error });
  }
}
