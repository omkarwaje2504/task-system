"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { dismissToast, subscribeToasts, type Toast } from "@/lib/toast";

const STYLES = {
  success: { icon: CircleCheck, cls: "text-accent" },
  error: { icon: TriangleAlert, cls: "text-danger" },
  info: { icon: Info, cls: "text-accent" },
};

export default function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[120] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end">
      {toasts.map((t) => {
        const { icon: Icon, cls } = STYLES[t.type];
        return (
          <div
            key={t.id}
            role="status"
            className="animate-pop pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[13px] font-medium"
            style={{ boxShadow: "var(--shadow-lg)" }}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} />
            <span className="flex-1">{t.message}</span>
            <button className="text-muted hover:text-fg" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
