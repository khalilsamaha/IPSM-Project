import { AppShell } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { TeacherWizard } from "./teacher-wizard";
export default async function NewTeacherPage() { const session=await requireSession(); const [courses,levels,seasons]=await Promise.all([prisma.course.findMany({where:{status:"ACTIVE"},orderBy:{name:"asc"}}),prisma.courseLevel.findMany({where:{status:"ACTIVE"},orderBy:{order:"asc"}}),prisma.season.findMany({where:{status:{in:["ACTIVE","PLANNED"]}},orderBy:{startDate:"asc"}})]); return <AppShell session={session}><TeacherWizard courses={courses.map(x=>({id:x.id,name:x.name}))} levels={levels.map(x=>({id:x.id,name:x.name}))} seasons={seasons.map(x=>({id:x.id,name:x.name,start:x.startDate.toISOString().slice(0,10),end:x.endDate.toISOString().slice(0,10)}))}/></AppShell> }
