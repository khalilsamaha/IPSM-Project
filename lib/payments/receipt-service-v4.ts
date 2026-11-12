import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState,
  rectangle, clip, endPath, concatTransformationMatrix, drawObject,
  type PDFFont, type PDFPage,
} from "pdf-lib";
import { formatFormalDate } from "@/lib/records/format";
import { formatPaymentMethod } from "@/lib/payment-methods";
import { amountInWords } from "./receipt-service-v3";
import {
  readOfficialStamp, receiptFamilyBalanceRows, receiptFamilyBalanceTotals,
  ReceiptGenerationError, type ReceiptLayout, type ReceiptMode, type ReceiptPaymentV2,
} from "./receipt-service-v2";

export { ReceiptGenerationError };
export type { ReceiptLayout, ReceiptMode, ReceiptPaymentV2 };
export const RECEIPT_A5 = { width: 148 * 72 / 25.4, height: 210 * 72 / 25.4 };
export const OFFICIAL_LOGO_PATH = "public/assets/branding/ipsm-logo-original.jpg";
export const OFFICIAL_LOGO_SHA256 = "ce96d609dc682392b5b98dfa1057c351ad40ada7d7534352ec7f4c3708b337f4";
const MARGIN = 24, BOTTOM = 49, LINE = 11;
const INK = rgb(0.12, 0.16, 0.18), ACCENT = rgb(0.12, 0.48, 0.55), LIGHT = rgb(0.93, 0.97, 0.97);
const money = (cents: number) => `USD ${(cents / 100).toFixed(2)}`;
const unique = (values: Array<string | null | undefined>) => [...new Set(values.filter(Boolean))].join(" / ");

function readLogo(provided?: Buffer) {
  let bytes: Buffer;
  try { bytes = provided ?? readFileSync(path.join(process.cwd(), OFFICIAL_LOGO_PATH)); }
  catch (cause) {
    throw new ReceiptGenerationError((cause as NodeJS.ErrnoException).code === "ENOENT" ? "LOGO_FILE_MISSING" : "LOGO_FILE_UNREADABLE", { cause });
  }
  // This is a fixed official asset, not an image upload. Reject corruption or
  // substitution before embedding; retain the original JPEG binary verbatim.
  if (createHash("sha256").update(bytes).digest("hex") !== OFFICIAL_LOGO_SHA256)
    throw new ReceiptGenerationError("LOGO_INVALID_JPEG");
  return bytes;
}

/** Measured wrapping, including unbroken codes/emails. No ellipses or row limits. */
function wrap(value: string, font: PDFFont, size: number, width: number): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (font.widthOfTextAtSize(line ? `${line} ${word}` : word, size) <= width) {
      line = line ? `${line} ${word}` : word;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const char of word) {
      if (font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = ""; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

type TextLine = { text: string; font: PDFFont; size: number };

/** Rendering only: no database, identifiers, audits, or balance calculations. */
export async function buildReceiptPdfV4(
  payment: ReceiptPaymentV2,
  _legacyLayout: ReceiptLayout = "a5",
  requestedMode?: ReceiptMode,
  stampPng?: Buffer,
  logoJpeg?: Buffer,
): Promise<Buffer<ArrayBuffer>> {
  try {
    const stamp = readOfficialStamp(stampPng); // Existing validation/alpha decoder.
    const logoBytes = readLogo(logoJpeg);
    const doc = await PDFDocument.create();
    const regular = doc.embedStandardFont(StandardFonts.Helvetica);
    const bold = doc.embedStandardFont(StandardFonts.HelveticaBold);
    const logo = await doc.embedJpg(logoBytes);
    const alphaRef = doc.context.register(doc.context.stream(stamp.alpha, {
      Type: "XObject", Subtype: "Image", Width: stamp.width, Height: stamp.height,
      ColorSpace: "DeviceGray", BitsPerComponent: 8, Filter: "FlateDecode",
    }));
    const stampRef = doc.context.register(doc.context.stream(stamp.rgb, {
      Type: "XObject", Subtype: "Image", Width: stamp.width, Height: stamp.height,
      ColorSpace: "DeviceRGB", BitsPerComponent: 8, Filter: "FlateDecode", SMask: alphaRef,
    }));
    // A voided payment can never be labelled original even by a direct caller.
    const mode = payment.voidedAt ? "voided" : requestedMode ?? "original";
    const status = mode === "voided" ? "VOIDED COPY" : mode === "reprint" ? "REPRINT" : "ORIGINAL";
    const rows = receiptFamilyBalanceRows(payment), totals = receiptFamilyBalanceTotals(payment);
    const width = RECEIPT_A5.width - MARGIN * 2, right = RECEIPT_A5.width - MARGIN;
    let page!: PDFPage;
    let y = 0;
    const text = (value: string, x: number, baseline: number, font = regular, size = 8.5) =>
      page.drawText(value, { x, y: baseline, font, size, color: INK });
    const rule = (at: number) => page.drawLine({ start: { x: MARGIN, y: at }, end: { x: right, y: at }, thickness: 0.5, color: ACCENT });
    const newPage = () => {
      page = doc.addPage([RECEIPT_A5.width, RECEIPT_A5.height]);
      const top = RECEIPT_A5.height - MARGIN;
      // Reviewed nonblank bounds: x149..920, y264..816. Twelve pixels of
      // padding retain antialiasing. Clip blank margins only, without re-encoding.
      const crop = { x: 137, top: 252, width: 796, height: 577 }, logoWidth = 118;
      const scale = logoWidth / crop.width, logoHeight = crop.height * scale;
      page.pushOperators(pushGraphicsState(), rectangle(MARGIN, top - logoHeight, logoWidth, logoHeight), clip(), endPath());
      page.drawImage(logo, { x: MARGIN - crop.x * scale, y: top - (1070 - crop.top) * scale, width: 1070 * scale, height: 1070 * scale });
      page.pushOperators(popGraphicsState());
      const x = MARGIN + 132;
      let headerY = top - 13;
      for (const line of ["OFFICIAL PAYMENT RECEIPT", `Receipt: ${payment.receiptNumber ?? "Pending"}`, `Date: ${formatFormalDate(payment.paymentDate)}`, `Status: ${status}`]) {
        for (const part of wrap(line, bold, 8.5, right - x)) { text(part, x, headerY, bold); headerY -= 13; }
      }
      y = Math.min(top - logoHeight, headerY) - 12;
      rule(y); y -= 15;
    };
    newPage();
    const lines = (value: string, font = regular, size = 8.5, available = width): TextLine[] =>
      wrap(value, font, size, available).map(part => ({ text: part, font, size }));
    const flow = (value: string, font = regular) => {
      for (const line of lines(value, font)) {
        if (y - LINE < BOTTOM) newPage();
        text(line.text, MARGIN, y, line.font, line.size); y -= LINE;
      }
      y -= 3;
    };
    const family = payment.family;
    const payer = [family.fatherFirstName, family.fatherLastName].filter(Boolean).join(" ") ||
      [family.motherFirstName, family.motherLastName].filter(Boolean).join(" ") || family.name;
    flow(`Received from: ${payer}`, bold);
    flow(`Family: ${family.name} | Code: ${family.familyCode ?? "-"}`);
    flow(`Contact: ${unique([family.phone, family.email, family.fatherPhone, family.motherPhone, family.fatherEmail, family.motherEmail]) || "Not available"}`);
    flow(`Method: ${formatPaymentMethod(payment.paymentMethod)} | Received by: ${payment.createdBy?.name ?? payment.createdBy?.email ?? "IPSM Staff"}`);
    flow(`Paid activity / season: ${unique(payment.items.map(item => `${item.enrollment.course?.name ?? item.enrollment.courseName}${item.enrollment.level?.name ? ` / ${item.enrollment.level.name}` : ""} / ${item.enrollment.season.name}`)) || "-"}`);
    flow(`TOTAL PAID: ${money(payment.totalAmountCents)} | Family remaining: ${money(totals.remainingCents)}`, bold);
    y -= 5;

    const keys = ["balanceBeforePaymentCents", "paidNowCents", "remainingCents"] as const;
    const numericWidths = keys.map(key => Math.max(64, ...[...rows, totals].map(row => bold.widthOfTextAtSize(money(row[key]), 8.5) + 12)));
    const labelWidth = width - numericWidths.reduce((a, b) => a + b, 0);
    if (labelWidth < 80) throw new ReceiptGenerationError("PDF_RENDER_FAILED");
    const boundaries = numericWidths.map((_, i) => MARGIN + labelWidth + numericWidths.slice(0, i + 1).reduce((a, b) => a + b, 0));
    const numbers = (row: typeof totals, at: number, font = regular) => keys.forEach((key, i) => {
      const value = money(row[key]); text(value, boundaries[i] - 5 - font.widthOfTextAtSize(value, 8.5), at, font);
    });
    const heading = () => {
      page.drawRectangle({ x: MARGIN, y: y - 19, width, height: 19, color: LIGHT });
      text("STUDENT / ACTIVITY", MARGIN + 5, y - 13, bold, 7.5);
      ["BEFORE", "PAID NOW", "REMAINING"].forEach((value, i) => text(value, boundaries[i] - 5 - bold.widthOfTextAtSize(value, 7.5), y - 13, bold, 7.5));
      y -= 19;
    };
    const footerLines = [
      ...lines(`Amount in words: ${amountInWords(payment.totalAmountCents)}`, bold),
      ...lines("Student balances and family totals reflect this posted payment."),
      ...(mode === "voided" ? lines("VOID: this copy does not acknowledge a valid payment.", bold) : []),
    ];
    const finalHeight = 28 + footerLines.length * LINE + 78;
    let tableStarted = false;
    rows.forEach((row, index) => {
      const rowLines = [
        ...lines(`${row.student.firstName} ${row.student.lastName}`, bold, 8.5, labelWidth - 10),
        ...lines(row.student.studentCode || "Student code unavailable", regular, 7.5, labelWidth - 10),
        ...lines(row.activity, regular, 8.5, labelWidth - 10),
      ];
      const rowHeight = rowLines.length * LINE + 10;
      const reserve = index === rows.length - 1 ? finalHeight : 0;
      // Keep a normal last row with its totals/footer when it fits a fresh page.
      if (y - (tableStarted ? 0 : 19) - rowHeight - reserve < BOTTOM && tableStarted) {
        newPage(); tableStarted = false;
      }
      if (!tableStarted) {
        if (y - 19 - Math.min(rowHeight, 3 * LINE + 10) < BOTTOM) newPage();
        heading(); tableStarted = true;
      }
      // An exceptionally long single activity can span pages. Print its amounts
      // once only; continuation fragments contain text, never repeated payments.
      let offset = 0;
      while (offset < rowLines.length) {
        const capacity = Math.floor((y - BOTTOM - 10) / LINE);
        if (capacity < 1) { newPage(); heading(); continue; }
        const fragment = rowLines.slice(offset, offset + capacity);
        const fragmentHeight = fragment.length * LINE + 10;
        if (offset === 0) numbers(row, y - 14);
        fragment.forEach((line, i) => text(line.text, MARGIN + 5, y - 14 - i * LINE, line.font, line.size));
        y -= fragmentHeight;
        rule(y);
        offset += fragment.length;
        if (offset < rowLines.length) { newPage(); heading(); text("Activity detail continued (amounts on prior page)", MARGIN + 5, y - 11, regular, 7); y -= 18; }
      }
    });
    if (y - finalHeight - (tableStarted ? 0 : 19) < BOTTOM) { newPage(); tableStarted = false; }
    if (!tableStarted) heading(); // A totals-only final page still labels its columns.
    page.drawRectangle({ x: MARGIN, y: y - 25, width, height: 25, color: LIGHT });
    text("FAMILY TOTALS", MARGIN + 5, y - 16, bold); numbers(totals, y - 16, bold); y -= 39;
    for (const line of footerLines) { text(line.text, MARGIN, y, line.font, line.size); y -= LINE; }
    y -= 9;
    const stampName = page.node.newXObject("Stamp", stampRef);
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(112, 0, 0, 48, MARGIN, y - 48), drawObject(stampName), popGraphicsState());
    text("Official stamp", MARGIN + 124, y - 20, bold);
    text("Authorized IPSM payment record", MARGIN + 124, y - 33, regular, 8);
    for (const [index, current] of doc.getPages().entries()) {
      page = current;
      rule(39);
      text(index === doc.getPageCount() - 1 ? "End of receipt" : "Continued on next A5 page · totals and stamp on final page", MARGIN, 28, regular, 7);
      const counter = `Page ${index + 1} of ${doc.getPageCount()}`;
      text(counter, right - regular.widthOfTextAtSize(counter, 7), 16, regular, 7);
    }
    doc.setTitle(`IPSM receipt ${payment.receiptNumber ?? "Pending"}`);
    doc.setCreator("IPSM Receipt V4");
    return Buffer.from(await doc.save());
  } catch (error) {
    if (error instanceof ReceiptGenerationError) throw error;
    if (error instanceof Error && /WinAnsi cannot encode/.test(error.message))
      throw new ReceiptGenerationError("TEXT_UNSUPPORTED", { cause: error });
    throw new ReceiptGenerationError("PDF_RENDER_FAILED", { cause: error });
  }
}
