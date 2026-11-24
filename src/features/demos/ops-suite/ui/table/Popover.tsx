"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Minimal anchored popover: toggled by its trigger, closes on outside pointer-down or Escape,
 * moves focus into the panel on open and back to the trigger on close.
 */
export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  align = "start",
  label,
  className = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: (props: { "aria-expanded": boolean; "aria-controls": string; onClick: () => void }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  label: string;
  className?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) root.current?.querySelector<HTMLElement>("[aria-controls]")?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const first = panel.current?.querySelector<HTMLElement>("[data-autofocus], input, select, button, [tabindex]:not([tabindex='-1'])");
    first?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onOpenChange(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div className="ops-pop" ref={root}>
      {trigger({ "aria-expanded": open, "aria-controls": id, onClick: () => onOpenChange(!open) })}
      {open && (
        <div id={id} ref={panel} role="dialog" aria-label={label} className={`ops-pop-panel is-${align} ${className}`}>
          {children}
        </div>
      )}
    </div>
  );
}
