import Link from "next/link";
import { archiveRoom, restoreRoom, saveRoom } from "@/actions/records";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { AppShell, DataTable, PageHeader, StatusBadge, StatusTabs, getStatusFilter, type RecordStatusFilter } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { NotAuthorized } from "@/lib/auth/not-authorized";
import { prisma } from "@/lib/prisma";

type Params = { status?: string; editId?: string };
const hrefFor = (status: RecordStatusFilter) => status === "active" ? "/rooms" : `/rooms?status=${status}`;

export default async function RoomsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireSession();
  if (session.role !== "ADMIN") return <NotAuthorized session={session} />;
  const params = await searchParams;
  const status = getStatusFilter(params.status);
  const where = status === "active" ? { status: "ACTIVE" as const } : status === "archived" ? { status: "ARCHIVED" as const } : {};
  const [rooms, editRoom] = await Promise.all([
    prisma.room.findMany({ where, orderBy: { name: "asc" } }),
    params.editId ? prisma.room.findUnique({ where: { id: params.editId } }) : Promise.resolve(null),
  ]);
  return <AppShell session={session}><PageHeader title="Rooms" description="Manage lesson rooms used by optional schedule bookings." action={<Link className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white" href="/schedule#session-form">Book lesson</Link>} /><StatusTabs value={status} hrefFor={hrefFor} /><form action={saveRoom} className="my-6 grid gap-3 rounded-[1.5rem] border bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5">{editRoom ? <input type="hidden" name="id" value={editRoom.id} /> : null}<input name="name" required placeholder="Room name" defaultValue={editRoom?.name ?? ""} className="rounded-xl border p-2.5"/><input name="capacity" type="number" min="1" placeholder="Capacity" defaultValue={editRoom?.capacity ?? ""} className="rounded-xl border p-2.5"/><input name="description" placeholder="Description" defaultValue={editRoom?.description ?? ""} className="rounded-xl border p-2.5 lg:col-span-2"/><select name="status" defaultValue={editRoom?.status ?? "ACTIVE"} className="rounded-xl border p-2.5"><option>ACTIVE</option><option>ARCHIVED</option></select><button className="rounded-xl bg-primary px-4 py-2.5 font-bold text-white">{editRoom ? "Update room" : "Add room"}</button></form><DataTable><thead><tr><th>Name</th><th>Capacity</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rooms.map((room) => <tr key={room.id}><td className="font-bold">{room.name}</td><td>{room.capacity ?? "—"}</td><td>{room.description ?? "—"}</td><td><StatusBadge status={room.status}/></td><td className="flex gap-3"><Link className="text-primary" href={`/rooms?editId=${room.id}`}>Edit</Link>{room.status === "ACTIVE" ? <form action={archiveRoom}><input type="hidden" name="id" value={room.id}/><ConfirmSubmitButton className="text-primary" message="Archive this room?">Archive</ConfirmSubmitButton></form> : <form action={restoreRoom}><input type="hidden" name="id" value={room.id}/><ConfirmSubmitButton className="text-primary" message="Restore this room?">Restore</ConfirmSubmitButton></form>}</td></tr>)}</tbody></DataTable></AppShell>;
}
