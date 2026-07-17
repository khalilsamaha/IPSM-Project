import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("payment redirect and payer selector regressions", () => {
  it("keeps redirect outside the payment creation catch block", () => {
    const source = readFileSync("actions/payments.ts", "utf8");
    const catchIndex = source.indexOf("} catch (error) {");
    const redirectIndex = source.lastIndexOf("redirect(`/payments/${paymentId}?success=created`)");
    expect(redirectIndex).toBeGreaterThan(catchIndex);
    expect(source).not.toContain("NEXT_REDIRECT");
  });

  it("stores UUIDs only in hidden payer fields and avoids datalist UUID display", () => {
    const source = readFileSync("app/payments/new/payment-payer-selector.tsx", "utf8");
    expect(source).toContain('type="hidden" name={name} value={value}');
    expect(source).not.toContain("<datalist");
    expect(source).toContain("Clear");
  });
});
