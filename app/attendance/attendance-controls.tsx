"use client";

import { useState } from "react";

export function AttendanceControls({ scheduled, finalized, locked }: { scheduled: number; finalized: number; locked: number }) {
  const [confirmAll, setConfirmAll] = useState(false);
  function toggle(checked: boolean) { document.querySelectorAll<HTMLInputElement>('input[name="sessionIds"]:not(:disabled)').forEach((input) => { input.checked = checked; }); }
  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" className="rounded-xl border px-3 py-2 text-sm font-bold" onClick={() => toggle(true)}>Select all visible</button>
    <button type="button" className="rounded-xl border px-3 py-2 text-sm font-bold" onClick={() => toggle(false)}>Clear selection</button>
    <button type="button" className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-bold text-white" onClick={() => { toggle(true); setConfirmAll(true); }}>Mark all scheduled as completed</button>
    {confirmAll ? <div role="alert" className="w-full rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm"><b>Confirm daily attendance</b><p>{scheduled} scheduled lessons will be marked completed. {finalized} lessons are already finalized. {locked} lessons are payroll-locked and will not be changed.</p><label className="mt-2 flex items-center gap-2 font-bold"><input required type="checkbox"/> I confirm these changes</label></div> : null}
  </div>;
}
