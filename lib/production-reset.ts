import { createHash } from "node:crypto";
import { productionResetForeignKeys } from "@/lib/production-reset-foreign-keys";
import { Prisma, type PrismaClient } from "@prisma/client";
import { isDisposableProductionResetTestClient } from "@/lib/production-reset-test-client";

export const resetOptions = [
  { key: "operationalData", group: "Operational Records", label: "Operational Data", description: "All enrollments, registration attempts, lessons and recurring patterns. Financial records require a separate Financial Data selection." },
  { key: "financialData", group: "Financial Records", label: "Financial Data", description: "All payments, receipts, allocations, expenses, shifts and payroll. Surviving enrollment balances are restored to their original outstanding charges." },
  { key: "scheduleData", group: "Operational Records", label: "Schedule Data", description: "All lessons, attendance and patterns. Blocked when retained enrollments depend on them, or payroll is retained." },
  { key: "studentsFamilies", group: "Academic Records", label: "Students / Families", description: "All students, families and dependent enrollment, registration and schedule records. Linked payments require Financial Data." },
  { key: "teachers", group: "Academic Records", label: "Teachers", description: "All teachers, assignments, availability and schedules. Retained teacher-linked enrollments or payroll block deletion." },
  { key: "seasons", group: "Academic Records", label: "Seasons", description: "All seasons, enrollments, registrations, schedules, seasonal availability and seasonal prices. Global pricing is preserved unless independently selected." },
  { key: "courses", group: "Academic Configuration", label: "Courses / Instruments", description: "All course definitions, including archived courses. Retained enrollments, pricing, assignments or availability block deletion." },
  { key: "courseLevels", group: "Academic Configuration", label: "Course Levels", description: "All levels and ordering. Retained enrollments, pricing or assignments block deletion." },
  { key: "globalCoursePricing", group: "Academic Configuration", label: "Global Course Pricing", description: "Prices without a season only. Seasonal prices and enrollment charges are preserved; retained pricing references block deletion." },
  { key: "rooms", group: "Scheduling Configuration", label: "Rooms", description: "All rooms, including archived rooms. Retained lessons or patterns block deletion; room assignments are never silently cleared." },
  { key: "schoolClosures", group: "Scheduling Configuration", label: "School Closures", description: "All holidays and closures, including archived records. Previously skipped lessons are not regenerated." },
  { key: "operationalSettings", group: "System Settings", label: "Operational Settings", description: "Restore attendance auto-finalization enabled, 15-minute grace and payable missed lessons disabled. Preserve the settings row and audit previous/restored values." },
  { key: "teacherAvailability", group: "Scheduling Configuration", label: "Teacher Availability", description: "All global and seasonal availability. Retained teacher-linked enrollments or lessons that may depend on it block deletion." },
  { key: "teacherCourseAssignments", group: "Academic Configuration", label: "Teacher Course Assignments", description: "All teacher-course/level assignments. Retained availability, enrollments or lessons that may depend on eligibility block deletion." },
] as const;
export type ProductionResetScope = (typeof resetOptions)[number]["key"];
export const productionResetScopes = resetOptions.map(option => option.key);
export const resetOptionGroups = [...new Set(resetOptions.map(option => option.group))];
export type ProductionResetSelection = Record<ProductionResetScope, boolean>;
export const emptyProductionResetSelection = Object.fromEntries(productionResetScopes.map(key => [key, false])) as ProductionResetSelection;
export const RESET_CONFIRMATION = "RESET IPSM DATA";
export const resetOperationalDefaults = { attendanceAutoFinalizeEnabled: true, attendanceFinalizeGraceMinutes: 15, allowPayableMissedLessons: false } as const;
type OperationalValues = { [K in keyof typeof resetOperationalDefaults]: (typeof resetOperationalDefaults)[K] extends boolean ? boolean : number };
export const resetProtected = ["Application users, identities, roles and statuses", "Supabase Auth users and sessions", "All existing audit history", "Issued business identifiers and reset submission tombstones", "Database schema, migrations, roles, permissions, RLS, triggers and indexes", "Supabase Storage, secrets, configuration and backups"];
export type ResetErrorCode = "selection" | "not-authorized" | "environment" | "confirmation" | "acknowledgement" | "blocked" | "stale" | "failed";
export class ProductionResetError extends Error {
  constructor(public code: ResetErrorCode, message: string) { super(message); this.name = "ProductionResetError"; }
}

// Local development can share production credentials too: require positive
// deployment identity, never infer permission from missing Vercel variables.
export function isProductionResetEnvironmentAllowed() {
  return process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production" && process.env.NODE_ENV === "production";
}
function requireResetEnvironment(prisma: PrismaClient) {
  if (!isProductionResetEnvironmentAllowed() && !isDisposableProductionResetTestClient(prisma)) throw new ProductionResetError("environment", "Production Reset is unavailable outside the Vercel production environment.");
}

export function validateProductionResetSelection(value: unknown): ProductionResetSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProductionResetError("selection", "Invalid selection.");
  const entries = Object.entries(value);
  if (entries.length !== productionResetScopes.length || entries.some(([key, flag]) => !productionResetScopes.includes(key as ProductionResetScope) || typeof flag !== "boolean")) {
    throw new ProductionResetError("selection", "Unsupported reset selection.");
  }
  const selection = value as ProductionResetSelection;
  if (!hasProductionResetSelection(selection)) throw new ProductionResetError("selection", "Choose at least one category.");
  return selection;
}
export function parseProductionResetSelection(form: FormData): ProductionResetSelection {
  for (const [key, value] of form) {
    if (key.startsWith("$ACTION_")) continue;
    if (!productionResetScopes.includes(key as ProductionResetScope) || value !== "on" || form.getAll(key).length !== 1) {
      throw new ProductionResetError("selection", "Unsupported or repeated reset category.");
    }
  }
  return validateProductionResetSelection(Object.fromEntries(productionResetScopes.map(key => [key, form.get(key) === "on"])));
}
export function hasProductionResetSelection(selection: ProductionResetSelection) { return productionResetScopes.some(key => selection[key]); }

// Identifiers are application constants, never request-derived SQL identifiers.
export const resetTables = {
  receipt: "receipts", paymentItem: "payment_items", payment: "payments", expense: "expenses", cashierShift: "cashier_shifts",
  teacherPayrollItem: "teacher_payroll_items", teacherPayroll: "teacher_payrolls", scheduleSession: "schedule_sessions", schedulePattern: "schedule_patterns",
  registrationAttempt: "registration_attempts", enrollment: "enrollments", teacherAvailability: "teacher_availability", teacherCourse: "teacher_courses",
  teacher: "teachers", student: "students", family: "families", coursePricing: "course_pricings", season: "seasons",
  course: "courses", courseLevel: "course_levels", room: "rooms", schoolClosure: "school_closures",
} as const;
export type ResetModel = keyof typeof resetTables;
export type ProductionResetOperation = ResetModel | "teacherAvailabilitySeasonScoped" | "coursePricingSeasonScoped" | "coursePricingGlobalScoped";
export type ResetOperation = { operation: ProductionResetOperation; model: ResetModel; filter: "all" | "seasonal" | "global" | "seasonalSessions"; reason: string; effect: "direct" | "dependent" };
export function getProductionResetPlan(selection: ProductionResetSelection): ResetOperation[] {
  validateProductionResetSelection(selection);
  const result: ResetOperation[] = [];
  const add = (model: ResetModel, reason: string, effect: "direct" | "dependent" = "dependent", filter: "all" | "seasonal" | "global" = "all") => {
    const operation = filter === "global" ? "coursePricingGlobalScoped" : filter === "seasonal" ? `${model}SeasonScoped` as ProductionResetOperation : model;
    result.push({ operation, model, filter, reason, effect });
  };
  if (selection.financialData) {
    for (const model of ["receipt", "paymentItem", "payment", "expense", "cashierShift", "teacherPayrollItem", "teacherPayroll"] as const) add(model, "Explicit Financial Data selection", "direct");
  }
  const enrollment = selection.operationalData || selection.studentsFamilies || selection.seasons;
  const schedule = enrollment || selection.scheduleData || selection.teachers;
  if (schedule) {
    add("scheduleSession", "Lessons and attendance in the selected operational scope", selection.scheduleData || selection.operationalData ? "direct" : "dependent");
    if (selection.seasons && !selection.operationalData && !selection.studentsFamilies && !selection.teachers && !selection.scheduleData) {
      result[result.length - 1].filter = "seasonalSessions";
      result[result.length - 1].reason = "Season-, enrollment- or pattern-linked lessons; standalone lessons are preserved";
    }
    add("schedulePattern", "Recurring patterns supporting the deleted lessons", selection.scheduleData || selection.operationalData ? "direct" : "dependent");
  }
  if (enrollment) {
    add("registrationAttempt", "Registration state for removed enrollments; submission IDs remain reserved");
    add("enrollment", "Enrollment deletion explicitly included by Operational Data, Students / Families or Seasons", "direct");
  }
  if (selection.teachers || selection.teacherAvailability) add("teacherAvailability", "All global and seasonal availability", selection.teacherAvailability ? "direct" : "dependent");
  else if (selection.seasons) add("teacherAvailability", "Delete seasonal availability before seasons; preserve global availability", "dependent", "seasonal");
  if (selection.teachers || selection.teacherCourseAssignments) add("teacherCourse", "Teacher-course/level assignments", selection.teacherCourseAssignments ? "direct" : "dependent");
  if (selection.teachers) add("teacher", "Explicit Teachers selection", "direct");
  if (selection.studentsFamilies) { add("student", "Explicit Students / Families selection", "direct"); add("family", "Explicit Students / Families selection", "direct"); }
  if (selection.seasons || selection.globalCoursePricing) {
    const filter = selection.seasons && selection.globalCoursePricing ? "all" : selection.seasons ? "seasonal" : "global";
    add("coursePricing", filter === "all" ? "Explicit global pricing and season-specific pricing selections" : filter === "seasonal" ? "Delete seasonal prices before seasons; preserve global pricing" : "Explicit global pricing selection; seasonal prices are preserved", selection.globalCoursePricing ? "direct" : "dependent", filter);
  }
  if (selection.seasons) add("season", "Explicit Seasons selection", "direct");
  if (selection.courses) add("course", "Explicit Courses / Instruments selection, including archived records", "direct");
  if (selection.courseLevels) add("courseLevel", "Explicit Course Levels selection, including archived records", "direct");
  if (selection.rooms) add("room", "Explicit Rooms selection, including archived records", "direct");
  if (selection.schoolClosures) add("schoolClosure", "Explicit School Closures selection, including archived records", "direct");
  return result;
}

const observedTables = [...new Set([...Object.values(resetTables), "courses", "course_levels", "rooms", "school_closures", "operational_settings", "business_identifier_counters", "issued_business_identifiers", "reset_registration_submissions", "production_reset_state"])].sort();
type Tx = Prisma.TransactionClient;
export type ResetPreview = {
  version: 2; selection: ProductionResetSelection; fingerprint: string;
  operations: Array<ResetOperation & { count: number }>;
  updates: Array<{ operation: string; count: number; reason: string }>;
  settings: { before: OperationalValues | null; after: OperationalValues } | null;
  retained: Array<{ table: string; count: number }>;
  blocked: string[]; preserved: string[]; consequences: string[];
  totals: { deleted: number; updated: number; affected: number };
  financial: { cashPaymentsCents: number; whishPaymentsCents: number; otherPaymentsCents: number; cashExpensesCents: number; whishExpensesCents: number; otherExpensesCents: number; payrollCents: number; closedShifts: number };
};

async function lockResetTables(tx: Tx) {
  // LOCK is the first database operation: acquire the write barrier before the
  // serializable snapshot. The table lock also serializes competing resets.
  await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
  await tx.$executeRawUnsafe(`LOCK TABLE ${observedTables.map(table => `public."${table}"`).join(", ")} IN SHARE ROW EXCLUSIVE MODE`);
  await tx.$executeRaw`LOCK TABLE public.users IN SHARE MODE`;
}
async function requireResetActor(tx: Tx, actorId: string) {
  const user = await tx.userProfile.findUnique({ where: { authId: actorId } });
  if (!user || user.role !== "SUPER_ADMIN" || user.status !== "ACTIVE" || user.archivedAt) throw new ProductionResetError("not-authorized", "Active SUPER_ADMIN access is required.");
  return user;
}
async function snapshot(tx: Tx) {
  const counts: Record<string, number> = {};
  const hashes: string[] = [];
  for (const table of observedTables) {
    const [row] = await tx.$queryRawUnsafe<Array<{ count: number; hash: string }>>(`SELECT count(*)::integer AS count, md5(coalesce(string_agg(h, '' ORDER BY h), '')) AS hash FROM (SELECT md5(to_jsonb(t)::text) h FROM public."${table}" t) rows`);
    counts[table] = row.count;
    hashes.push(`${table}:${row.count}:${row.hash}`);
  }
  return { counts, fingerprint: createHash("sha256").update(hashes.join("|")).digest("hex") };
}

export async function inspectProductionReset(tx: Tx, selection: ProductionResetSelection): Promise<ResetPreview> {
  const plan = getProductionResetPlan(selection);
  const { counts, fingerprint } = await snapshot(tx);
  const deletes = new Set(plan.map(row => row.model));
  const blocked: string[] = [];
  const dependencies = plan.length ? await tx.$queryRaw<Array<{ child: string; parent: string; signature: string; validated: boolean }>>`
    SELECT child_ns.nspname || '.' || child.relname AS child, parent.relname AS parent,
      c.convalidated AS validated,
      child_ns.nspname || '.' || child.relname || '.' ||
        (SELECT string_agg(a.attname, ',' ORDER BY k.position) FROM unnest(c.conkey) WITH ORDINALITY k(attnum, position) JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum) ||
      '->' || parent_ns.nspname || '.' || parent.relname || '.' ||
        (SELECT string_agg(a.attname, ',' ORDER BY k.position) FROM unnest(c.confkey) WITH ORDINALITY k(attnum, position) JOIN pg_catalog.pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.attnum) ||
      ':' || c.confdeltype::text || c.confupdtype::text AS signature
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class child ON child.oid = c.conrelid
    JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN pg_catalog.pg_class parent ON parent.oid = c.confrelid
    JOIN pg_catalog.pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
    WHERE c.contype = 'f' AND parent_ns.nspname = 'public'
      AND parent.relname IN (${Prisma.join(plan.map(row => resetTables[row.model]))})
    ORDER BY signature
  ` : [];
  for (const dependency of dependencies.filter(row => !row.validated || !productionResetForeignKeys.has(row.signature))) blocked.push(`Unmodeled database dependency: ${dependency.child} references ${dependency.parent}. Review the live schema before deleting either table.`);
  if (!selection.financialData) {
    if ((deletes.has("enrollment") && counts.payment_items) || (deletes.has("family") && counts.payments)) blocked.push("Retained payments reference the selected academic records. Select Financial Data explicitly, or preserve these records.");
    if (deletes.has("scheduleSession") || deletes.has("teacher")) {
      const postings = await tx.expense.count({ where: { OR: [{ payrollId: { not: null } }, { category: { equals: "Teacher Payroll", mode: "insensitive" } }] } });
      if (counts.teacher_payrolls || postings) blocked.push("Payroll history must be retained with its teachers and lessons. Financial Data is required to delete payroll and its expense postings together, including legacy postings without a payroll link.");
    }
  }
  if (deletes.has("teacher") && !deletes.has("enrollment") && await tx.enrollment.count({ where: { teacherId: { not: null } } })) blocked.push("Teachers are assigned to retained enrollments, including historical records. Explicitly select Operational Data, Students / Families or Seasons; teachers will not be silently unassigned.");
  if (deletes.has("scheduleSession") && !deletes.has("enrollment")) {
    const linked = await tx.scheduleSession.count({ where: { enrollmentId: { not: null } } });
    if (linked || counts.schedule_patterns) blocked.push("Retained enrollments depend on these lessons or patterns. Explicitly include their enrollments; charges and planned lesson counts will not be silently rewritten.");
  }
  blocked.push(...await retainedDependencyBlockers(tx, plan, dependencies, selection));
  blocked.push(...await eligibilityBlockers(tx, plan));
  const updates: ResetPreview["updates"] = [];
  let settings: ResetPreview["settings"] = null;
  if (selection.operationalSettings) {
    const row = await tx.operationalSettings.findUnique({ where: { id: "school-default" }, select: { attendanceAutoFinalizeEnabled: true, attendanceFinalizeGraceMinutes: true, allowPayableMissedLessons: true } });
    settings = { before: row, after: { ...resetOperationalDefaults } };
    updates.push({ operation: "operationalSettings", count: row && canonical(row) !== canonical(resetOperationalDefaults) ? 1 : 0, reason: "Restore school defaults without deleting the settings row. A missing row already uses these defaults; unrelated settings IDs are preserved." });
  }
  if (selection.financialData && !deletes.has("enrollment")) {
    const [row] = await tx.$queryRaw<Array<{ invalid: number; changed: number }>>`SELECT count(*) FILTER (WHERE fee_cents < 0 OR discount_cents < 0 OR final_fee_cents <> greatest(0, fee_cents - discount_cents))::integer AS invalid, count(*) FILTER (WHERE paid_cents <> 0 OR remaining_cents <> final_fee_cents)::integer AS changed FROM public.enrollments`;
    if (row.invalid) blocked.push(`${row.invalid} retained enrollments have inconsistent original charges. Resolve these charges before resetting payments.`);
    updates.push({ operation: "enrollmentBalances", count: row.changed, reason: "Set paid to zero and outstanding to the unchanged final fee; voided allocations are not subtracted twice." });
    updates.push({ operation: "registrationPaymentReferences", count: await tx.registrationAttempt.count({ where: { paymentId: { not: null } } }), reason: "Clear removed payment links; completed academic registrations and submission IDs remain intact." });
  }
  const operations: ResetPreview["operations"] = [];
  for (const entry of plan) {
    const count = entry.filter !== "all"
      ? await tx.$queryRawUnsafe<Array<{ count: number }>>(`SELECT count(*)::integer AS count FROM public."${resetTables[entry.model]}"${resetPredicate(entry.filter)}`).then(rows => rows[0].count)
      : counts[resetTables[entry.model]];
    operations.push({ ...entry, count });
  }
  const [money] = await tx.$queryRaw<Array<ResetPreview["financial"]>>`SELECT
    (SELECT coalesce(sum(total_amount_cents),0)::float8 FROM public.payments WHERE voided_at IS NULL AND payment_method='cash') AS "cashPaymentsCents",
    (SELECT coalesce(sum(total_amount_cents),0)::float8 FROM public.payments WHERE voided_at IS NULL AND payment_method='whish') AS "whishPaymentsCents",
    (SELECT coalesce(sum(total_amount_cents),0)::float8 FROM public.payments WHERE voided_at IS NULL AND payment_method NOT IN ('cash','whish')) AS "otherPaymentsCents",
    (SELECT coalesce(sum(amount_cents),0)::float8 FROM public.expenses WHERE archived_at IS NULL AND payment_method='cash') AS "cashExpensesCents",
    (SELECT coalesce(sum(amount_cents),0)::float8 FROM public.expenses WHERE archived_at IS NULL AND payment_method='whish') AS "whishExpensesCents",
    (SELECT coalesce(sum(amount_cents),0)::float8 FROM public.expenses WHERE archived_at IS NULL AND payment_method NOT IN ('cash','whish')) AS "otherExpensesCents",
    (SELECT coalesce(sum(gross_amount_cents),0)::float8 FROM public.teacher_payrolls WHERE status='PAID') AS "payrollCents",
    (SELECT count(*)::integer FROM public.cashier_shifts WHERE status IN ('CLOSED','AUTO_CLOSED') OR closing_snapshot IS NOT NULL) AS "closedShifts"`;
  const deleted = operations.reduce((sum, row) => sum + row.count, 0);
  const updated = updates.reduce((sum, row) => sum + row.count, 0);
  return {
    version: 2, selection, fingerprint, operations, updates, settings, blocked, preserved: [...resetProtected],
    retained: Object.values(resetTables).map(table => ({ table, count: counts[table] - operations.filter(row => resetTables[row.model] === table).reduce((sum, row) => sum + row.count, 0) })),
    consequences: [
      "All dates and statuses are included, including archived and cancelled records. There is no demo-data filter.",
      selection.financialData ? "Financial history, including closed shifts, their snapshots, voids and paid payroll expenses, will be deleted together. Existing audit history is retained." : "Payments, expenses, payroll and shift reconciliation history are preserved.",
      ...(selection.schoolClosures ? ["Removing closures does not regenerate previously skipped lessons or change existing recurring patterns."] : []),
      ...(selection.operationalSettings ? ["Only future operations use restored settings; existing attendance, payroll and financial records are unchanged."] : []),
      "Previously issued receipt, student and family identifiers remain reserved.",
      "Removed registrations retain a permanent submission tombstone. Start a new registration instead of replaying an old submission.",
    ],
    totals: { deleted, updated, affected: deleted + updated },
    financial: selection.financialData ? money : { cashPaymentsCents: 0, whishPaymentsCents: 0, otherPaymentsCents: 0, cashExpensesCents: 0, whishExpensesCents: 0, otherExpensesCents: 0, payrollCents: 0, closedShifts: 0 },
  };
}

export async function previewProductionReset(prisma: PrismaClient, actorId: string, selection: ProductionResetSelection) {
  requireResetEnvironment(prisma);
  validateProductionResetSelection(selection);
  return prisma.$transaction(async tx => {
    // One MVCC snapshot keeps every count/hash consistent without blocking
    // normal writers. Only the preview request is written in this transaction.
    // Execution acquires its own barrier and rejects any intervening changes.
    // ACCESS SHARE stabilizes table identities against concurrent DDL/TRUNCATE;
    // it is compatible with normal INSERT/UPDATE/DELETE and execution's locks.
    await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
    await tx.$executeRawUnsafe(`LOCK TABLE ${observedTables.map(table => `public."${table}"`).join(", ")}, public.users IN ACCESS SHARE MODE`);
    await requireResetActor(tx, actorId);
    const preview = await inspectProductionReset(tx, selection);
    const request = await tx.productionResetRequest.create({ data: {
      actorId, selection, fingerprint: preview.fingerprint, preview: preview as unknown as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    } });
    return { id: request.id, preview };
  }, { isolationLevel: "RepeatableRead", maxWait: 10_000, timeout: 60_000 });
}

export async function executeProductionReset(prisma: PrismaClient, input: { actorId: string; requestId: string; confirmation: string; reviewed: boolean; financialAcknowledged: boolean }) {
  requireResetEnvironment(prisma);
  if (input.confirmation !== RESET_CONFIRMATION || !input.reviewed) throw new ProductionResetError("confirmation", "Review the preview and type the exact confirmation phrase.");
  return prisma.$transaction(async tx => {
    await lockResetTables(tx);
    const user = await requireResetActor(tx, input.actorId);
    const request = await tx.productionResetRequest.findUnique({ where: { id: input.requestId } });
    if (!request || request.actorId !== input.actorId || request.consumedAt || request.expiresAt.getTime() <= Date.now()) throw new ProductionResetError("stale", "Preview expired, was used, or belongs to another user. Preview again.");
    const selection = validateProductionResetSelection(request.selection);
    if (selection.financialData && !input.financialAcknowledged) throw new ProductionResetError("acknowledgement", "Explicit acknowledgement of financial history deletion is required.");
    const preview = await inspectProductionReset(tx, selection);
    // JSONB does not retain object key order. Compare both data and policy effects.
    if (preview.fingerprint !== request.fingerprint || canonical(preview) !== canonical(request.preview)) throw new ProductionResetError("stale", "Data or the reset policy changed since preview. Preview again.");
    if (preview.blocked.length) throw new ProductionResetError("blocked", preview.blocked.join(" "));
    const deleted: Record<string, number> = {};
    const updated: Record<string, number> = {};
    const removesEnrollments = preview.operations.some(row => row.model === "enrollment");
    if (removesEnrollments) {
      await tx.$executeRaw`INSERT INTO public.reset_registration_submissions(id) SELECT registration_submission_id FROM public.enrollments WHERE registration_submission_id IS NOT NULL UNION SELECT id FROM public.registration_attempts ON CONFLICT DO NOTHING`;
    }
    // Explicit updates give truthful actual counts; do not rely on invisible FK effects.
    if (selection.financialData && !removesEnrollments) {
      updated.registrationPaymentReferences = (await tx.registrationAttempt.updateMany({ where: { paymentId: { not: null } }, data: { paymentId: null } })).count;
    }
    for (const entry of preview.operations) {
      const predicate = resetPredicate(entry.filter);
      deleted[entry.operation] = await tx.$executeRawUnsafe(`DELETE FROM public."${resetTables[entry.model]}"${predicate}`);
      if (deleted[entry.operation] !== entry.count) throw new ProductionResetError("stale", "Affected rows changed during execution.");
    }
    if (selection.financialData && !removesEnrollments) {
      updated.enrollmentBalances = await tx.$executeRaw`UPDATE public.enrollments SET paid_cents = 0, remaining_cents = final_fee_cents, updated_at = CURRENT_TIMESTAMP WHERE paid_cents <> 0 OR remaining_cents <> final_fee_cents`;
    }
    if (preview.settings) {
      const change = preview.updates.find(row => row.operation === "operationalSettings")!;
      updated.operationalSettings = change.count ? (await tx.operationalSettings.updateMany({ where: { id: "school-default" }, data: { ...resetOperationalDefaults, updatedById: user.id } })).count : 0;
      if (updated.operationalSettings !== change.count) throw new ProductionResetError("stale", "Settings changed during execution.");
    }
    const result = { deleted, updated, totals: { deleted: Object.values(deleted).reduce((a,b) => a+b,0), updated: Object.values(updated).reduce((a,b) => a+b,0) } };
    await tx.auditLog.create({ data: { actorId: input.actorId, createdById: user.id, action: "production_reset", entity: "System", metadata: { requestId: request.id, preview: preview as unknown as Prisma.InputJsonValue, result } } });
    await tx.productionResetRequest.update({ where: { id: request.id }, data: { consumedAt: new Date(), result } });
    // Last domain write; subsequent old transactions are rejected by the generation guard.
    await tx.$executeRaw`UPDATE public.production_reset_state SET changed_at = clock_timestamp() WHERE id = 'school'`;
    return result;
  }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 60_000 });
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}

function resetPredicate(filter: ResetOperation["filter"]) {
  if (filter === "global") return " WHERE season_id IS NULL";
  if (filter === "seasonal") return " WHERE season_id IS NOT NULL";
  if (filter === "seasonalSessions") return " WHERE season_id IS NOT NULL OR enrollment_id IS NOT NULL OR schedule_pattern_id IS NOT NULL";
  return "";
}

// Only reviewed signatures reach this query builder. Schema/column identifiers
// come from the constant allowlist, never from the request or an unknown FK.
async function retainedDependencyBlockers(tx: Tx, plan: ResetOperation[], dependencies: Array<{ signature: string; validated: boolean }>, selection: ProductionResetSelection) {
  const blocked: string[] = [];
  for (const dependency of dependencies) {
    if (!dependency.validated || !productionResetForeignKeys.has(dependency.signature)) continue;
    const [reference] = dependency.signature.split(":");
    const [child, parent] = reference.split("->").map(side => side.split("."));
    const childOperation = plan.find(row => resetTables[row.model] === child[1]);
    const parentOperation = plan.find(row => resetTables[row.model] === parent[1])!;
    if (childOperation?.filter === "all") continue;
    // This is the existing, explicit financial reset update shown in preview.
    if (selection.financialData && child[1] === "registration_attempts" && child[2] === "payment_id") continue;
    const columns = child[2].split(",");
    const parentColumns = parent[2].split(",");
    const join = columns.map((column, i) => `c."${column}" = p."${parentColumns[i]}"`).join(" AND ");
    const [row] = await tx.$queryRawUnsafe<Array<{ count: number }>>(`SELECT count(*)::integer AS count FROM public."${child[1]}" c JOIN public."${parent[1]}" p ON ${join} WHERE (${deletionCondition(parentOperation, "p")}) AND NOT (${deletionCondition(childOperation, "c")})`);
    if (row.count) blocked.push(`${row.count} retained ${child[1]} records reference selected ${parent[1]}. Explicitly include their reset category or preserve ${parent[1]}; references will not be cascaded or cleared.`);
  }
  return blocked;
}

function deletionCondition(operation: ResetOperation | undefined, alias: string): string {
  if (!operation) return "FALSE";
  if (operation.filter === "global") return `${alias}.season_id IS NULL`;
  if (operation.filter === "seasonal") return `${alias}.season_id IS NOT NULL`;
  if (operation.filter === "seasonalSessions") return `${alias}.season_id IS NOT NULL OR ${alias}.enrollment_id IS NOT NULL OR ${alias}.schedule_pattern_id IS NOT NULL`;
  return "TRUE";
}

// Eligibility and pricing snapshots have logical dependencies without FKs.
// Keep historical records intact as well as active ones: deleting eligibility
// can make a later edit fail its teacher guard. Do not guess a replacement.
async function eligibilityBlockers(tx: Tx, plan: ResetOperation[]) {
  const blocked: string[] = [];
  const operation = (model: ResetModel) => plan.find(row => row.model === model);
  const check = async (model: ResetModel, target: ResetModel, join: string, message: string) => {
    const removed = operation(model);
    if (!removed || operation(target)?.filter === "all") return;
    const [row] = await tx.$queryRawUnsafe<Array<{ count: number }>>(`SELECT count(DISTINCT r.id)::integer AS count FROM public."${resetTables[target]}" r JOIN public."${resetTables[model]}" d ON ${join} WHERE (${deletionCondition(removed, "d")}) AND NOT (${deletionCondition(operation(target), "r")})`);
    if (row.count) blocked.push(`${row.count} retained ${resetTables[target]} records ${message}. Include their category explicitly or preserve the supporting configuration.`);
  };
  await check("coursePricing", "enrollment", "r.pricing_source_id = d.id", "retain the selected pricing source and historical pricing snapshot");
  await check("teacherAvailability", "enrollment", "r.teacher_id = d.teacher_id AND (d.course_id IS NULL OR r.course_id = d.course_id OR r.course_id IS NULL) AND (d.season_id IS NULL OR r.season_id = d.season_id)", "may depend on the selected teacher availability");
  await check("teacherAvailability", "scheduleSession", "r.teacher_id = d.teacher_id AND (d.season_id IS NULL OR r.season_id = d.season_id OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = r.enrollment_id AND e.season_id = d.season_id))", "may depend on the selected teacher availability");
  await check("teacherAvailability", "schedulePattern", "r.teacher_id = d.teacher_id", "may generate lessons using the selected teacher availability");
  await check("teacherCourse", "teacherAvailability", "r.teacher_id = d.teacher_id AND (r.course_id IS NULL OR r.course_id = d.course_id)", "may depend on the selected teacher-course assignments");
  await check("teacherCourse", "enrollment", "r.teacher_id = d.teacher_id AND (r.course_id IS NULL OR r.course_id = d.course_id)", "may depend on the selected teacher-course assignments");
  await check("teacherCourse", "schedulePattern", "r.teacher_id = d.teacher_id", "may generate lessons using the selected teacher-course assignments");
  // Standalone/imported lessons have no enrollment/course relation. Preserve
  // their teacher eligibility conservatively rather than infer it from labels.
  await check("teacherCourse", "scheduleSession", "r.teacher_id = d.teacher_id", "may depend on the selected teacher-course assignments");
  return blocked;
}
