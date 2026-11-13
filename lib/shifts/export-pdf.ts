import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** A separate shift-export renderer; does not change the A5-only payment receipt. */
export type ShiftExportSection = { title: string; lines: string[] };
const PAGE_WIDTH = 595.28, PAGE_HEIGHT = 841.89;
const MARGIN = 40, FOOTER = 37, LINE = 12;
const INK = rgb(0.14, 0.19, 0.23);
const BLUE = rgb(0.11, 0.43, 0.52);

// Preserve the previous export's non-Latin fallback without corrupting the PDF.
const printable = (input: string) => input.replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7e]/g, "-");

export function wrapShiftExportText(input: string, font: PDFFont, size: number, maxWidth: number) {
  const words = printable(input).split(/\s+/).filter(Boolean);
  const result: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) { result.push(line); line = ""; }
    for (const character of word) {
      if (line && font.widthOfTextAtSize(line + character, size) > maxWidth) {
        result.push(line); line = "";
      }
      line += character;
    }
    if (line && font.widthOfTextAtSize(line, size) > maxWidth) {
      result.push(line); line = "";
    }
  }
  if (line) result.push(line);
  return result.length ? result : [""];
}

export async function renderShiftClosingPdf(shiftId: string, sections: ShiftExportSection[]) {
  const doc = await PDFDocument.create();
  const font = doc.embedStandardFont(StandardFonts.Helvetica);
  const bold = doc.embedStandardFont(StandardFonts.HelveticaBold);
  let page!: PDFPage, y = 0;
  const text = (content: string, x: number, size: number, weight = font) =>
    page.drawText(content, { x, y, size, font: weight, color: INK });
  const startPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    page.drawText("IPSM  /  SHIFT CLOSING REPORT", { x: MARGIN, y, size: 13, font: bold, color: BLUE });
    y -= 17;
    for (const item of wrapShiftExportText(`Shift ${shiftId}`, font, 8, PAGE_WIDTH - MARGIN * 2)) {
      text(item, MARGIN, 8); y -= LINE;
    }
    y -= 10;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.8, color: BLUE });
    y -= 18;
  };
  startPage();
  for (const section of sections) {
    const headingLines = wrapShiftExportText(section.title, bold, 10, PAGE_WIDTH - MARGIN * 2);
    if (y - headingLines.length * 15 - LINE < FOOTER + 15) startPage();
    y -= 5;
    for (const item of headingLines) {
      text(item, MARGIN, 10, bold); y -= 15;
    }
    for (const content of section.lines.length ? section.lines : ["None"]) {
      const wrapped = wrapShiftExportText(content, font, 8, PAGE_WIDTH - 2 * MARGIN - 10);
      for (const item of wrapped) {
        if (y - LINE < FOOTER) startPage();
        text(item, MARGIN + 8, 8);
        y -= LINE;
      }
      y -= 3;
      if (y - LINE < FOOTER) startPage();
    }
    y -= 8;
  }
  const pages = doc.getPages();
  pages.forEach((current, i) => {
    const caption = `Page ${i + 1} of ${pages.length}`;
    current.drawLine({ start: { x: MARGIN, y: FOOTER - 11 }, end: { x: PAGE_WIDTH - MARGIN, y: FOOTER - 11 }, thickness: 0.4, color: BLUE });
    current.drawText(caption, { x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(caption, 8), y: FOOTER - 24, font, size: 8, color: INK });
  });
  doc.setTitle(`IPSM shift closing report ${shiftId}`);
  return Buffer.from(await doc.save());
}
