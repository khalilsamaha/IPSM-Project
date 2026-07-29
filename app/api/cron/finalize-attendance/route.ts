import { timingSafeEqual } from "node:crypto";
import { finalizeElapsedScheduledLessons } from "@/lib/attendance/auto-finalize";
import { logServerError } from "@/lib/server-log";
export const runtime="nodejs";
function authorized(request:Request){const secret=process.env.CRON_SECRET;if(!secret)return false;const supplied=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";const a=Buffer.from(secret),b=Buffer.from(supplied);return a.length===b.length&&timingSafeEqual(a,b);}
export async function GET(request:Request){if(!authorized(request))return Response.json({error:"Unauthorized"},{status:401});try{const r=await finalizeElapsedScheduledLessons({source:"scheduled_job"});return Response.json({evaluatedCount:r.evaluatedCount,completedCount:r.completedCount,skippedFutureCount:r.skippedFutureCount,skippedLockedCount:r.skippedLockedCount,skippedExceptionCount:r.skippedExceptionCount});}catch(error){logServerError("attendance-cron",error);return Response.json({error:"Attendance finalization failed"},{status:500});}}
