/**
 * Rendering boundary only. Authorization, stored payment data, repair/idempotency,
 * reprint auditing and stamp validation remain in their existing layers.
 * V4 renders measured A5 pages; legacy layout arguments cannot select A4. See docs/RECEIPT_TEMPLATE_HANDOFF.md.
 */
import { buildReceiptPdfV4, type ReceiptLayout, type ReceiptMode, type ReceiptPaymentV2 } from "./receipt-service-v4";

export type ReceiptRenderer = (
  payment: ReceiptPaymentV2, layout?: ReceiptLayout, mode?: ReceiptMode, stampPng?: Buffer,
) => ReturnType<typeof buildReceiptPdfV4>;
export const renderReceipt: ReceiptRenderer = buildReceiptPdfV4;
