import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-log";
import { closeStaleShifts } from "@/lib/shifts/service";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false as const, missingConfiguration: true };
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return {
    ok:
      expectedBuffer.length === suppliedBuffer.length &&
      timingSafeEqual(expectedBuffer, suppliedBuffer),
    missingConfiguration: false,
  } as const;
}

export async function handleCloseStaleShiftsCron(
  request: Request,
  triggerWindow: "summer_midnight" | "winter_midnight",
) {
  const auth = authorized(request);
  if (!auth.ok) {
    if (auth.missingConfiguration) {
      logServerError(
        "cron.close-stale-shifts.configuration",
        new Error("CRON_SECRET is required for automatic shift closure."),
        { triggerWindow },
      );
      return json({ error: "Cron configuration is incomplete" }, 503);
    }
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const result = await closeStaleShifts(prisma);
    return json({
      ...result,
      triggerWindow,
      invokedAt: new Date().toISOString(),
    });
  } catch (error) {
    logServerError("cron.close-stale-shifts", error, { triggerWindow });
    return json({ error: "Shift closure failed" }, 500);
  }
}
