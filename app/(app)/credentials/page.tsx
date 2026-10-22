"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, CreditCard, Eye, EyeOff, Info, KeyRound, Pencil, Plus, Trash, TriangleAlert } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { EmptyState, Field, PageHeader, PageIcon, SearchInput, TableSkeleton } from "@/components/ui/bits";
import { api, fmtDate, useApi, useMe } from "@/lib/client";
import { confirmDialog, promptDialog } from "@/lib/confirm";
import { toast, toastError } from "@/lib/toast";

type Cred = {
  _id: string; service?: string; name?: string; username?: string; notes?: string; createdBy: string; createdByName: string;
  lastAccessedByName?: string; lastAccessedAt?: string; billingStatus?: string; billingAmount?: string; nextPaymentDate?: string; cardLast4?: string;
};

const AUTO_HIDE_MS = 60_000;
const EMPTY = { service: "", name: "", username: "", password: "", notes: "", billingStatus: "active", billingAmount: "", nextPaymentDate: "", cardLast4: "" };
const groupKey = (c: Cred) => (c.service || c.name || "Other").trim();

export default function CredentialsPage() {
  const { data: me } = useMe();
  const { data: creds, isLoading, mutate } = useApi<Cred[]>("/api/credentials");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  // Revealed passwords live only in memory and auto-hide after a minute.
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const services = useMemo(() => [...new Set((creds || []).map(groupKey))].sort(), [creds]);
  const groups = useMemo(() => {
    const term = q.toLowerCase();
    const map = new Map<string, Cred[]>();
    for (const c of creds || []) {
      if (term && ![groupKey(c), c.name, c.username].some((v) => v?.toLowerCase().includes(term))) continue;
      const k = groupKey(c);
      map.set(k, [...(map.get(k) || []), c]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [creds, q]);

  function openNew(service = "") { setEdit(null); setForm({ ...EMPTY, service }); setOpen(true); }
  function openEdit(c: Cred) {
    setEdit(c._id);
    setForm({ service: c.service || "", name: c.name || "", username: c.username || "", password: "", notes: c.notes || "",
      billingStatus: c.billingStatus || "active", billingAmount: c.billingAmount || "", nextPaymentDate: c.nextPaymentDate ? String(c.nextPaymentDate).slice(0, 10) : "", cardLast4: c.cardLast4 || "" });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      await api(edit ? `/api/credentials/${edit}` : "/api/credentials", { method: edit ? "PUT" : "POST", body: form });
      toast.success(edit ? "Credential updated." : "Credential added.");
      setOpen(false);
      mutate();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: Cred) {
    if (!(await confirmDialog(`Delete this ${groupKey(c)} account?`, { danger: true, confirmLabel: "Delete" }))) return;
    try {
      await api(`/api/credentials/${c._id}`, { method: "DELETE" });
      mutate();
    } catch (e) {
      toastError(e);
    }
  }

  function hide(id: string) {
    clearTimeout(timers.current[id]);
    setRevealed((r) => { const n = { ...r }; delete n[id]; return n; });
  }

  async function reveal(c: Cred) {
    const pw = await promptDialog(`Enter YOUR login password to see the ${groupKey(c)} password`, { inputType: "password", confirmLabel: "Show password", required: true, placeholder: "Your password" });
    if (!pw) return;
    try {
      const data = await api<{ password: string }>(`/api/credentials/${c._id}/reveal`, { body: { password: pw } });
      setRevealed((r) => ({ ...r, [c._id]: data.password }));
      timers.current[c._id] = setTimeout(() => hide(c._id), AUTO_HIDE_MS);
      mutate();
    } catch (e) {
      toastError(e);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied.");
    } catch {
      toast.error("Could not copy — select it and copy manually.");
    }
  }

  const canManage = (c: Cred) => me?.role === "admin" || me?.id === String(c.createdBy);
  const info = (c: Cred) => `Added by ${c.createdByName}${c.lastAccessedByName ? ` · last viewed by ${c.lastAccessedByName} on ${new Date(c.lastAccessedAt!).toLocaleString()}` : ""}`;

  const billing = (c: Cred) => c.billingStatus === "suspended"
    ? <span className="chip bg-danger/10 text-danger"><TriangleAlert className="h-3 w-3" />Payment due</span>
    : (c.billingAmount || c.nextPaymentDate)
      ? <span className="text-xs text-muted">{[c.billingAmount, c.nextPaymentDate && `Next ${fmtDate(c.nextPaymentDate)}`].filter(Boolean).join(" · ")}</span>
      : <span className="text-muted">—</span>;

  const password = (c: Cred) => revealed[c._id] ? (
    <span className="flex items-center gap-1">
      <code className="rounded bg-panel2 px-1.5 py-0.5 font-mono text-xs">{revealed[c._id]}</code>
      <button className="icon-btn !h-6 !w-6" onClick={() => copy(revealed[c._id])} aria-label="Copy password"><Copy className="h-3 w-3" /></button>
      <button className="icon-btn !h-6 !w-6" onClick={() => hide(c._id)} aria-label="Hide password"><EyeOff className="h-3 w-3" /></button>
    </span>
  ) : (
    <button className="btn-soft btn-sm" onClick={() => reveal(c)}><Eye className="h-3 w-3" />Show</button>
  );

  const actions = (c: Cred) => (
    <span className="flex items-center justify-end">
      <span className="icon-btn !h-6 !w-6 cursor-help" title={info(c)}><Info className="h-3 w-3" /></span>
      {canManage(c) && (
        <>
          <button className="icon-btn !h-6 !w-6" onClick={() => openEdit(c)} aria-label="Edit"><Pencil className="h-3 w-3" /></button>
          <button className="icon-btn !h-6 !w-6 hover:!text-danger" onClick={() => remove(c)} aria-label="Delete"><Trash className="h-3 w-3" /></button>
        </>
      )}
    </span>
  );

  return (
    <>
      <PageHeader title="Credentials" subtitle="Shared logins. Passwords stay hidden until you re-enter your own password."
        icon={<PageIcon><KeyRound /></PageIcon>}
        actions={<button className="btn-primary" onClick={() => openNew()}><Plus className="h-3.5 w-3.5" />New credential</button>} />
      <div className="mb-3"><SearchInput value={q} onChange={setQ} placeholder="Search service, label, username…" /></div>

      {isLoading && !creds ? <TableSkeleton /> : groups.length === 0 ? (
        <div className="card"><EmptyState icon={<KeyRound />} title={q ? "Nothing matches." : "No credentials saved yet."}
          hint={q ? undefined : "Add a login the whole team needs — it's stored encrypted."}
          action={!q && <button className="btn-primary" onClick={() => openNew()}><Plus className="h-3.5 w-3.5" />New credential</button>} /></div>
      ) : (
        <>
          <div className="card hidden overflow-x-auto !p-0 lg:block">
            <table className="tbl">
              <thead>
                <tr><th>Account</th><th>Username</th><th>Notes</th><th>Billing</th><th>Card</th><th>Password</th><th /></tr>
              </thead>
              {groups.map(([service, accounts]) => (
                <tbody key={service}>
                  <tr className="hover:!bg-transparent">
                    <td colSpan={7} className="bg-panel2/40 !py-1">
                      <span className="text-[13px] font-extrabold">{service}</span> <span className="text-xs text-muted">· {accounts.length}</span>
                      <button className="ml-2 text-[11px] font-bold text-accent hover:underline" onClick={() => openNew(service)}>+ Add account</button>
                    </td>
                  </tr>
                  {accounts.map((c) => (
                    <tr key={c._id}>
                      <td className="font-semibold">{c.name || "—"}</td>
                      <td>
                        {c.username ? (
                          <button className="flex max-w-56 items-center gap-1 text-muted hover:text-fg" onClick={() => copy(c.username!)} title="Copy username">
                            <span className="truncate">{c.username}</span><Copy className="h-3 w-3 shrink-0" />
                          </button>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="max-w-56 truncate text-xs text-muted" title={c.notes}>{c.notes || "—"}</td>
                      <td>{billing(c)}</td>
                      <td className="text-xs text-muted">{c.cardLast4 ? <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" />•••• {c.cardLast4}</span> : "—"}</td>
                      <td>{password(c)}</td>
                      <td className="w-24 !px-1">{actions(c)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {groups.map(([service, accounts]) => (
              <section key={service}>
                <div className="mb-1 flex items-center justify-between px-1">
                  <h2 className="text-[13px] font-extrabold">{service} <span className="font-semibold text-muted">· {accounts.length}</span></h2>
                  <button className="text-[11px] font-bold text-accent" onClick={() => openNew(service)}>+ Add</button>
                </div>
                <div className="card overflow-hidden !p-0">
                  {accounts.map((c) => (
                    <div key={c._id} className="border-b border-line/70 px-3 py-2 last:border-0">
                      <div className="flex items-center gap-1">
                        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{c.name || c.username || "Account"}</p>
                        {actions(c)}
                      </div>
                      {c.username && (
                        <button className="flex max-w-full items-center gap-1 text-xs text-muted" onClick={() => copy(c.username!)}>
                          <span className="truncate">{c.username}</span><Copy className="h-3 w-3 shrink-0" />
                        </button>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {billing(c)}
                        {c.cardLast4 && <span className="chip bg-panel2 text-muted"><CreditCard className="h-3 w-3" />•••• {c.cardLast4}</span>}
                        <span className="ml-auto">{password(c)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={edit ? "Edit credential" : "New credential"}
        footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving || !form.service.trim() || (!edit && !form.password)}>{saving ? "Saving…" : "Save"}</button></>}>
        <Field label="Service" help="Accounts with the same service are grouped — e.g. several Adobe logins.">
          <input className="input" list="cred-services" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} placeholder="e.g. Adobe, Canva" autoFocus />
          <datalist id="cred-services">{services.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <div className="grid gap-x-2.5 sm:grid-cols-2">
          <Field label="Account label" optional><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Design team" /></Field>
          <Field label="Username / email"><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
        </div>
        <Field label={edit ? "New password" : "Password"} optional={!!edit} help={edit ? "Leave empty to keep the current one." : undefined}>
          <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
        </Field>
        <Field label="Notes" optional><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="URL, extra context…" /></Field>
        <p className="section-title mt-1 mb-2">Billing</p>
        <div className="grid gap-x-2.5 sm:grid-cols-2">
          <Field label="Status">
            <select className="input" value={form.billingStatus} onChange={(e) => setForm({ ...form, billingStatus: e.target.value })}>
              <option value="active">Active</option><option value="suspended">Suspended — payment due</option>
            </select>
          </Field>
          <Field label="Next payment" optional><input type="date" className="input" value={form.nextPaymentDate} onChange={(e) => setForm({ ...form, nextPaymentDate: e.target.value })} /></Field>
          <Field label="Amount" optional><input className="input" value={form.billingAmount} onChange={(e) => setForm({ ...form, billingAmount: e.target.value })} placeholder="₹1,016.10" /></Field>
          <Field label="Card last 4 digits" optional><input className="input" inputMode="numeric" maxLength={4} value={form.cardLast4} onChange={(e) => setForm({ ...form, cardLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="1234" /></Field>
        </div>
      </Modal>
    </>
  );
}
