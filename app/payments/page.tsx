import Link from "next/link";
import { generateMissingReceiptNumber } from "@/actions/records";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ShareReceiptButton } from "@/components/share-receipt-button";
import {
  AppShell,
  Pager,
  StatusBadge,
  EmptyState,
  DataTable,
} from "@/components/records/shell";
import { hasPermission } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/records/format";
import {
  formatPaymentMethod,
  paymentMethodLabels,
} from "@/lib/payment-methods";
import { getPagination } from "@/lib/records/pagination";

type Params = {
  receiptNumber?: string;
  family?: string;
  student?: string;
  studentCode?: string;
  page?: string;
  familyId?: string;
  seasonId?: string;
  paymentMethod?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

function mailto(payment: {
  receiptNumber: string | null;
  family: { name: string; email: string | null };
  paymentDate: Date;
  totalAmountCents: number;
}) {
  const subject = `Receipt ${payment.receiptNumber ?? "Pending"} - IPSM Music School`;
  const body = [
    `Hello ${payment.family.name},`,
    "",
    `Receipt number: ${payment.receiptNumber ?? "Missing receipt number"}`,
    `Payment date: ${formatDate(payment.paymentDate)}`,
    `Amount: ${formatCurrency(payment.totalAmountCents)}`,
    "",
    "Thank you,",
    "IPSM Music School",
  ].join("\n");
  return `mailto:${encodeURIComponent(payment.family.email ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const session = await requireSession();
  const isAdmin = hasPermission(session.role, "finance:delete");
  const { page, skip, take } = getPagination(params);

  const where = {
    AND: [
      params.receiptNumber
        ? {
            receiptNumber: {
              contains: params.receiptNumber,
              mode: "insensitive" as const,
            },
          }
        : {},
      params.family
        ? {
            OR: [
              {
                family: {
                  name: {
                    contains: params.family,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                student: {
                  OR: [
                    {
                      firstName: {
                        contains: params.family,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      lastName: {
                        contains: params.family,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      studentCode: {
                        contains: params.family,
                        mode: "insensitive" as const,
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {},
      params.familyId ? { familyId: params.familyId } : {},
      params.student
        ? {
            items: {
              some: {
                enrollment: {
                  student: {
                    OR: [
                      {
                        firstName: {
                          contains: params.student,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        lastName: {
                          contains: params.student,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  },
                },
              },
            },
          }
        : {},
      params.studentCode
        ? {
            items: {
              some: {
                enrollment: {
                  student: {
                    studentCode: {
                      contains: params.studentCode,
                      mode: "insensitive" as const,
                    },
                  },
                },
              },
            },
          }
        : {},
      params.paymentMethod ? { paymentMethod: params.paymentMethod } : {},
      params.status === "posted"
        ? { voidedAt: null }
        : params.status === "voided"
          ? { voidedAt: { not: null } }
          : {},
      params.dateFrom
        ? { paymentDate: { gte: new Date(params.dateFrom) } }
        : {},
      params.dateTo ? { paymentDate: { lte: new Date(params.dateTo) } } : {},
      params.seasonId
        ? {
            items: {
              some: { enrollment: { seasonId: params.seasonId } },
            },
          }
        : {},
    ],
  };

  const [rows, total, families, seasons, summaryRows] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        family: true,
        items: {
          include: {
            enrollment: { include: { season: true, student: true } },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
      skip,
      take,
    }),
    prisma.payment.count({ where }),
    prisma.family.findMany({ orderBy: { name: "asc" } }),
    prisma.season.findMany({ orderBy: { startDate: "desc" } }),
    prisma.payment.findMany({
      where,
      select: {
        paymentDate: true,
        paymentMethod: true,
        totalAmountCents: true,
        voidedAt: true,
      },
    }),
  ]);

  const postedRows = summaryRows.filter((payment) => !payment.voidedAt);
  const postedTotal = postedRows.reduce(
    (sum, payment) => sum + payment.totalAmountCents,
    0,
  );
  const cashTotal = postedRows
    .filter((payment) => payment.paymentMethod === "cash")
    .reduce((sum, payment) => sum + payment.totalAmountCents, 0);
  const whishTotal = postedRows
    .filter((payment) => payment.paymentMethod === "whish")
    .reduce((sum, payment) => sum + payment.totalAmountCents, 0);
  const voidedTotal = summaryRows
    .filter((payment) => payment.voidedAt)
    .reduce((sum, payment) => sum + payment.totalAmountCents, 0);

  const daily = Array.from(
    postedRows
      .reduce(
        (map, payment) => {
          const key = payment.paymentDate.toISOString().slice(0, 10);
          const row = map.get(key) ?? {
            date: key,
            cash: 0,
            whish: 0,
            total: 0,
            count: 0,
          };
          if (payment.paymentMethod === "cash") {
            row.cash += payment.totalAmountCents;
          }
          if (payment.paymentMethod === "whish") {
            row.whish += payment.totalAmountCents;
          }
          row.total += payment.totalAmountCents;
          row.count += 1;
          map.set(key, row);
          return map;
        },
        new Map<
          string,
          { date: string; cash: number; whish: number; total: number; count: number }
        >(),
      )
      .values(),
  ).sort((a, b) => b.date.localeCompare(a.date));

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  )
    .toISOString()
    .slice(0, 10);
  const weekStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - now.getUTCDay(),
    ),
  )
    .toISOString()
    .slice(0, 10);
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);

  const hrefFor = (targetPage: number) => {
    const next = new URLSearchParams();
    for (const key of [
      "receiptNumber",
      "family",
      "student",
      "studentCode",
      "familyId",
      "seasonId",
      "paymentMethod",
      "status",
      "dateFrom",
      "dateTo",
    ] as const) {
      if (params[key]) next.set(key, params[key]!);
    }
    if (targetPage > 1) next.set("page", String(targetPage));
    return next.toString() ? `/payments?${next}` : "/payments";
  };

  return (
    <AppShell session={session}>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold">Payments</h2>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded border px-4 py-2" href="/payments/allocation">
            Allocation view
          </Link>
          <Link className="rounded bg-primary px-4 py-2 text-white" href="/payments/new">
            Create payment
          </Link>
        </div>
      </div>

      <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["Posted total", postedTotal],
          ["Cash total", cashTotal],
          ["Whish total", whishTotal],
          ["Posted transactions", postedRows.length],
          ["Voided total", voidedTotal],
          ["Net collected", postedTotal],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-4">
            <p className="text-xs uppercase text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">
              {typeof value === "number" && label !== "Posted transactions"
                ? formatCurrency(value)
                : value}
            </p>
          </div>
        ))}
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link className="rounded border px-3 py-2 text-sm" href={`/payments?dateFrom=${today}&dateTo=${today}`}>
          Today
        </Link>
        <Link className="rounded border px-3 py-2 text-sm" href={`/payments?dateFrom=${yesterday}&dateTo=${yesterday}`}>
          Yesterday
        </Link>
        <Link className="rounded border px-3 py-2 text-sm" href={`/payments?dateFrom=${weekStart}`}>
          This week
        </Link>
        <Link className="rounded border px-3 py-2 text-sm" href={`/payments?dateFrom=${monthStart}`}>
          This month
        </Link>
      </div>

      <form className="mb-4 grid gap-2 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <input className="rounded border p-2" name="receiptNumber" placeholder="Receipt number" defaultValue={params.receiptNumber} />
        <input className="rounded border p-2" name="family" placeholder="Family / Group" defaultValue={params.family} />
        <input className="rounded border p-2" name="student" placeholder="Student name" defaultValue={params.student} />
        <input className="rounded border p-2" name="studentCode" placeholder="Student ID" defaultValue={params.studentCode} />
        <select name="paymentMethod" className="rounded border p-2" defaultValue={params.paymentMethod ?? ""}>
          <option value="">All methods</option>
          {Object.entries(paymentMethodLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select name="status" className="rounded border p-2" defaultValue={params.status ?? "all"}>
          <option value="all">All statuses</option>
          <option value="posted">Posted</option>
          <option value="voided">Voided</option>
        </select>
        <select name="seasonId" className="rounded border p-2" defaultValue={params.seasonId ?? ""}>
          <option value="">All seasons</option>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>{season.name}</option>
          ))}
        </select>
        <select name="familyId" className="rounded border p-2" defaultValue={params.familyId ?? ""}>
          <option value="">All families</option>
          {families.map((family) => (
            <option key={family.id} value={family.id}>
              {family.familyCode} — {family.name}
            </option>
          ))}
        </select>
        <input className="rounded border p-2" type="date" name="dateFrom" defaultValue={params.dateFrom} />
        <input className="rounded border p-2" type="date" name="dateTo" defaultValue={params.dateTo} />
        <button className="rounded bg-primary px-4 py-2 text-white md:col-span-2">
          Apply filters
        </button>
      </form>

      {rows.length ? (
        <DataTable>
          <thead>
            <tr>
              <th>Receipt No.</th>
              <th>Payer</th>
              <th>Student(s)</th>
              <th>Season(s)</th>
              <th>Payment Date</th>
              <th>Method</th>
              <th>Allocations</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((payment) => {
              const students = Array.from(
                new Set(
                  payment.items.map(
                    (item) =>
                      `${item.enrollment.student.firstName} ${item.enrollment.student.lastName} (${item.enrollment.student.studentCode})`,
                  ),
                ),
              );
              const paymentSeasons = Array.from(
                new Set(payment.items.map((item) => item.enrollment.season.name)),
              );
              const familyPhone =
                payment.family.phone ??
                payment.family.fatherPhone ??
                payment.family.motherPhone ??
                null;

              return (
                <tr key={payment.id}>
                  <td className="font-medium">
                    {payment.receiptNumber ?? (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                        Missing receipt number
                      </span>
                    )}
                  </td>
                  <td>{`${payment.family.familyCode} — ${payment.family.name}`}</td>
                  <td>{students.join(", ") || "—"}</td>
                  <td>{paymentSeasons.join(", ") || "—"}</td>
                  <td>{formatDate(payment.paymentDate)}</td>
                  <td>{formatPaymentMethod(payment.paymentMethod)}</td>
                  <td>
                    {payment.items.length ? (
                      `${payment.items.length} / ${formatCurrency(
                        payment.items.reduce(
                          (sum, item) => sum + item.amountCents,
                          0,
                        ),
                      )}`
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                        No allocations
                      </span>
                    )}
                  </td>
                  <td>{formatCurrency(payment.totalAmountCents)}</td>
                  <td>
                    <StatusBadge status={payment.voidedAt ? "Voided" : "Posted"} />
                  </td>
                  <td className="flex min-w-64 flex-wrap gap-2">
                    <Link className="text-primary" href={`/payments/${payment.id}`}>
                      View
                    </Link>
                    <a className="text-primary" href={`/api/receipts/${payment.id}`}>
                      Download receipt
                    </a>
                    {payment.family.email ? (
                      <a className="text-primary" href={mailto(payment)}>
                        Email receipt
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Add email to send
                      </span>
                    )}
                    {payment.receiptNumber ? (
                      <ShareReceiptButton
                        paymentId={payment.id}
                        receiptNumber={payment.receiptNumber}
                        familyName={payment.family.name}
                        amount={formatCurrency(payment.totalAmountCents)}
                        phone={familyPhone}
                      />
                    ) : null}
                    {isAdmin && !payment.voidedAt ? (
                      <Link className="text-red-700" href={`/payments/${payment.id}`}>
                        Void
                      </Link>
                    ) : null}
                    {isAdmin && !payment.receiptNumber ? (
                      <form className="inline" action={generateMissingReceiptNumber}>
                        <input type="hidden" name="id" value={payment.id} />
                        <ConfirmSubmitButton
                          className="text-primary"
                          message="Generate a receipt number for this payment?"
                        >
                          Generate receipt number
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState title="No payments found for the selected filters." />
      )}

      <h3 className="my-2 text-lg font-bold">Daily breakdown</h3>
      <DataTable>
        <thead>
          <tr>
            <th>Date</th>
            <th>Cash</th>
            <th>Whish</th>
            <th>Total</th>
            <th>Transactions</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((day) => (
            <tr key={day.date}>
              <td>{formatDate(day.date)}</td>
              <td>{formatCurrency(day.cash)}</td>
              <td>{formatCurrency(day.whish)}</td>
              <td>{formatCurrency(day.total)}</td>
              <td>{day.count}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <Pager page={page} total={total} hrefFor={hrefFor} />
    </AppShell>
  );
}
