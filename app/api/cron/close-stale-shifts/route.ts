import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { closeStaleShifts } from "@/lib/shifts/service";
import { logServerError } from "@/lib/server-log";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await closeStaleShifts(prisma)); }
  catch (error) { logServerError("cron.close-stale-shifts", error); return NextResponse.json({ error: "Shift closure failed" }, { status: 500 }); }
}
