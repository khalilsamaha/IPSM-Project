import { parseReceiptNumber } from "@/lib/payments/receipt-number";
import type { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { formatCurrency, formatFormalDate } from "@/lib/records/format";
import { formatPaymentMethod } from "@/lib/payment-methods";
import { generateUniqueReceiptNumber } from "@/lib/payments/receipt-repair";

export type ReceiptGenerationFailureCode = "STAMP_FILE_MISSING" | "STAMP_FILE_UNREADABLE" | "STAMP_INVALID_PNG" | "STAMP_UNSUPPORTED_ENCODING" | "STAMP_DECODE_FAILED" | "PDF_RENDER_FAILED";
export class ReceiptGenerationError extends Error {
  constructor(public readonly code: ReceiptGenerationFailureCode, options?: { cause?: unknown }) {
    super(code, options); this.name = "ReceiptGenerationError";
  }
}

type PaymentStore = Pick<PrismaClient, "$queryRaw">;
type ReceiptPayment = {
  voidedAt?: Date | null;
  receiptNumber: string | null;
  paymentDate: Date;
  paymentMethod: string;
  totalAmountCents: number;
  family: { familyCode?: string | null; name: string; email: string | null; phone: string | null; fatherPhone?: string | null; motherPhone?: string | null; fatherEmail?: string | null; motherEmail?: string | null; fatherFirstName?: string | null; fatherLastName?: string | null; motherFirstName?: string | null; motherLastName?: string | null; students?: {studentCode:string; firstName:string; lastName:string}[] };
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

export async function generateReceiptNumber(store: PaymentStore, paymentId: string, date = new Date()) {
  return generateUniqueReceiptNumber(store, paymentId, date);
}

export function receiptPdfPath(paymentId: string) {
  return `/api/receipts/${paymentId}`;
}

export type ReceiptLayout = "a5" | "a4-two-copies";
export type ReceiptMode = "original" | "reprint" | "voided";
export const OFFICIAL_STAMP_PATH = "public/assets/receipts/ipsm-official-stamp.png";

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
  const receiptYear = String(parseReceiptNumber(payment.receiptNumber)?.year ?? payment.paymentDate.getUTCFullYear());
  const students = unique((payment.family.students ?? []).map((student) => `${student.studentCode} - ${student.firstName} ${student.lastName}`));
  const studentIds = unique((payment.family.students ?? []).map((student) => student.studentCode));
  const seasons = unique(payment.items.map((item) => item.enrollment.season.name));
  const courses = unique(payment.items.map((item) => `${item.enrollment.course?.name ?? item.enrollment.courseName}${item.enrollment.level?.name ? ` / ${item.enrollment.level.name}` : ""}`));
  const levels = unique(payment.items.map((item) => item.enrollment.level?.name));
  const remainingBalance = payment.items.reduce((sum, item) => sum + item.enrollment.remainingCents, 0);
  const father = [payment.family.fatherFirstName, payment.family.fatherLastName].filter(Boolean).join(" ").trim();
  const mother = [payment.family.motherFirstName, payment.family.motherLastName].filter(Boolean).join(" ").trim();
  const payerName = father || mother || payment.family.name;
  const contact = unique([payment.family.phone, payment.family.email, payment.family.fatherPhone, payment.family.motherPhone, payment.family.fatherEmail, payment.family.motherEmail]).join(" / ") || "Not available";
  const receivedBy = payment.createdBy?.name ?? payment.createdBy?.email ?? "IPSM Staff";
  return { receiptYear, students, studentIds, seasons, courses, levels, remainingBalance, payerName, contact, receivedBy };
}

function drawA5Receipt(payment: ReceiptPayment, copyLabel = "", allocationStart = 0, mode: ReceiptMode = "original"): PageSpec[] {
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
    addText(commands, 260, 582, "Receipt No:", { size: 7 });
    addText(commands, 260, 570, payment.receiptNumber ?? "Pending", { size: 6.8, font: "bold" });
    addText(commands, 260, 558, `Payment date: ${formatFormalDate(payment.paymentDate)}`, { size: 8 });
    addText(commands, 260, 546, `Year: ${facts.receiptYear}`, { size: 8 });
    addLine(commands, margin, 538, A5.width - margin, 538);
    addText(commands, 260, 534, `Status: ${mode === "voided" ? "Voided Copy" : mode === "reprint" ? "Reprint" : "Posted"}`, { size: 7, font: "bold" });

    let y = 522;
    const fields: [string, string][] = [
      ["Received from", facts.payerName], ["Family code", payment.family.familyCode ?? "-"],
      ["Family members", facts.students.join(", ") || "-"], ["Family name", payment.family.name],
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
    addText(commands, margin + 8, 104, "Official stamp and authorized signature", { size: 7, font: "bold" });
    commands.push("q 120 0 0 50 50 59 cm /Stamp Do Q");
    addRect(commands, 218, 58, 178, 58);
    addText(commands, 226, 101, `Total paid: ${formatCurrency(payment.totalAmountCents)}`, { size: 9, font: "bold" });
    addWrappedText(commands, 226, 88, `Amount in words: ${amountInWords(payment.totalAmountCents)}`, 160, { size: 6.5, leading: 8 });
    addText(commands, 226, 72, `Remaining: ${formatCurrency(facts.remainingBalance)}`, { size: 7, font: "bold" });
    addText(commands, 226, 62, `Received by: ${facts.receivedBy}`, { size: 6.5 });
    addText(commands, margin, 42, "Reprinting reuses the same receipt number and does not create a new payment.", { size: 6 });
    if (mode === "voided") {
      commands.push("q 0.85 0 0 RG 2 w 0.707 0.707 -0.707 0.707 175 200 cm BT /F2 52 Tf 0 0 Td (VOID) Tj ET Q");
      addText(commands, margin, 50, "This payment was voided and its allocations were reversed.", { size: 7, font: "bold" });
    }
    
    pages.push({ width: A5.width, height: A5.height, commands });
    pageNo++;
  } while (index < payment.items.length);
  return pages;
}

function readOfficialStamp(providedPng?: Buffer) {
  const assetPath = path.join(process.cwd(), OFFICIAL_STAMP_PATH);
  let png: Buffer;
  try { png = providedPng ?? readFileSync(assetPath); } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code === "ENOENT" ? "STAMP_FILE_MISSING" : "STAMP_FILE_UNREADABLE";
    throw new ReceiptGenerationError(code, { cause: error });
  }
  if (png.length < 33 || png.readUInt32BE(0) !== 0x89504e47) throw new ReceiptGenerationError("STAMP_INVALID_PNG");
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20), colorType = png[25], depth = png[24];
  if (!width || !height) throw new ReceiptGenerationError("STAMP_INVALID_PNG");
  if (![0, 2, 3, 4, 6].includes(colorType) || depth !== 8 || png[28] !== 0) throw new ReceiptGenerationError("STAMP_UNSUPPORTED_ENCODING");
  const chunks: Buffer[] = []; let palette: Buffer | undefined, transparency: Buffer | undefined, offset = 8;
  try { while (offset + 12 <= png.length) { const length = png.readUInt32BE(offset); if (offset + length + 12 > png.length) throw new Error("truncated chunk"); const type = png.toString("ascii", offset + 4, offset + 8), data = png.subarray(offset + 8, offset + 8 + length); if (type === "IDAT") chunks.push(data); else if (type === "PLTE") palette = data; else if (type === "tRNS") transparency = data; offset += length + 12; } } catch (error) { throw new ReceiptGenerationError("STAMP_INVALID_PNG", { cause: error }); }
  if (!chunks.length || (colorType === 3 && !palette)) throw new ReceiptGenerationError("STAMP_INVALID_PNG");
  const channels = colorType === 0 || colorType === 3 ? 1 : colorType === 2 ? 3 : colorType === 4 ? 2 : 4;
  let packed: Buffer;
  try { packed = inflateSync(Buffer.concat(chunks)); } catch (error) { throw new ReceiptGenerationError("STAMP_DECODE_FAILED", { cause: error }); }
  const stride = width * channels, decoded = Buffer.alloc(stride * height); let source = 0;
  try { for (let y = 0; y < height; y++) { const filter = packed[source++]; if (filter > 4) throw new Error("invalid filter"); for (let x = 0; x < stride; x++) { const raw = packed[source++], left = x >= channels ? decoded[y * stride + x - channels] : 0, up = y ? decoded[(y - 1) * stride + x] : 0, upperLeft = y && x >= channels ? decoded[(y - 1) * stride + x - channels] : 0; let value = raw;
    if (filter === 1) value += left; else if (filter === 2) value += up; else if (filter === 3) value += Math.floor((left + up) / 2); else if (filter === 4) { const p = left + up - upperLeft, pa = Math.abs(p-left), pb = Math.abs(p-up), pc = Math.abs(p-upperLeft); value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft; } decoded[y * stride + x] = value & 255; }
  } } catch (error) { throw new ReceiptGenerationError("STAMP_DECODE_FAILED", { cause: error }); }
  const rgba = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p++) { const at = p * channels, out = p * 4;
    if (colorType === 0) rgba.set([decoded[at], decoded[at], decoded[at], transparency && transparency.length >= 2 && decoded[at] === transparency.readUInt16BE(0) ? 0 : 255], out);
    else if (colorType === 2) rgba.set([decoded[at], decoded[at+1], decoded[at+2], 255], out);
    else if (colorType === 3) { const index=decoded[at], pi=index*3; if (!palette || pi+2>=palette.length) throw new ReceiptGenerationError("STAMP_DECODE_FAILED"); rgba.set([palette[pi],palette[pi+1],palette[pi+2],transparency?.[index] ?? 255],out); }
    else if (colorType === 4) rgba.set([decoded[at],decoded[at],decoded[at],decoded[at+1]],out);
    else rgba.set(decoded.subarray(at, at+4),out);
  }
  const rgb = Buffer.alloc(width * height * 3), alpha = Buffer.alloc(width * height); for (let p = 0; p < width * height; p++) { rgb[p*3]=rgba[p*4]; rgb[p*3+1]=rgba[p*4+1]; rgb[p*3+2]=rgba[p*4+2]; alpha[p]=rgba[p*4+3]; }
  let transparentPixels = 0, darkPixels = 0, bluePixels = 0, opaqueLightPixels = 0;
  for (let p = 0; p < width * height; p++) { const r = rgba[p*4], g = rgba[p*4+1], b = rgba[p*4+2], a = rgba[p*4+3]; if (a === 0) transparentPixels++; if (a > 80 && r < 100 && g < 100 && b < 100) darkPixels++; if (a > 80 && b > r * 1.25 && b > g * 1.25) bluePixels++; if (a > 240 && r > 220 && g > 220 && b > 210) opaqueLightPixels++; }
  return { width, height, rgb: deflateSync(rgb, { level: 9 }), alpha: deflateSync(alpha, { level: 9 }), transparentPixels, darkPixels, bluePixels, opaqueLightPixels };
}

export function inspectOfficialStampAsset(providedPng?: Buffer) {
  const { width, height, transparentPixels, darkPixels, bluePixels, opaqueLightPixels } = readOfficialStamp(providedPng);
  return { width, height, transparentPixels, darkPixels, bluePixels, opaqueLightPixels };
}

function renderPdf(pages: PageSpec[], stampPng?: Buffer) {
  const stamp = readOfficialStamp(stampPng);
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.push("");
  objects.push("3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");
  objects.push("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj");
  const alphaHex = `${stamp.alpha.toString("hex")}>`, rgbHex = `${stamp.rgb.toString("hex")}>`;
  objects.push(`5 0 obj << /Type /XObject /Subtype /Image /Width ${stamp.width} /Height ${stamp.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter [/ASCIIHexDecode /FlateDecode] /Length ${alphaHex.length} >> stream\n${alphaHex}\nendstream endobj`);
  objects.push(`6 0 obj << /Type /XObject /Subtype /Image /Width ${stamp.width} /Height ${stamp.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /FlateDecode] /SMask 5 0 R /Length ${rgbHex.length} >> stream\n${rgbHex}\nendstream endobj`);
  pages.forEach((page) => {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    const stream = page.commands.join("\n");
    pageObjectIds.push(pageId);
    objects.push(`${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Stamp 6 0 R >> >> /Contents ${contentId} 0 R >> endobj`);
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

export function buildReceiptPdf(payment: ReceiptPayment, layout: ReceiptLayout = "a5", requestedMode?: ReceiptMode, stampPng?: Buffer) {
  try {
  const mode = requestedMode ?? (payment.voidedAt ? "voided" : "original");
  if (layout === "a4-two-copies") {
    const pages: PageSpec[] = [];
    for (const label of ["Customer Copy", "School Copy"]) {
      const a5Pages = drawA5Receipt(payment, label, 0, mode);
      a5Pages.forEach((a5, i) => {
        const topOffset = label === "Customer Copy" ? A4.height - A5.height + 8 : 8;
        const commands = ["0.20 w", "0 0 0 RG", `q 1 0 0 1 88 ${topOffset} cm`, ...a5.commands, "Q"];
        if (label === "Customer Copy" && i === 0) addDashedLine(commands, 24, A4.height / 2, A4.width - 24);
        pages.push({ width: A4.width, height: A4.height, commands });
      });
    }
    if (pages.length === 2) return renderPdf([{ width: A4.width, height: A4.height, commands: [...pages[0].commands, ...pages[1].commands] }], stampPng);
    return renderPdf(pages, stampPng);
  }
  return renderPdf(drawA5Receipt(payment, "", 0, mode), stampPng);
  } catch (error) {
    if (error instanceof ReceiptGenerationError) throw error;
    throw new ReceiptGenerationError("PDF_RENDER_FAILED", { cause: error });
  }
}
