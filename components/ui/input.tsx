import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-primary",
        className,
      )}
      {...props}
    />
  );
}
