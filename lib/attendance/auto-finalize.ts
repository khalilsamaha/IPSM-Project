import { prisma } from "@/lib/prisma";
import { businessTimeZone, sessionEndInstant } from "@/lib/date-time";
import type { Prisma } from "@prisma/client";

export type AutoFinalizeSource="scheduled_job"|"attendance_page"|"payroll_preview"|"payroll_generation"|"manual_admin";
export type AutoFinalizeResult={evaluatedCount:number;completedCount:number;skippedFutureCount:number;skippedLockedCount:number;skippedExceptionCount:number;completedSessionIds:string[]};
export async function finalizeElapsedScheduledLessons(options:{now?:Date;teacherId?:string;dateFrom?:Date;dateTo?:Date;source:AutoFinalizeSource;actorId?:string|null}):Promise<AutoFinalizeResult>{
 const now=options.now??new Date(), timeZone=businessTimeZone();
 const settings=await prisma.operationalSettings.upsert({where:{id:"school-default"},create:{id:"school-default"},update:{}});
 const result:AutoFinalizeResult={evaluatedCount:0,completedCount:0,skippedFutureCount:0,skippedLockedCount:0,skippedExceptionCount:0,completedSessionIds:[]};
 if(!settings.attendanceAutoFinalizeEnabled)return result;
 const where:Prisma.ScheduleSessionWhereInput={archivedAt:null,status:"SCHEDULED",...(options.teacherId?{teacherId:options.teacherId}:{}),...(options.dateFrom||options.dateTo?{sessionDate:{...(options.dateFrom?{gte:options.dateFrom}:{}),...(options.dateTo?{lte:options.dateTo}:{})}}:{})};
 const batchSize=500; let cursor:string|undefined;
 while(true){
  const rows=await prisma.scheduleSession.findMany({where,orderBy:{id:"asc"},take:batchSize,...(cursor?{cursor:{id:cursor},skip:1}:{}),select:{id:true,sessionDate:true,endTime:true,enrollmentId:true,enrollment:{select:{status:true,archivedAt:true,season:{select:{archivedAt:true}}}},payrollItems:{where:{payroll:{status:{in:["APPROVED","PAID"]}}},select:{id:true}}}});
  if(!rows.length)break; cursor=rows.at(-1)!.id; result.evaluatedCount+=rows.length;
  const eligible:string[]=[];
  for(const row of rows){
   if(row.payrollItems.length){result.skippedLockedCount++;continue;}
   if(row.enrollmentId && (!row.enrollment || row.enrollment.archivedAt || row.enrollment.season.archivedAt || !["ACTIVE","PAUSED","ENDED"].includes(row.enrollment.status))){result.skippedExceptionCount++;continue;}
   try { const eligibleAt=new Date(sessionEndInstant({sessionDate:row.sessionDate,endTime:row.endTime,timeZone}).getTime()+settings.attendanceFinalizeGraceMinutes*60000); if(eligibleAt>now){result.skippedFutureCount++;continue;} } catch {result.skippedExceptionCount++;continue;}
   eligible.push(row.id);
  }
  if(eligible.length) await prisma.$transaction(async tx=>{
   const updated=await tx.scheduleSession.updateMany({where:{id:{in:eligible},status:"SCHEDULED",archivedAt:null,payrollItems:{none:{payroll:{status:{in:["APPROVED","PAID"]}}}}},data:{status:"COMPLETED",attendanceFinalizedAt:now,attendanceSource:"AUTOMATIC",attendanceReason:"Elapsed lesson assumed completed"}});
   result.completedCount+=updated.count;
   const completed=await tx.scheduleSession.findMany({where:{id:{in:eligible},status:"COMPLETED",attendanceFinalizedAt:now,attendanceSource:"AUTOMATIC"},select:{id:true}}); result.completedSessionIds.push(...completed.map(x=>x.id));
   await tx.auditLog.create({data:{action:"attendance_auto_completed",entity:"ScheduleSession",actorId:options.actorId??null,metadata:{source:options.source,teacherId:options.teacherId,dateFrom:options.dateFrom?.toISOString().slice(0,10),dateTo:options.dateTo?.toISOString().slice(0,10),evaluatedCount:rows.length,completedCount:updated.count,graceMinutes:settings.attendanceFinalizeGraceMinutes,timeZone,batchLastId:cursor}}});
  });
  if(rows.length<batchSize)break;
 }
 return result;
}
