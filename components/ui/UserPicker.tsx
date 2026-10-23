"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Check, ChevronDown, UserRound, X } from "lucide-react";
import { useUsers } from "@/lib/client";
import { Avatar } from "./bits";
import FloatingPanel from "./Floating";

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // The list lives in <body> (FloatingPanel), so clicks inside it count as "inside" too.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return { open, setOpen, ref, panelRef };
}

function UserList({ selected, onToggle, query, setQuery, anchor, panelRef }: {
  selected: string[];
  onToggle: (id: string) => void;
  query: string;
  setQuery: (q: string) => void;
  anchor: RefObject<HTMLDivElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  const { data: users = [] } = useUsers();
  const list = useMemo(
    () => users.filter((u) => u.active !== false && u.name.toLowerCase().includes(query.toLowerCase())),
    [users, query],
  );
  return (
    <FloatingPanel anchor={anchor} panelRef={panelRef}>
      <input className="input mb-1 shrink-0" placeholder="Search people…" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} />
      <ul className="max-h-60 min-h-0 overflow-y-auto">
        {list.map((u) => (
          <li key={u._id}>
            <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.8125rem] hover:bg-panel2" onClick={() => onToggle(u._id)}>
              <Avatar name={u.name} size="xs" />
              <span className="flex-1 truncate">{u.name}</span>
              {u.team && <span className="text-[0.6875rem] text-muted">{u.team}</span>}
              {selected.includes(u._id) && <Check className="h-3.5 w-3.5 text-accent" />}
            </button>
          </li>
        ))}
        {!list.length && <li className="px-3 py-3 text-sm text-muted">Nobody found.</li>}
      </ul>
    </FloatingPanel>
  );
}

/** Pick one person (or nobody). */
export function UserSelect({ value, onChange, placeholder = "Assign someone", compact = false }: { value: string | null; onChange: (id: string | null) => void; placeholder?: string; compact?: boolean }) {
  const { data: users = [] } = useUsers();
  const { open, setOpen, ref, panelRef } = usePopover();
  const [q, setQ] = useState("");
  const user = users.find((u) => u._id === value);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)}
        className={`flex w-full items-center gap-1.5 rounded-lg border border-line bg-panel text-left text-[0.8125rem] hover:bg-panel2 ${compact ? "h-7 px-2" : "px-2.5 py-1.5"}`}>
        {user ? <Avatar name={user.name} size="xs" /> : <UserRound className="h-3.5 w-3.5 text-muted" />}
        <span className={`flex-1 truncate ${user ? "font-medium" : "text-muted"}`}>{user?.name || placeholder}</span>
        {user ? (
          <span role="button" tabIndex={0} aria-label="Remove" className="text-muted hover:text-danger"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}>
            <X className="h-3.5 w-3.5" />
          </span>
        ) : <ChevronDown className="h-3.5 w-3.5 text-muted" />}
      </button>
      {open && <UserList anchor={ref} panelRef={panelRef} selected={value ? [value] : []} query={q} setQuery={setQ} onToggle={(id) => { onChange(id === value ? null : id); setOpen(false); }} />}
    </div>
  );
}

/** Pick several people — shown as removable chips. */
export function UserMultiSelect({ value, onChange, placeholder = "Assign people" }: { value: string[]; onChange: (ids: string[]) => void; placeholder?: string }) {
  const { data: users = [] } = useUsers();
  const { open, setOpen, ref, panelRef } = usePopover();
  const [q, setQ] = useState("");
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="relative" ref={ref}>
      <div role="button" tabIndex={0} onClick={() => setOpen(!open)} onKeyDown={(e) => e.key === "Enter" && setOpen(!open)}
        className="flex min-h-[34px] w-full cursor-pointer flex-wrap items-center gap-1 rounded-lg border border-line bg-panel px-2 py-1 text-[0.8125rem] hover:bg-panel2">
        {value.length === 0 && <span className="flex items-center gap-1.5 px-0.5 text-muted"><UserRound className="h-3.5 w-3.5" />{placeholder}</span>}
        {value.map((id) => {
          const u = users.find((x) => x._id === id);
          return (
            <span key={id} className="flex items-center gap-1 rounded-full bg-panel2 py-0.5 pr-1.5 pl-0.5 text-[0.6875rem] font-semibold">
              <Avatar name={u?.name} size="xs" />
              {u?.name.split(" ")[0] || "…"}
              <span role="button" tabIndex={0} aria-label="Remove" className="text-muted hover:text-danger" onClick={(e) => { e.stopPropagation(); toggle(id); }}>
                <X className="h-3 w-3" />
              </span>
            </span>
          );
        })}
        <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted" />
      </div>
      {open && <UserList anchor={ref} panelRef={panelRef} selected={value} query={q} setQuery={setQ} onToggle={toggle} />}
    </div>
  );
}

/** Tiny helper: id → name. */
export function useUserName() {
  const { data: users = [] } = useUsers();
  const map = useMemo(() => new Map(users.map((u) => [u._id, u.name])), [users]);
  return (id?: string | null) => (id ? map.get(id) || "" : "");
}
