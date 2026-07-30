import { describe, expect, it } from "vitest";
import { displayDateFromIso, parseDisplayDate } from "@/lib/date-time";

describe("localized school dates", () => {
  it("converts valid dates in strict two and four digit modes", () => {
    expect(parseDisplayDate("28/07/26")).toBe("2026-07-28");
    expect(parseDisplayDate("29/02/2028", "dd/mm/yyyy")).toBe("2028-02-29");
    expect(displayDateFromIso("2028-02-29", "dd/mm/yyyy")).toBe("29/02/2028");
  });
  it("uses the 1970-2069 window", () => {
    expect(parseDisplayDate("01/01/69")).toBe("2069-01-01");
    expect(parseDisplayDate("01/01/70")).toBe("1970-01-01");
  });
  it.each(["31/02/26", "01/13/26", "29/02/25", "1/01/26"])("rejects %s", value => expect(() => parseDisplayDate(value)).toThrow());
  it("reports the selected four digit format for rollover and malformed dates", () => {
    expect(() => parseDisplayDate("29/02/2027", "dd/mm/yyyy")).toThrow("Enter a valid date in dd/mm/yyyy format.");
    expect(() => parseDisplayDate("29/02/27", "dd/mm/yyyy")).toThrow("Enter a valid date in dd/mm/yyyy format.");
  });
  it("supports empty display conversion", () => expect(displayDateFromIso("")).toBe(""));
});
