import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const paymentPages = [
  "app/payments/page.tsx",
  "app/payments/new/page.tsx",
  "app/payments/[id]/page.tsx",
] as const;

describe("payment page module structure", () => {
  it.each(paymentPages)("keeps imports at the top and a single default export in %s", (filePath) => {
    const source = readFileSync(filePath, "utf8");
    const lines = source.split("\n");
    const defaultExports = source.match(/export default async function/g) ?? [];
    expect(defaultExports).toHaveLength(1);

    const firstNonImportLine = lines.findIndex((line) => line.trim() !== "" && !line.startsWith("import "));
    const importAfterCode = lines.slice(firstNonImportLine + 1).find((line) => line.startsWith("import "));
    expect(importAfterCode).toBeUndefined();
  });
});
