import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const paymentPages = [
  "app/payments/page.tsx",
  "app/payments/new/page.tsx",
  "app/payments/[id]/page.tsx",
] as const;

function sourceAfterLeadingImports(source: string) {
  let cursor = 0;
  while (cursor < source.length) {
    const remaining = source.slice(cursor);
    const whitespace = /^\s*/.exec(remaining)?.[0].length ?? 0;
    cursor += whitespace;
    if (!source.startsWith("import ", cursor)) break;
    const semicolon = source.indexOf(";", cursor);
    if (semicolon < 0) throw new Error("Import statement is missing a semicolon.");
    cursor = semicolon + 1;
  }
  return source.slice(cursor);
}

describe("payment page module structure", () => {
  it.each(paymentPages)(
    "keeps imports at the top and a single default export in %s",
    (filePath) => {
      const source = readFileSync(filePath, "utf8");
      const defaultExports = source.match(/export default async function/g) ?? [];
      expect(defaultExports).toHaveLength(1);

      const sourceAfterImports = sourceAfterLeadingImports(source);
      expect(sourceAfterImports).not.toMatch(/^import\s/m);
    },
  );
});
