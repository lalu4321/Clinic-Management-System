import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Unified Input component.
 * – With `label` prop: renders label + input + optional error message.
 * – Without `label` prop: renders a bare <input> (shadcn-compatible for use
 *   inside other primitives like form builders).
 */
const Input = React.forwardRef(function Input(
  { label, error, required, className, type, ...props },
  ref
) {
  const inputId = props.id || props.name;

  const inputEl = (
    <input
      id={inputId}
      type={type}
      ref={ref}
      required={required}
      className={cn(
        "flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors",
        "placeholder:text-muted-foreground",
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

  if (!label && !error) return inputEl;

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
      {inputEl}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
});

Input.displayName = "Input";
export default Input;
