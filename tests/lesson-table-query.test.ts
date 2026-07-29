import { describe, expect, it } from "vitest";
import { buildLessonTableQuery, formatLessonTime } from "@/lib/schedule/lesson-table-query";

describe("lesson table query", () => {
  it("uses safe defaults and 24-hour time", () => { const q=buildLessonTableQuery({}); expect("error" in q).toBe(false); if("error" in q)return; expect(q.params).toMatchObject({page:1,pageSize:25,sort:"date",direction:"asc"}); expect(q.orderBy.slice(0,2)).toEqual([{sessionDate:"asc"},{startTime:"asc"}]); expect(formatLessonTime("16:00","17:00")).toBe("16:00–17:00"); });
  it("combines validated filters", () => { const q=buildLessonTableQuery({teacherId:"00000000-0000-4000-8000-000000000001",studentId:"00000000-0000-4000-8000-000000000002",source:"recurring",payrollState:"PAID",dateFrom:"2026-07-01",dateTo:"2026-07-31",page:"2",pageSize:"50"}); expect("error" in q).toBe(false); if("error" in q)return; expect(q.skip).toBe(50); expect(q.take).toBe(50); expect(q.where.AND).toHaveLength(6); });
  it("rejects malformed/reversed dates and normalizes paging allowlists", () => { expect(buildLessonTableQuery({dateFrom:"07/01/26"})).toHaveProperty("error"); expect(buildLessonTableQuery({dateFrom:"2026-08-01",dateTo:"2026-07-01"})).toHaveProperty("error"); const q=buildLessonTableQuery({sort:"drop table",pageSize:"999",page:"-2"}); expect("error" in q).toBe(false); if("error" in q)return; expect(q.params).toMatchObject({sort:"date",pageSize:25,page:1}); });
});
