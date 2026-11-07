import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), preview: vi.fn(), execute: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: mocks.session }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/server-log", () => ({ logServerError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/lib/production-reset", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/production-reset")>();
  return { ...actual, previewProductionReset: mocks.preview, executeProductionReset: mocks.execute };
});
import { previewReset, runProductionReset } from "@/actions/production-reset";
const id = "00000000-0000-4000-8000-000000000001";
describe("Production Reset action boundary", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ userId: id, role: "SUPER_ADMIN", status: "ACTIVE" }); });
  it.each([null, { role: "ADMIN", status: "ACTIVE" }, { role: "RECEPTION", status: "ACTIVE" }, { role: "SUPER_ADMIN", status: "INACTIVE" }])("rejects unauthorized callers before touching the reset store (%j)", async session => {
    mocks.session.mockResolvedValue(session);
    await expect(previewReset(new FormData())).rejects.toThrow("not-authorized");
    await expect(runProductionReset(new FormData())).rejects.toThrow("not-authorized");
    expect(mocks.preview).not.toHaveBeenCalled(); expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("does not allow execution fields to inject new categories", async () => {
    const form = new FormData(); form.set("requestId",id); form.set("teachers","on");
    await expect(runProductionReset(form)).rejects.toThrow("error=selection"); expect(mocks.execute).not.toHaveBeenCalled();
  });
  it.each(["preview", "development"])("rejects %s deployment calls before authentication or database access", async environment => {
    vi.stubEnv("VERCEL_ENV", environment);
    await expect(previewReset(new FormData())).rejects.toThrow("error=environment");
    await expect(runProductionReset(new FormData())).rejects.toThrow("error=environment");
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.preview).not.toHaveBeenCalled(); expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("takes actor identity from the session, not from form fields", async () => {
    const form = new FormData(); form.set("financialData","on"); mocks.preview.mockResolvedValue({ id });
    await expect(previewReset(form)).rejects.toThrow(`preview=${id}`);
    expect(mocks.preview).toHaveBeenCalledWith({},id,expect.objectContaining({ financialData: true, teachers: false }));
  });
  it("converts database failures to a handled rollback outcome", async () => {
    const form = new FormData(); form.set("requestId",id); mocks.execute.mockRejectedValue(new Error("private SQL error"));
    await expect(runProductionReset(form)).rejects.toThrow("error=failed"); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
