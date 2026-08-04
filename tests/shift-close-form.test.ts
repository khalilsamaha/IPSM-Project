import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("shift close form regression", () => {
  it("submits the shift id required by the close server action", () => {
    const page = readFileSync("app/shifts/[id]/page.tsx", "utf8");
    expect(page).toContain('<input type="hidden" name="id" value={shift.id} />');
  });

  it("returns close failures to a visible page alert", () => {
    const action = readFileSync("actions/shifts.ts", "utf8");
    const page = readFileSync("app/shifts/[id]/page.tsx", "utf8");
    expect(action).toContain('logServerError("shift.close"');
    expect(action).toContain('redirect(shiftPath(shiftId, safeShiftError(error)))');
    expect(page).toContain('role="alert"');
  });
});
