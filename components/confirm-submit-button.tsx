"use client";

import type { ButtonHTMLAttributes } from "react";

type ConfirmSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  message: string;
};

export function ConfirmSubmitButton({ message, onClick, ...props }: ConfirmSubmitButtonProps) {
  return (
    <button
      {...props}
      type={props.type ?? "submit"}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && ! window.confirm(message)) {
          event.preventDefault();
        }
      }}
    />
  );
}
