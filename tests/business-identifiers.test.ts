import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { allocateBusinessIdentifier, compareBusinessIdentifiers, parseBusinessIdentifier, retryIdentifierTransaction } from "@/lib/business-identifiers";
import { readFileSync } from "node:fs";
afterEach(() => vi.unstubAllEnvs());
describe("certified IPSM identifiers", () => {
  it("fails closed without activation before contacting PostgreSQL", async () => {
    vi.stubEnv("IPSM_IDENTIFIER_ACTIVATION_ID", "");
    const query=vi.fn();
    await expect(allocateBusinessIdentifier({$queryRaw:query},"FAM",randomUUID())).rejects.toThrow("blocked");
    expect(query).not.toHaveBeenCalled();
  });
  it("passes owner, UTC year and the explicit attestation to PostgreSQL", async () => {
    const activation=randomUUID(),owner=randomUUID();vi.stubEnv("IPSM_IDENTIFIER_ACTIVATION_ID",activation);
    const query=vi.fn().mockResolvedValue([{value:"RCPT-IPSM-2027-000001"}]);
    expect(await allocateBusinessIdentifier({$queryRaw:query},"RCPT",owner,new Date("2026-12-31T23:30:00-02:00"))).toBe("RCPT-IPSM-2027-000001");
    expect(query.mock.calls[0].slice(1)).toEqual(["RCPT",2027,owner,activation]);
  });
  it.each(["FAM-IPSM-2026-000000","STU-IPSM-2026-0000001","RCPT-IPSM-2026-9223372036854775808","RCPT-IPSM-2026--1","RCPT-IPSM-1999-000001","RCPT-IPSM2-2026-000001"])("rejects invalid format %s",value=>expect(parseBusinessIdentifier(value)).toBeNull());
  it("reads legacy and BIGINT values without Number rounding",()=>{
    expect(parseBusinessIdentifier("RCPT-2026-0001")).toMatchObject({namespace:"legacy",serial:BigInt("1")});
    expect(parseBusinessIdentifier("RCPT-IPSM-2026-9223372036854775807")).toMatchObject({namespace:"IPSM",serial:BigInt("9223372036854775807")});
  });
  it("orders legacy/new serials numerically without rounding or truncation",()=>{
    const sorted=["RCPT-IPSM-2026-9223372036854775807","RCPT-IPSM-2026-1000000","RCPT-2026-0001","RCPT-IPSM-2026-999999","external"].sort(compareBusinessIdentifiers);
    expect(sorted).toEqual(["RCPT-2026-0001","RCPT-IPSM-2026-999999","RCPT-IPSM-2026-1000000","RCPT-IPSM-2026-9223372036854775807","external"]);
  });
  it("retries only transaction conflicts and respects the bound",async()=>{
    const work=vi.fn().mockRejectedValueOnce({code:"P2034"}).mockResolvedValue("committed");
    expect(await retryIdentifierTransaction(work)).toBe("committed");expect(work).toHaveBeenCalledTimes(2);
    const blocked=vi.fn().mockRejectedValue(new Error("activation blocked"));await expect(retryIdentifierTransaction(blocked)).rejects.toThrow("blocked");expect(blocked).toHaveBeenCalledTimes(1);
    const conflict=vi.fn().mockRejectedValue({code:"P2010",meta:{code:"40001"}});await expect(retryIdentifierTransaction(conflict,3)).rejects.toMatchObject({code:"P2010"});expect(conflict).toHaveBeenCalledTimes(3);
  });
  it("keeps all migration mirrors byte-identical",()=>{
    for(const name of ["20261107000000_teacher_guard_parity","20261107010000_reset_integrity","20261108000000_ipsm_identifiers"])
      expect(readFileSync(`prisma/migrations/${name}/migration.sql`,"utf8")).toBe(readFileSync(`supabase/migrations/${name}.sql`,"utf8"));
  });
});
