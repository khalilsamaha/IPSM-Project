import { readFileSync } from "node:fs";
import path from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { formatCurrency, formatFormalDate } from "@/lib/records/format";
import { formatPaymentMethod } from "@/lib/payment-methods";

export type ReceiptLayout = "a5" | "a4-two-copies";
export type ReceiptMode = "original" | "reprint" | "voided";
export type ReceiptGenerationFailureCode =
  | "STAMP_FILE_MISSING"
  | "STAMP_FILE_UNREADABLE"
  | "STAMP_INVALID_PNG"
  | "STAMP_UNSUPPORTED_ENCODING"
  | "STAMP_DECODE_FAILED"
  | "PDF_RENDER_FAILED";

export class ReceiptGenerationError extends Error {
  constructor(
    public readonly code: ReceiptGenerationFailureCode,
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.name = "ReceiptGenerationError";
  }
}

export const OFFICIAL_STAMP_PATH =
  "public/assets/receipts/ipsm-official-stamp.png";

export type ReceiptFamilyBalanceRow = {
  student: {
    studentCode: string;
    firstName: string;
    lastName: string;
  };
  activity: string;
  balanceBeforePaymentCents: number;
  paidNowCents: number;
  remainingCents: number;
};

export type ReceiptPaymentV2 = {
  voidedAt?: Date | null;
  receiptNumber: string | null;
  paymentDate: Date;
  paymentMethod: string;
  totalAmountCents: number;
  family: {
    familyCode?: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    fatherPhone?: string | null;
    motherPhone?: string | null;
    fatherEmail?: string | null;
    motherEmail?: string | null;
    fatherFirstName?: string | null;
    fatherLastName?: string | null;
    motherFirstName?: string | null;
    motherLastName?: string | null;
    students?: Array<{
      studentCode: string;
      firstName: string;
      lastName: string;
    }>;
  };
  createdBy?: { name?: string | null; email: string } | null;
  familyBalances?: ReceiptFamilyBalanceRow[];
  items: Array<{
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
      student: {
        studentCode: string;
        firstName: string;
        lastName: string;
      };
    };
  }>;
};

type PageSpec = { width: number; height: number; commands: string[] };
type CopyArea = {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
};

const A5 = { width: 420, height: 595 };
const A4 = { width: 595, height: 842 };

function esc(value: string) {
  return value.replace(/[\\()]/g, "\\$&");
}

function normalize(value: string) {
  return value.replace(/[\r\n]+/g, " ").replace(/[^\x20-\x7E]/g, "-");
}

function addText(
  commands: string[],
  x: number,
  y: number,
  text: string,
  options: { size?: number; bold?: boolean } = {},
) {
  commands.push(
    `BT /${options.bold ? "F2" : "F1"} ${options.size ?? 8} Tf ${x} ${y} Td (${esc(normalize(text))}) Tj ET`,
  );
}

function addLine(
  commands: string[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  commands.push(`${x1} ${y1} m ${x2} ${y2} l S`);
}

function addRect(
  commands: string[],
  x: number,
  y: number,
  width: number,
  height: number,
) {
  commands.push(`${x} ${y} ${width} ${height} re S`);
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

function money(cents: number) {
  return formatCurrency(cents).replace("$", "USD ");
}

function amountInWords(cents: number) {
  const ones = [
    "Zero",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const underThousand = (value: number): string => {
    if (value < 20) return ones[value];
    if (value < 100) {
      return `${tens[Math.floor(value / 10)]}${
        value % 10 ? `-${ones[value % 10].toLowerCase()}` : ""
      }`;
    }
    return `${ones[Math.floor(value / 100)]} hundred${
      value % 100 ? ` ${underThousand(value % 100).toLowerCase()}` : ""
    }`;
  };
  const dollars = Math.floor(Math.abs(cents) / 100);
  const remainder = Math.abs(cents) % 100;
  const sections: string[] = [];
  if (dollars >= 1_000_000) {
    sections.push(
      `${underThousand(Math.floor(dollars / 1_000_000))} million`,
    );
  }
  if (Math.floor(dollars / 1000) % 1000) {
    sections.push(
      `${underThousand(Math.floor(dollars / 1000) % 1000)} thousand`,
    );
  }
  if (dollars % 1000 || !sections.length) {
    sections.push(underThousand(dollars % 1000));
  }
  return `${sections.join(" ")} dollars and ${String(remainder).padStart(2, "0")}/100 only`;
}

function truncate(value: string, max: number) {
  const normalized = normalize(value);
  return normalized.length > max
    ? `${normalized.slice(0, Math.max(0, max - 3))}...`
    : normalized;
}

export function receiptFamilyBalanceRows(
  payment: ReceiptPaymentV2,
): ReceiptFamilyBalanceRow[] {
  if (payment.familyBalances?.length) return payment.familyBalances;

  return payment.items.map((item) => ({
    student: item.enrollment.student,
    activity: `${item.enrollment.course?.name ?? item.enrollment.courseName}${
      item.enrollment.level?.name ? ` / ${item.enrollment.level.name}` : ""
    }`,
    balanceBeforePaymentCents:
      item.enrollment.remainingCents + item.amountCents,
    paidNowCents: item.amountCents,
    remainingCents: item.enrollment.remainingCents,
  }));
}

export function receiptFamilyBalanceTotals(payment: ReceiptPaymentV2) {
  return receiptFamilyBalanceRows(payment).reduce(
    (totals, row) => ({
      balanceBeforePaymentCents:
        totals.balanceBeforePaymentCents + row.balanceBeforePaymentCents,
      paidNowCents: totals.paidNowCents + row.paidNowCents,
      remainingCents: totals.remainingCents + row.remainingCents,
    }),
    {
      balanceBeforePaymentCents: 0,
      paidNowCents: 0,
      remainingCents: 0,
    },
  );
}

function facts(payment: ReceiptPaymentV2) {
  const father = [
    payment.family.fatherFirstName,
    payment.family.fatherLastName,
  ]
    .filter(Boolean)
    .join(" ");
  const mother = [
    payment.family.motherFirstName,
    payment.family.motherLastName,
  ]
    .filter(Boolean)
    .join(" ");
  const balanceRows = receiptFamilyBalanceRows(payment);
  const totals = receiptFamilyBalanceTotals(payment);
  return {
    payer: father || mother || payment.family.name,
    contact:
      unique([
        payment.family.phone,
        payment.family.email,
        payment.family.fatherPhone,
        payment.family.motherPhone,
        payment.family.fatherEmail,
        payment.family.motherEmail,
      ]).join(" / ") || "Not available",
    students: unique(
      balanceRows.map(
        (row) =>
          `${row.student.studentCode} - ${row.student.firstName} ${row.student.lastName}`,
      ),
    ).join(", "),
    courses: unique(
      payment.items.map(
        (item) =>
          `${item.enrollment.course?.name ?? item.enrollment.courseName}${
            item.enrollment.level?.name
              ? ` / ${item.enrollment.level.name}`
              : ""
          }`,
      ),
    ).join(", "),
    seasons: unique(
      payment.items.map((item) => item.enrollment.season.name),
    ).join(", "),
    remaining: totals.remainingCents,
    receivedBy:
      payment.createdBy?.name ?? payment.createdBy?.email ?? "IPSM Staff",
  };
}

function drawReceiptCopy(
  commands: string[],
  payment: ReceiptPaymentV2,
  area: CopyArea,
  mode: ReceiptMode,
  itemStart: number,
  itemLimit: number,
) {
  const info = facts(payment);
  const balanceRows = receiptFamilyBalanceRows(payment);
  const totals = receiptFamilyBalanceTotals(payment);
  const left = area.x;
  const right = area.x + area.width;
  const top = area.y + area.height;
  const status =
    mode === "voided"
      ? "VOIDED COPY"
      : mode === "reprint"
        ? "REPRINT"
        : "POSTED";

  addText(commands, left, top - 18, "IPSM MUSIC SCHOOL", {
    size: 15,
    bold: true,
  });
  addText(
    commands,
    left,
    top - 34,
    `OFFICIAL PAYMENT RECEIPT${area.label ? ` - ${area.label}` : ""}`,
    { size: 8, bold: true },
  );
  addText(
    commands,
    right - 174,
    top - 18,
    `Receipt: ${payment.receiptNumber ?? "Pending"}`,
    { size: 8, bold: true },
  );
  addText(
    commands,
    right - 174,
    top - 31,
    `Date: ${formatFormalDate(payment.paymentDate)}`,
    { size: 7 },
  );
  addText(commands, right - 174, top - 44, `Status: ${status}`, {
    size: 7,
    bold: true,
  });
  addLine(commands, left, top - 52, right, top - 52);

  addText(
    commands,
    left,
    top - 69,
    `Received from: ${truncate(info.payer, 45)}`,
    { size: 8, bold: true },
  );
  addText(
    commands,
    left,
    top - 83,
    `Family: ${truncate(payment.family.name, 42)}  |  Code: ${payment.family.familyCode ?? "-"}`,
    { size: 7 },
  );
  addText(
    commands,
    left,
    top - 97,
    `Students: ${truncate(info.students || "-", 64)}`,
    { size: 7 },
  );
  addText(
    commands,
    left,
    top - 111,
    `Paid activity: ${truncate(info.courses || "-", 58)}`,
    { size: 7 },
  );
  addText(
    commands,
    left,
    top - 125,
    `Season: ${truncate(info.seasons || "-", 35)}  |  Method: ${formatPaymentMethod(payment.paymentMethod)}`,
    { size: 7 },
  );
  addText(
    commands,
    left,
    top - 139,
    `Contact: ${truncate(info.contact, 65)}`,
    { size: 7 },
  );
  addText(
    commands,
    right - 174,
    top - 69,
    `TOTAL PAID: ${money(payment.totalAmountCents)}`,
    { size: 10, bold: true },
  );
  addText(
    commands,
    right - 174,
    top - 84,
    `Family remaining: ${money(info.remaining)}`,
    { size: 7, bold: true },
  );
  addText(
    commands,
    right - 174,
    top - 98,
    `Received by: ${truncate(info.receivedBy, 24)}`,
    { size: 7 },
  );

  const tableTop = top - 160;
  const colStudent = left + 4;
  const colDue = left + area.width * 0.52;
  const colPaid = left + area.width * 0.68;
  const colRemaining = left + area.width * 0.84;
  addRect(commands, left, tableTop - 2, area.width, 16);
  addText(commands, colStudent, tableTop + 3, "STUDENT / ACTIVITY", {
    size: 6.5,
    bold: true,
  });
  addText(commands, colDue, tableTop + 3, "BEFORE", {
    size: 6.5,
    bold: true,
  });
  addText(commands, colPaid, tableTop + 3, "PAID NOW", {
    size: 6.5,
    bold: true,
  });
  addText(commands, colRemaining, tableTop + 3, "REMAINING", {
    size: 6.5,
    bold: true,
  });

  let y = tableTop - 16;
  const rows = balanceRows.slice(itemStart, itemStart + itemLimit);
  for (const row of rows) {
    const student = `${row.student.studentCode} ${row.student.firstName} ${row.student.lastName}`;
    addRect(commands, left, y - 10, area.width, 20);
    addText(
      commands,
      colStudent,
      y + 2,
      truncate(
        `${student} - ${row.activity}`,
        area.width > 500 ? 65 : 43,
      ),
      { size: 6.5 },
    );
    addText(commands, colDue, y + 2, money(row.balanceBeforePaymentCents), {
      size: 6.5,
    });
    addText(commands, colPaid, y + 2, money(row.paidNowCents), {
      size: 6.5,
    });
    addText(commands, colRemaining, y + 2, money(row.remainingCents), {
      size: 6.5,
    });
    y -= 20;
  }

  const isFinalPage = itemStart + itemLimit >= balanceRows.length;
  if (isFinalPage) {
    addRect(commands, left, y - 10, area.width, 20);
    addText(commands, colStudent, y + 2, "FAMILY TOTALS", {
      size: 6.5,
      bold: true,
    });
    addText(
      commands,
      colDue,
      y + 2,
      money(totals.balanceBeforePaymentCents),
      { size: 6.5, bold: true },
    );
    addText(commands, colPaid, y + 2, money(totals.paidNowCents), {
      size: 6.5,
      bold: true,
    });
    addText(commands, colRemaining, y + 2, money(totals.remainingCents), {
      size: 6.5,
      bold: true,
    });
  } else {
    addText(
      commands,
      left,
      y - 2,
      `Continued: ${balanceRows.length - itemStart - itemLimit} family balance row(s) on the next page.`,
      { size: 6.5, bold: true },
    );
  }

  const summaryY = area.y + 74;
  addLine(commands, left, summaryY + 28, right, summaryY + 28);
  addText(
    commands,
    left,
    summaryY + 14,
    `Amount in words: ${truncate(
      amountInWords(payment.totalAmountCents),
      area.width > 500 ? 90 : 62,
    )}`,
    { size: 6.5, bold: true },
  );
  addText(
    commands,
    left,
    summaryY,
    "Student balances and family totals reflect this posted payment.",
    { size: 6 },
  );

  // The official stamp is intentionally placed directly on the page without a surrounding box.
  commands.push(`q 112 0 0 48 ${left} ${area.y + 14} cm /Stamp Do Q`);
  addText(commands, left + 120, area.y + 34, "Official stamp", {
    size: 6.5,
    bold: true,
  });
  addText(
    commands,
    left + 120,
    area.y + 22,
    "Authorized IPSM payment record",
    { size: 6 },
  );

  if (mode === "voided") {
    commands.push(
      `q 0.80 0 0 RG 2 w 0.707 0.707 -0.707 0.707 ${left + area.width / 2 - 45} ${area.y + area.height / 2} cm BT /F2 42 Tf 0 0 Td (VOID) Tj ET Q`,
    );
  }
}

function readOfficialStamp(providedPng?: Buffer) {
  const assetPath = path.join(process.cwd(), OFFICIAL_STAMP_PATH);
  let png: Buffer;
  try {
    png = providedPng ?? readFileSync(assetPath);
  } catch (error) {
    const code =
      (error as NodeJS.ErrnoException)?.code === "ENOENT"
        ? "STAMP_FILE_MISSING"
        : "STAMP_FILE_UNREADABLE";
    throw new ReceiptGenerationError(code, { cause: error });
  }
  if (png.length < 33 || png.readUInt32BE(0) !== 0x89504e47) {
    throw new ReceiptGenerationError("STAMP_INVALID_PNG");
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const colorType = png[25];
  const depth = png[24];
  if (!width || !height) {
    throw new ReceiptGenerationError("STAMP_INVALID_PNG");
  }
  if (![0, 2, 3, 4, 6].includes(colorType) || depth !== 8 || png[28] !== 0) {
    throw new ReceiptGenerationError("STAMP_UNSUPPORTED_ENCODING");
  }
  const chunks: Buffer[] = [];
  let palette: Buffer | undefined;
  let transparency: Buffer | undefined;
  let offset = 8;
  try {
    while (offset + 12 <= png.length) {
      const length = png.readUInt32BE(offset);
      if (offset + length + 12 > png.length) {
        throw new Error("truncated chunk");
      }
      const type = png.toString("ascii", offset + 4, offset + 8);
      const data = png.subarray(offset + 8, offset + 8 + length);
      if (type === "IDAT") chunks.push(data);
      else if (type === "PLTE") palette = data;
      else if (type === "tRNS") transparency = data;
      offset += length + 12;
    }
  } catch (error) {
    throw new ReceiptGenerationError("STAMP_INVALID_PNG", { cause: error });
  }
  if (!chunks.length || (colorType === 3 && !palette)) {
    throw new ReceiptGenerationError("STAMP_INVALID_PNG");
  }
  const channels =
    colorType === 0 || colorType === 3
      ? 1
      : colorType === 2
        ? 3
        : colorType === 4
          ? 2
          : 4;
  let packed: Buffer;
  try {
    packed = inflateSync(Buffer.concat(chunks));
  } catch (error) {
    throw new ReceiptGenerationError("STAMP_DECODE_FAILED", { cause: error });
  }
  const stride = width * channels;
  const decoded = Buffer.alloc(stride * height);
  let source = 0;
  try {
    for (let row = 0; row < height; row += 1) {
      const filter = packed[source++];
      if (filter > 4) throw new Error("invalid filter");
      for (let column = 0; column < stride; column += 1) {
        const raw = packed[source++];
        const left =
          column >= channels
            ? decoded[row * stride + column - channels]
            : 0;
        const up = row ? decoded[(row - 1) * stride + column] : 0;
        const upperLeft =
          row && column >= channels
            ? decoded[(row - 1) * stride + column - channels]
            : 0;
        let value = raw;
        if (filter === 1) value += left;
        else if (filter === 2) value += up;
        else if (filter === 3) value += Math.floor((left + up) / 2);
        else if (filter === 4) {
          const estimate = left + up - upperLeft;
          const leftDistance = Math.abs(estimate - left);
          const upDistance = Math.abs(estimate - up);
          const diagonalDistance = Math.abs(estimate - upperLeft);
          value +=
            leftDistance <= upDistance && leftDistance <= diagonalDistance
              ? left
              : upDistance <= diagonalDistance
                ? up
                : upperLeft;
        }
        decoded[row * stride + column] = value & 255;
      }
    }
  } catch (error) {
    throw new ReceiptGenerationError("STAMP_DECODE_FAILED", { cause: error });
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const at = pixel * channels;
    const out = pixel * 4;
    if (colorType === 0) {
      rgba.set(
        [
          decoded[at],
          decoded[at],
          decoded[at],
          transparency &&
          transparency.length >= 2 &&
          decoded[at] === transparency.readUInt16BE(0)
            ? 0
            : 255,
        ],
        out,
      );
    } else if (colorType === 2) {
      rgba.set([decoded[at], decoded[at + 1], decoded[at + 2], 255], out);
    } else if (colorType === 3) {
      const paletteIndex = decoded[at];
      const paletteOffset = paletteIndex * 3;
      if (!palette || paletteOffset + 2 >= palette.length) {
        throw new ReceiptGenerationError("STAMP_DECODE_FAILED");
      }
      rgba.set(
        [
          palette[paletteOffset],
          palette[paletteOffset + 1],
          palette[paletteOffset + 2],
          transparency?.[paletteIndex] ?? 255,
        ],
        out,
      );
    } else if (colorType === 4) {
      rgba.set(
        [decoded[at], decoded[at], decoded[at], decoded[at + 1]],
        out,
      );
    } else {
      rgba.set(decoded.subarray(at, at + 4), out);
    }
  }
  const rgb = Buffer.alloc(width * height * 3);
  const alpha = Buffer.alloc(width * height);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    rgb[pixel * 3] = rgba[pixel * 4];
    rgb[pixel * 3 + 1] = rgba[pixel * 4 + 1];
    rgb[pixel * 3 + 2] = rgba[pixel * 4 + 2];
    alpha[pixel] = rgba[pixel * 4 + 3];
  }
  return {
    width,
    height,
    rgb: deflateSync(rgb, { level: 9 }),
    alpha: deflateSync(alpha, { level: 9 }),
  };
}

function renderPdf(pages: PageSpec[], stampPng?: Buffer) {
  const stamp = readOfficialStamp(stampPng);
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.push("");
  objects.push(
    "3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  );
  objects.push(
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj",
  );
  const alphaHex = `${stamp.alpha.toString("hex")}>`;
  const rgbHex = `${stamp.rgb.toString("hex")}>`;
  objects.push(
    `5 0 obj << /Type /XObject /Subtype /Image /Width ${stamp.width} /Height ${stamp.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter [/ASCIIHexDecode /FlateDecode] /Length ${alphaHex.length} >> stream\n${alphaHex}\nendstream endobj`,
  );
  objects.push(
    `6 0 obj << /Type /XObject /Subtype /Image /Width ${stamp.width} /Height ${stamp.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /FlateDecode] /SMask 5 0 R /Length ${rgbHex.length} >> stream\n${rgbHex}\nendstream endobj`,
  );
  for (const page of pages) {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    const stream = page.commands.join("\n");
    pageObjectIds.push(pageId);
    objects.push(
      `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Stamp 6 0 R >> >> /Contents ${contentId} 0 R >> endobj`,
    );
    objects.push(
      `${contentId} 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream endobj`,
    );
  }
  objects[1] =
    `2 0 obj << /Type /Pages /Kids [${pageObjectIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pageObjectIds.length} >> endobj`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object}\n`;
  }
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
    .join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export function buildReceiptPdfV2(
  payment: ReceiptPaymentV2,
  layout: ReceiptLayout = "a5",
  requestedMode?: ReceiptMode,
  stampPng?: Buffer,
) {
  try {
    const mode =
      requestedMode ?? (payment.voidedAt ? "voided" : "original");
    const balanceRows = receiptFamilyBalanceRows(payment);
    if (layout === "a4-two-copies") {
      const itemLimit = 4;
      const pageCount = Math.max(1, Math.ceil(balanceRows.length / itemLimit));
      const pages: PageSpec[] = [];
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const commands = ["0.20 w", "0 0 0 RG"];
        drawReceiptCopy(
          commands,
          payment,
          {
            x: 24,
            y: 430,
            width: 547,
            height: 388,
            label: "Customer Copy",
          },
          mode,
          pageIndex * itemLimit,
          itemLimit,
        );
        commands.push("[4 3] 0 d 24 421 m 571 421 l S [] 0 d");
        drawReceiptCopy(
          commands,
          payment,
          {
            x: 24,
            y: 24,
            width: 547,
            height: 372,
            label: "School Copy",
          },
          mode,
          pageIndex * itemLimit,
          itemLimit,
        );
        pages.push({ width: A4.width, height: A4.height, commands });
      }
      return renderPdf(pages, stampPng);
    }

    const itemLimit = 7;
    const pageCount = Math.max(1, Math.ceil(balanceRows.length / itemLimit));
    const pages: PageSpec[] = [];
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const commands = ["0.20 w", "0 0 0 RG"];
      drawReceiptCopy(
        commands,
        payment,
        { x: 24, y: 24, width: A5.width - 48, height: A5.height - 48 },
        mode,
        pageIndex * itemLimit,
        itemLimit,
      );
      pages.push({ width: A5.width, height: A5.height, commands });
    }
    return renderPdf(pages, stampPng);
  } catch (error) {
    if (error instanceof ReceiptGenerationError) throw error;
    throw new ReceiptGenerationError("PDF_RENDER_FAILED", { cause: error });
  }
}
