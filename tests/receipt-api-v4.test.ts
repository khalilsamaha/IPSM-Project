import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { receiptFixture } from "./fixtures/receipt-v4";
const mocks = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn(), audit: vi.fn(), repair: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireSession: mocks.session }));
vi.mock("@/lib/prisma", () => ({ prisma: { payment: { findUnique: mocks.find }, auditLog: { create: mocks.audit } } }));
vi.mock("@/lib/payments/receipt-repair", () => ({ ensurePaymentReceiptWithRetry: mocks.repair }));
vi.mock("@/lib/server-log", () => ({ logServerError: mocks.log }));
import { GET } from "@/app/api/receipts/[paymentId]/route";
const request = (query = "") => GET(new Request(`https://synthetic.invalid/api/receipts/payment${query}`), { params: Promise.resolve({ paymentId: "payment" }) });
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ userId: "authorized-user" }); mocks.audit.mockResolvedValue({}); mocks.repair.mockResolvedValue({}); });
describe("receipt API V4 boundary", () => {
  it.each(["", "?layout=a5", "?layout=a4-two-copies", "?layout=unknown"])("generates and audits A5 for %s", async query => {
    const payment = receiptFixture(10); mocks.find.mockResolvedValue({ ...payment, id: "payment", family: payment.family });
    const response = await request(query);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(payment.receiptNumber);
    const pdf = await PDFDocument.load(await response.arrayBuffer());
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    for (const page of pdf.getPages()) { expect(page.getWidth()).toBeCloseTo(419.528, 2); expect(page.getHeight()).toBeCloseTo(595.276, 2); }
    expect(mocks.repair).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "download", actorId: "authorized-user", metadata: { receiptNumber: payment.receiptNumber, layout: "a5", mode: "original" } }) });
  });
  it.each([[false, "reprint", "reprint"], [true, "voided", "voided_copy_download"]])("preserves reprint/void audit priority: %s", async (voided, mode, action) => {
    const payment = receiptFixture(); mocks.find.mockResolvedValue({ ...payment, id: "payment", voidedAt: voided ? new Date() : null, family: payment.family });
    expect((await request("?layout=a4-two-copies&mode=reprint")).status).toBe(200);
    expect(mocks.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ action, metadata: expect.objectContaining({ layout: "a5", mode }) }) });
  });
  it("does not look up or repair payments without authentication", async () => {
    mocks.session.mockRejectedValueOnce(new Error("Authentication required"));
    await expect(request()).rejects.toThrow("Authentication required"); expect(mocks.find).not.toHaveBeenCalled(); expect(mocks.repair).not.toHaveBeenCalled();
  });
  it("retains the existing safe error response and receipt reference", async () => {
    const payment = receiptFixture(); mocks.find.mockResolvedValue({ ...payment, id: "payment", family: { ...payment.family, students: null } });
    const response = await request(); expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("payment remains recorded"), receiptNumber: payment.receiptNumber });
  });
});
