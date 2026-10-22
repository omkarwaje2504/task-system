"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, Inbox } from "lucide-react";
import { daysUntil, fmtDate } from "@/lib/client";

// ---- Avatar ----------------------------------------------------------------

export function initials(name = "") {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

const AV_SIZES = { xs: "h-5 w-5 text-[9px]", sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-[11px]", lg: "h-10 w-10 text-sm" };

export function Avatar({ name, size = "sm", className = "" }: { name?: string; size?: keyof typeof AV_SIZES; className?: string }) {
  return (
    <span title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-panel2 font-bold text-fg ring-2 ring-panel ${AV_SIZES[size]} ${className}`}>
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 3, size = "sm" }: { names: string[]; max?: number; size?: keyof typeof AV_SIZES }) {
  if (!names.length) return null;
  return (
    <span className="flex -space-x-1.5">
      {names.slice(0, max).map((n, i) => <Avatar key={i} name={n} size={size} />)}
      {names.length > max && (
        <span className={`inline-flex items-center justify-center rounded-full bg-panel2 font-bold text-muted ring-2 ring-panel ${AV_SIZES[size]}`}>
          +{names.length - max}
        </span>
      )}
    </span>
  );
}

/** Avatars + first names, for table cells. */
export function People({ names }: { names: string[] }) {
  if (!names.length) return <span className="text-muted">—</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <AvatarStack names={names} size="xs" />
      <span className="truncate text-xs text-muted">{names.map((n) => n.split(" ")[0]).join(", ")}</span>
    </span>
  );
}

// ---- Page header -------------------------------------------------------------

export function PageHeader({ title, subtitle, icon, actions }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon}
        <div className="min-w-0">
          <h1 className="truncate text-lg leading-tight font-extrabold tracking-tight sm:text-xl">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-1.5">{actions}</div>}
    </div>
  );
}

/** Small accent square used as a page icon. */
export function PageIcon({ children }: { children: ReactNode }) {
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent [&>svg]:h-5 [&>svg]:w-5">{children}</span>;
}

// ---- Empty state --------------------------------------------------------------

export function EmptyState({ title, hint, action, icon }: { title: string; hint?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent [&>svg]:h-5 [&>svg]:w-5">
        {icon || <Inbox />}
      </div>
      <p className="text-sm font-bold">{title}</p>
      {hint && <p className="mt-0.5 max-w-sm text-xs text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---- Skeletons ----------------------------------------------------------------

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-panel2 ${className}`} />;
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="card space-y-2 !p-3">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-8" />)}
    </div>
  );
}

// ---- Progress -----------------------------------------------------------------

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-panel2 ${className}`}>
      <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function ProgressRing({ value, size = 40 }: { value: number; size?: number }) {
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--panel-2)" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth="4"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, value)) / 100} className="transition-all duration-500" />
      </svg>
      <span className="absolute text-[10px] font-bold">{value}%</span>
    </span>
  );
}

// ---- Deadline -----------------------------------------------------------------

/** Red only when overdue; accent when it's close; plain otherwise. */
export function DeadlineBadge({ date, done = false }: { date: string | null | undefined; done?: boolean }) {
  if (!date) return null;
  const d = daysUntil(date);
  let cls = "bg-panel2 text-muted";
  let label = fmtDate(date);
  if (!done) {
    if (d < 0) { cls = "bg-danger/10 text-danger"; label = `${-d}d overdue`; }
    else if (d === 0) { cls = "bg-accent-soft text-accent"; label = "Due today"; }
    else if (d === 1) { cls = "bg-accent-soft text-accent"; label = "Tomorrow"; }
    else if (d <= 7) { cls = "bg-accent-soft text-accent"; label = `In ${d} days`; }
  }
  return (
    <span className={`chip ${cls}`} title={fmtDate(date, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}>
      <CalendarClock className="h-3 w-3" />
      {label}
    </span>
  );
}

// ---- Tabs (scrollable on phones) ------------------------------------------------

export type TabItem = { key: string; label: ReactNode; href?: string; count?: number; icon?: ReactNode };

export function Tabs({ items, active, onChange }: { items: TabItem[]; active: string; onChange?: (k: string) => void }) {
  return (
    <div className="no-scrollbar -mx-3 mb-3 flex gap-1 overflow-x-auto border-b border-line px-3 sm:mx-0 sm:px-0">
      {items.map((t) => {
        const on = t.key === active;
        const cls = `-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-[13px] font-semibold transition-colors ${
          on ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg"
        }`;
        const inner = (
          <>
            {t.icon}
            {t.label}
            {t.count !== undefined && <span className="rounded bg-panel2 px-1 text-[10px] text-muted">{t.count}</span>}
          </>
        );
        return t.href
          ? <Link key={t.key} href={t.href} className={cls}>{inner}</Link>
          : <button key={t.key} className={cls} onClick={() => onChange?.(t.key)}>{inner}</button>;
      })}
    </div>
  );
}

/** Small segmented control, e.g. status filters. */
export function Segmented<T extends string>({ items, value, onChange }: { items: { key: T; label: ReactNode }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="no-scrollbar flex shrink-0 gap-0.5 overflow-x-auto rounded-lg border border-line bg-panel p-0.5">
      {items.map((s) => (
        <button key={s.key} onClick={() => onChange(s.key)}
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${value === s.key ? "bg-accent-soft text-accent" : "text-muted hover:text-fg"}`}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ---- Search box ----------------------------------------------------------------

export function SearchInput({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:max-w-64">
      <svg className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input className="input !pl-8" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ---- Form field ------------------------------------------------------------------

export function Field({ label, help, children, optional }: { label: ReactNode; help?: ReactNode; children: ReactNode; optional?: boolean }) {
  return (
    <div className="mb-3">
      <label className="label">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {help && <p className="help">{help}</p>}
    </div>
  );
}

// ---- Sortable tables ---------------------------------------------------------------

export type Sort = { key: string; dir: "asc" | "desc" } | null;

/** Click a header: ascending → descending → off. Empty values always sort last. */
export function useSort<T>(rows: T[], getters: Record<string, (r: T) => string | number | null | undefined>, initial: Sort = null) {
  const [sort, setSort] = useState<Sort>(initial);
  const sorted = useMemo(() => {
    if (!sort || !getters[sort.key]) return rows;
    const get = getters[sort.key];
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x == null || x === "") return 1;
      if (y == null || y === "") return -1;
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" });
      return sort.dir === "asc" ? c : -c;
    });
    // getters is a fresh object each render; the sort key and rows are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  const toggle = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
  return { sorted, sort, toggle };
}

export function SortTh({ label, k, sort, onSort, className = "" }: { label: string; k: string; sort: Sort; onSort: (k: string) => void; className?: string }) {
  const Icon = sort?.key !== k ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={className} aria-sort={sort?.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 uppercase hover:text-fg ${sort?.key === k ? "text-accent" : ""}`}>
        {label}
        <Icon className={`h-3 w-3 ${sort?.key === k ? "" : "opacity-40"}`} />
      </button>
    </th>
  );
}
