import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProductionResetSelection, resetOptions, resetOperationalDefaults } from "@/lib/production-reset";
const mocks = vi.hoisted(() => ({ session: vi.fn(), request: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireSession: mocks.session }));
vi.mock("@/lib/prisma", () => ({ prisma: { productionResetRequest: { findFirst: mocks.request } } }));
vi.mock("@/actions/production-reset", () => ({ previewReset: async () => {}, runProductionReset: async () => {} }));
vi.mock("@/components/records/shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  PageHeader: ({ title, description }: { title: string; description: string }) => <header>{title} {description}</header>,
  EmptyState: ({ title, description }: { title: string; description: string }) => <p>{title} {description}</p>,
}));
import ProductionResetPage from "@/app/settings/production-reset/page";
const id = "00000000-0000-4000-8000-000000000001";
const render = async (params = {}) => renderToStaticMarkup(await ProductionResetPage({ searchParams: Promise.resolve(params) }));
describe("fourteen-group reset workspace", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React);
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("NODE_ENV", "production");
    mocks.session.mockResolvedValue({ role: "SUPER_ADMIN", userId: id }); mocks.request.mockReset();
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("renders every independent category under its group", async () => {
    const html = await render();
    for (const option of resetOptions) { expect(html).toContain(`name="${option.key}"`); expect(html).toContain(option.label); }
    expect((html.match(/<fieldset/g) ?? []).length).toBe(6);
    expect(html).not.toContain("Execute reviewed reset");
  });
  it("shows exact settings values, retained counts and dependency blockers without an execute button", async () => {
    mocks.request.mockResolvedValue({ id, expiresAt: new Date(Date.now() + 60_000), consumedAt: null, preview: {
      version: 2, selection: { ...emptyProductionResetSelection, operationalSettings: true },
      totals: { deleted: 0, updated: 1, affected: 1 }, operations: [], updates: [{ operation: "operationalSettings", count: 1, reason: "Restore defaults" }],
      settings: { before: { ...resetOperationalDefaults, attendanceFinalizeGraceMinutes: 60 }, after: resetOperationalDefaults },
      retained: [{ table: "enrollments", count: 7 }], preserved: ["Audit history"], consequences: [], blocked: ["Explicit retained dependency"],
    } });
    const html = await render({ preview: id });
    expect(html).toContain("Operational Settings restoration"); expect(html).toContain("<td>60</td><td>15</td>");
    expect(html).toContain("enrollments: 7 retained"); expect(html).toContain("Explicit retained dependency");
    expect(html).not.toContain("Execute reviewed reset");
  });
  it("keeps the local/Preview gate in place", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(await render()).toContain("Production Reset unavailable"); expect(mocks.request).not.toHaveBeenCalled();
  });
});
