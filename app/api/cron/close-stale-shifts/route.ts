import { handleCloseStaleShiftsCron } from "@/lib/shifts/cron-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleCloseStaleShiftsCron(request, "summer_midnight");
}
