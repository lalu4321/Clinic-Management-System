import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Unified Textarea component.
 * – With `label` prop: renders label + textarea + optional error message.
 * – Without `label` prop: renders a bare <textarea> (shadcn-compatible).
 */
const Textarea = React.forwardRef(function Textarea(
  { label, error, required, className, rows = 3, ...props },
  ref
) {
  const inputId = props.id || props.name;

  const textareaEl = (
    <textarea
      id={inputId}
      ref={ref}
      rows={rows}
      required={required}
      className={cn(
        "flex w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors",
        "placeholder:text-muted-foreground resize-none",
        "focus-visible:outline-none focus-visible:ring-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error
          ? "border-red-400 focus-visible:ring-red-400"
          : "border-slate-300 focus-visible:ring-blue-400",
        className
      )}
      {...props}
    />
  );

  if (!label && !error) return textareaEl;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-slate-700"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {textareaEl}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
});

Textarea.displayName = "Textarea";
export default Textarea;
