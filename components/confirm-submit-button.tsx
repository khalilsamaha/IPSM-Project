"use client";

import { useId, useState, type ButtonHTMLAttributes } from "react";

type ConfirmSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  message: string;
};

export function ConfirmSubmitButton({ message, onClick, children, ...props }: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const [pendingForm, setPendingForm] = useState<HTMLFormElement | null>(null);
  const descriptionId = useId();

  return (
    <>
      <button
        {...props}
        type="button"
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) {
            setPendingForm(event.currentTarget.form);
            setOpen(true);
          }
        }}
      >
        {children}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation">
          <div aria-describedby={descriptionId} aria-modal="true" className="w-full max-w-md rounded-[1.5rem] border border-border bg-white p-5 text-slate-950 shadow-2xl" role="dialog">
            <p className="text-lg font-bold">Confirm action</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground" id={descriptionId}>{message}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button className="btn-secondary" onClick={() => setOpen(false)} type="button">Cancel</button>
              <button className="btn-primary" onClick={() => { setOpen(false); pendingForm?.requestSubmit(); }} type="button">Confirm</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
