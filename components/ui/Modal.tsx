"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

const WIDTHS = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-xl", xl: "sm:max-w-4xl" };

/**
 * Bottom sheet on phones, centered dialog on bigger screens.
 * Footer stays visible while the body scrolls.
 */
export default function Modal({
  open, onClose, title, subtitle, children, footer, size = "md", icon,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof WIDTHS;
  icon?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="animate-fade fixed inset-0 z-[90] flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`animate-sheet flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-line bg-panel sm:rounded-xl ${WIDTHS[size]}`}
        style={{ boxShadow: "var(--shadow-lg)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line sm:hidden" />
        <div className="flex items-start gap-2.5 px-4 pt-3 pb-2.5 sm:px-5 sm:pt-4">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 className="text-base leading-tight font-bold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <button className="icon-btn -mt-1 -mr-2" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-2.5 sm:px-5">{footer}</div>}
      </div>
    </div>
  );
}
