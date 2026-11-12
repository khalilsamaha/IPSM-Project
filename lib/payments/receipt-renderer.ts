/**
 * Rendering boundary only. Authorization, stored payment data, repair/idempotency,
 * reprint auditing and stamp validation remain in their existing layers.
 * No uploaded template or alternate renderer is enabled. See docs/RECEIPT_TEMPLATE_HANDOFF.md.
 */
import { buildReceiptPdfV3, type ReceiptLayout, type ReceiptMode, type ReceiptPaymentV2 } from "./receipt-service-v3";

export type ReceiptRenderer = (
  payment: ReceiptPaymentV2, layout?: ReceiptLayout, mode?: ReceiptMode, stampPng?: Buffer,
) => ReturnType<typeof buildReceiptPdfV3>;
export const renderReceipt: ReceiptRenderer = buildReceiptPdfV3;
