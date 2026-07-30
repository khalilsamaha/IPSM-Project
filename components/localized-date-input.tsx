"use client";
import { useId, useState } from "react";
import { displayDateFromIso, parseDisplayDate, type LocalizedDateFormat } from "@/lib/date-time";

type Props = {
  name: string;
  defaultValue?: string;
  label?: string;
  required?: boolean;
  className?: string;
  onChange?: (iso: string) => void;
  displayFormat?: LocalizedDateFormat;
};
export function LocalizedDateInput({
  name,
  defaultValue = "",
  label,
  required = false,
  className = "input",
  onChange,
  displayFormat = "dd/mm/yy",
}: Props) {
  const id = useId(),
    [visible, setVisible] = useState(() =>
      defaultValue ? displayDateFromIso(defaultValue, displayFormat) : "",
    ),
    [iso, setIso] = useState(defaultValue),
    [error, setError] = useState("");
  function update(next: string) {
    setIso(next);
    onChange?.(next);
  }
  function validate() {
    if (!visible.trim()) {
      update("");
      setError(required ? "A date is required." : "");
      return;
    }
    try {
      const next = parseDisplayDate(visible, displayFormat);
      update(next);
      setVisible(displayDateFromIso(next, displayFormat));
      setError("");
    } catch (e) {
      update("");
      setError(e instanceof Error ? e.message : "Invalid date.");
    }
  }
  return (
    <div>
      {label ? (
        <label className="mb-1 block text-sm font-bold" htmlFor={id}>
          {label}
          {required ? " *" : ""}
          <span className="ml-2 text-xs font-normal text-slate-500">
            {required ? "Required" : "Optional"}
          </span>
        </label>
      ) : null}
      <input
        id={id}
        className={className}
        inputMode="numeric"
        placeholder={displayFormat}
        value={visible}
        onChange={(e) => setVisible(e.target.value)}
        onBlur={validate}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <input type="hidden" name={name} value={iso} />
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
