"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { validateTeacherConfiguration } from "@/lib/teachers/onboarding";

export async function createTeacherConfiguration(formData: FormData) {
  const session = await requireSession(); if (!hasPermission(session.role, "records:write")) throw new Error("Not authorized");
  const raw = JSON.parse(String(formData.get("configuration") ?? "{}"));
  const data = await validateTeacherConfiguration(raw, id => prisma.season.findUnique({ where: { id }, select: { startDate: true, endDate: true } }));
  const activeCourseIds = new Set((await prisma.course.findMany({ where: { id: { in: data.assignments.map(x=>x.courseId) }, status: "ACTIVE" }, select: { id: true } })).map(x=>x.id));
  if (activeCourseIds.size !== new Set(data.assignments.map(x=>x.courseId)).size) throw new Error("Only active courses may be assigned.");
  const levelIds = data.assignments.flatMap(x=>x.levelId ? [x.levelId] : []); const activeLevels = await prisma.courseLevel.count({ where: { id: { in: levelIds }, status: "ACTIVE" } }); if (activeLevels !== new Set(levelIds).size) throw new Error("Only active levels may be assigned.");
  const teacher = await prisma.$transaction(async tx => tx.teacher.create({ data: { fullName:data.fullName,email:data.email||null,phone:data.phone||null,notes:data.notes||null,status:data.status,compensationBasis:data.compensationBasis,hourlyRateCents:data.compensationBasis==="HOURLY"?data.rateCents:0,sessionRateCents:data.compensationBasis==="SESSION_UNIT"?data.rateCents:null,sessionUnitMinutes:data.sessionUnitMinutes,courses:{create:data.assignments.map(x=>({courseId:x.courseId,levelId:x.levelId}))},availability:{create:data.availability.map(x=>({...x,status:"ACTIVE"}))} } }));
  redirect(`/teachers/${teacher.id}/edit?success=${encodeURIComponent("Teacher configuration created.")}`);
}
