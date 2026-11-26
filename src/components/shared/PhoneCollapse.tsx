"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ScrollTrigger } from "@/lib/motion";
import { sound } from "@/lib/sound";

/**
 * Phones only (≤767px): shows the first part of long content with a soft fade and a "Read more" button.
 * On larger screens it renders the content as is (the button is hidden by CSS).
 * Toggling re-measures ScrollTrigger, since scroll-driven effects below depend on the page height.
 */
export function PhoneCollapse({
  children,
  more = "Read more",
  less = "Show less",
  className = "",
}: {
  children: React.ReactNode;
  more?: string;
  less?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    sound().tap();
    // Closing from far down: bring the block's top back into view so the reader isn't lost.
    if (!next && root.current && root.current.getBoundingClientRect().top < 0)
      root.current.scrollIntoView({ block: "start", behavior: "smooth" });
    requestAnimationFrame(() => requestAnimationFrame(() => ScrollTrigger.refresh()));
  };

  return (
    <div ref={root} className={`phone-collapse ${open ? "is-open" : ""} ${className}`.trim()}>
      <div className="pc-inner" id={id}>
        {children}
      </div>
      <button type="button" className="pc-toggle" aria-expanded={open} aria-controls={id} onClick={toggle}>
        {open ? less : more}
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
