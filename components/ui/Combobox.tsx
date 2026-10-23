"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Plus } from "lucide-react";
import FloatingPanel from "./Floating";

export type ComboOption = { value: string; label: string; hint?: string; icon?: ReactNode };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Type-to-search input. Suggests existing options as you type; free text is
 * allowed (shown as "new"), so nobody is ever blocked — but the matching
 * suggestions make it easy to pick the existing one instead of a duplicate.
 */
export default function Combobox({
  value, onChange, onPick, options, placeholder, allowNew = true, newLabel = "New", autoFocus, icon,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick?: (o: ComboOption) => void;
  options: ComboOption[];
  placeholder?: string;
  allowNew?: boolean;
  newLabel?: string;
  autoFocus?: boolean;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = norm(value);
    const list = q ? options.filter((o) => norm(o.label).includes(q) || norm(o.hint || "").includes(q)) : options;
    // Best matches first: starts-with beats contains.
    return [...list].sort((a, b) => Number(norm(b.label).startsWith(q)) - Number(norm(a.label).startsWith(q))).slice(0, 8);
  }, [value, options]);

  const exact = options.find((o) => norm(o.label) === norm(value));

  useEffect(() => {
    // Suggestions render in <body> (FloatingPanel): clicks there are "inside" too.
    const close = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && !panel.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pick(o: ComboOption) {
    onChange(o.label);
    onPick?.(o);
    setOpen(false);
  }

  return (
    <div className="relative" ref={wrap}>
      {icon && <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      <input
        className={`input ${icon ? "!pl-8" : ""} ${value && !exact && allowNew ? "!pr-16" : ""}`}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, matches.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" && open && matches[hi]) { e.preventDefault(); pick(matches[hi]); }
          else if (e.key === "Escape" || e.key === "Tab") setOpen(false);
        }}
      />
      {value.trim() && !exact && allowNew && (
        <span className="chip pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 bg-accent-soft text-accent">
          <Plus className="h-3 w-3" />{newLabel}
        </span>
      )}
      {open && matches.length > 0 && (
        <FloatingPanel anchor={wrap} panelRef={panel} estHeight={250}>
          <ul className="max-h-60 min-h-0 overflow-y-auto">
            {matches.map((o, i) => (
              <li key={o.value}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[0.8125rem] ${i === hi ? "bg-panel2" : ""}`}
                  onMouseEnter={() => setHi(i)}
                  onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                >
                  {o.icon}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.label}</span>
                    {o.hint && <span className="block truncate text-[0.6875rem] text-muted">{o.hint}</span>}
                  </span>
                  {exact?.value === o.value && <Check className="h-4 w-4 text-accent" />}
                </button>
              </li>
            ))}
          </ul>
        </FloatingPanel>
      )}
    </div>
  );
}
