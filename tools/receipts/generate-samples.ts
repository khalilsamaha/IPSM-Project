/** Local synthetic review artifacts only. Never reads a database or credentials. */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildReceiptPdfV3 } from "../../lib/payments/receipt-service-v3";
import { buildReceiptPdfV4 } from "../../lib/payments/receipt-service-v4";
import { receiptFixture } from "../../tests/fixtures/receipt-v4";

async function main() {
  const directory = path.resolve(process.argv[2] ?? "/tmp/ipsm-receipt-v4-review");
  mkdirSync(directory, { recursive: true });
  for (const count of [1, 3, 6, 10, 24]) {
    const payment = receiptFixture(count, count === 24, count !== 1);
    writeFileSync(path.join(directory, `v3-${count}.pdf`), buildReceiptPdfV3(payment));
    writeFileSync(path.join(directory, `v4-${count}.pdf`), await buildReceiptPdfV4(payment));
  }
  for (const mode of ["reprint", "voided"] as const) {
    const payment = receiptFixture(3); payment.paymentMethod = "whish";
    writeFileSync(path.join(directory, `v4-${mode}.pdf`), await buildReceiptPdfV4(payment, "a4-two-copies", mode));
  }
  const long = receiptFixture(1, true);
  long.familyBalances![0].activity = Array.from({ length: 100 }, (_, i) => `Activity ${i + 1} / Advanced / Winter 2027`).join(", ");
  writeFileSync(path.join(directory, "v4-long-activity.pdf"), await buildReceiptPdfV4(long));
  console.log(`Synthetic V3/V4 PDFs written to ${directory}`);
}
main().catch(() => { console.error("Synthetic receipt generation failed"); process.exitCode = 1; });
