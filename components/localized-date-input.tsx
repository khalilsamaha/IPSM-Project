"use client";

import { useEffect, useId, useState } from "react";
import {
  displayDateFromIso,
  parseDisplayDate,
  type LocalizedDateFormat,
} from "@/lib/date-time";

type Props = {
  name: string;
  defaultValue?: string;
  value?: string;
  label?: string;
  required?: boolean;
  className?: string;
  onChange?: (iso: string) => void;
  displayFormat?: LocalizedDateFormat;
  min?: string;
  max?: string;
  disabled?: boolean;
  helpText?: string;
};

export function LocalizedDateInput({
  name,
  defaultValue = "",
  value,
  label,
  required = false,
  className = "input",
  onChange,
  displayFormat = "dd/mm/yy",
  min,
  max,
  disabled = false,
  helpText,
}: Props) {
  const id = useId();
  const controlledValue = value ?? defaultValue;
  const [visible, setVisible] = useState(() =>
    controlledValue ? displayDateFromIso(controlledValue, displayFormat) : "",
  );
  const [iso, setIso] = useState(controlledValue);
  const [error, setError] = useState("");

  useEffect(() => {
    if (value === undefined) return;
    setIso(value);
    setVisible(value ? displayDateFromIso(value, displayFormat) : "");
    setError("");
  }, [value, displayFormat]);

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
      if (min && next < min) {
        throw new Error(
          `Date must be on or after ${displayDateFromIso(min, displayFormat)}.`,
        );
      }
      if (max && next > max) {
        throw new Error(
          `Date must be on or before ${displayDateFromIso(max, displayFormat)}.`,
        );
      }
      update(next);
      setVisible(displayDateFromIso(next, displayFormat));
      setError("");
    } catch (caught) {
      update("");
      setError(caught instanceof Error ? caught.message : "Invalid date.");
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
        disabled={disabled}
        onChange={(event) => setVisible(event.target.value)}
        onBlur={validate}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : helpText ? `${id}-help` : undefined}
      />
      <input type="hidden" name={name} value={iso} disabled={disabled} />
      {helpText ? (
        <p id={`${id}-help`} className="mt-1 text-xs text-slate-500">
          {helpText}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
