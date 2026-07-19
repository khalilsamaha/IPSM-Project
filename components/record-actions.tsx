import type { ReactNode } from "react";

export function RecordActions({ children }: { children: ReactNode }) {
  return <div className="flex max-w-[16rem] flex-wrap items-center gap-2 md:max-w-none" aria-label="Record actions">{children}</div>;
}

export const recordActionClass = {
  normal: "text-primary",
  archive: "text-amber-700",
  delete: "text-red-700",
  disabled: "cursor-not-allowed text-slate-400",
};

export function DisabledRecordAction({ children, reason }: { children: ReactNode; reason: string }) {
  return <span className={recordActionClass.disabled} title={reason} aria-disabled="true">{children}</span>;
}
