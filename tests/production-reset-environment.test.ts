import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), disconnect: vi.fn(), transaction: vi.fn() }));
vi.mock("@prisma/client", async importOriginal => {
  const actual = await importOriginal<typeof import("@prisma/client")>();
  return { ...actual, PrismaClient: vi.fn(function () {
    return { $queryRaw: mocks.query, $disconnect: mocks.disconnect, $transaction: mocks.transaction };
  }) };
});
import { PrismaClient } from "@prisma/client";
import { createDisposableProductionResetTestClient, isDisposableProductionResetTestClient } from "@/lib/production-reset-test-client";
import { emptyProductionResetSelection, executeProductionReset, isProductionResetEnvironmentAllowed, previewProductionReset, RESET_CONFIRMATION } from "@/lib/production-reset";

const url = "postgresql://test@127.0.0.1:55439/ipsm_reset_integrity_test";
const ordinaryClient = { $transaction: vi.fn() } as unknown as PrismaClient;
beforeEach(() => {
  vi.clearAllMocks();
  for (const name of ["VERCEL", "VERCEL_ENV", "IPSM_DISPOSABLE_TEST_DATABASE", "IPSM_DISPOSABLE_TEST_TOKEN", "RESET_TEST_DATABASE_URL", "DATABASE_URL", "DIRECT_URL", "VITEST"]) vi.stubEnv(name, undefined);
  vi.stubEnv("NODE_ENV", "development");
  mocks.query.mockResolvedValue([{ verified: true }]);
});
afterEach(() => vi.unstubAllEnvs());
function testEnvironment() {
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("VITEST", "true");
  vi.stubEnv("IPSM_DISPOSABLE_TEST_DATABASE", "1"); vi.stubEnv("IPSM_DISPOSABLE_TEST_TOKEN", "a".repeat(64));
  for (const name of ["DATABASE_URL", "DIRECT_URL", "RESET_TEST_DATABASE_URL"]) vi.stubEnv(name, url);
}
async function expectBlocked() {
  expect(isProductionResetEnvironmentAllowed()).toBe(false);
  await expect(previewProductionReset(ordinaryClient, "actor", { ...emptyProductionResetSelection, financialData: true })).rejects.toMatchObject({ code: "environment" });
  await expect(executeProductionReset(ordinaryClient, { actorId: "actor", requestId: "unused", confirmation: RESET_CONFIRMATION, reviewed: true, financialAcknowledged: true })).rejects.toMatchObject({ code: "environment" });
  expect(ordinaryClient.$transaction).not.toHaveBeenCalled();
}

describe("Production Reset deployment boundary", () => {
  it.each([
    [undefined, undefined, "development"], [undefined, undefined, "production"],
    [undefined, "production", "production"], ["0", "production", "production"],
    ["1", "preview", "production"], ["1", "development", "development"],
    ["1", "unknown", "production"], ["1", undefined, "production"],
    ["1", "", "production"], ["1", "production", "development"],
    ["1", "production", "test"], ["", "", "development"],
  ])("blocks preview and execution before database access (%s, %s, %s)", async (vercel, environment, nodeEnv) => {
    vi.stubEnv("VERCEL", vercel); vi.stubEnv("VERCEL_ENV", environment); vi.stubEnv("NODE_ENV", nodeEnv);
    await expectBlocked();
  });
  it("permits normal use only with positive Vercel Production identity", () => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("NODE_ENV", "production");
    expect(isProductionResetEnvironmentAllowed()).toBe(true);
  });
  it("does not authorize an ordinary application client with disposable test flags", async () => {
    testEnvironment();
    await expectBlocked();
    expect(isDisposableProductionResetTestClient(ordinaryClient)).toBe(false);
  });
});

describe("disposable reset client boundary", () => {
  beforeEach(testEnvironment);
  it.each([
    "postgresql://test@remote.example.invalid:55439/ipsm_reset_integrity_test",
    "postgresql://test@127.0.0.1:55439/postgres",
    "postgresql://test@localhost:55439/ipsm_reset_integrity_test",
    "postgresql://test@127.0.0.1/ipsm_reset_integrity_test",
    `${url}?host=remote.example.invalid`, `${url}?options=anything`, `${url}#fragment`,
    "file:/ipsm_reset_integrity_test", "not a URL",
  ])("rejects unsafe endpoints before constructing a client: %s", async unsafeUrl => {
    for (const name of ["DATABASE_URL", "DIRECT_URL", "RESET_TEST_DATABASE_URL"]) vi.stubEnv(name, unsafeUrl);
    await expect(createDisposableProductionResetTestClient()).rejects.toThrow("configuration is invalid");
    expect(PrismaClient).not.toHaveBeenCalled();
  });
  it.each([
    ["DATABASE_URL", "postgresql://test@remote.example.invalid/postgres"],
    ["DIRECT_URL", "postgresql://test@remote.example.invalid/postgres"],
    ["NODE_ENV", "development"], ["NODE_ENV", "production"], ["VITEST", undefined],
    ["IPSM_DISPOSABLE_TEST_DATABASE", undefined], ["IPSM_DISPOSABLE_TEST_TOKEN", undefined],
    ["IPSM_DISPOSABLE_TEST_TOKEN", "invalid"], ["VERCEL", "1"], ["VERCEL_ENV", "preview"],
  ])("rejects invalid test environment %s=%s before connecting", async (name, value) => {
    vi.stubEnv(name, value);
    await expect(createDisposableProductionResetTestClient()).rejects.toThrow("configuration is invalid");
    expect(PrismaClient).not.toHaveBeenCalled();
  });
  it.each([false, null])("rejects an unverified actual server (%s) and disconnects", async verified => {
    mocks.query.mockResolvedValue([{ verified }]);
    await expect(createDisposableProductionResetTestClient()).rejects.toThrow("identity could not be verified");
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("grants only the verified client and revokes the allowance if configuration changes", async () => {
    const client = await createDisposableProductionResetTestClient();
    expect(isDisposableProductionResetTestClient(client)).toBe(true);
    expect(isDisposableProductionResetTestClient(ordinaryClient)).toBe(false);
    expect(isProductionResetEnvironmentAllowed()).toBe(false); // Actions never use the test exception.
    vi.stubEnv("DIRECT_URL", "postgresql://test@remote.example.invalid/postgres");
    expect(isDisposableProductionResetTestClient(client)).toBe(false);
  });
});
