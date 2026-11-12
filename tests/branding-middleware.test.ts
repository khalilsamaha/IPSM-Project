import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const getUser = vi.hoisted(() => vi.fn(async () => ({ data: { user: null } })));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser } }) }));
import { middleware } from "../middleware";

describe("public original logo without weakening application authentication", () => {
  it("serves the exact logo to login, favicon and image optimizer without an Auth call", async () => {
    getUser.mockClear();
    const result = await middleware(new NextRequest("http://localhost/assets/branding/ipsm-logo-original.jpg"));
    expect(result.headers.get("x-middleware-next")).toBe("1");
    expect(getUser).not.toHaveBeenCalled();
  });
  it.each(["/payments/new", "/expenses/categories", "/assets/private.pdf"])("still authenticates %s", async path => {
    const result = await middleware(new NextRequest(`http://localhost${path}`));
    expect(result.status).toBe(307);
    expect(result.headers.get("location")).toBe("http://localhost/login");
  });
});
