"use client";

import { useMemo, useState } from "react";
import { Copy, CreditCard, Info, KeyRound, Pencil, Plus, Trash, TriangleAlert } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { EmptyState, Field, PageHeader, PageIcon, SearchInput, SortTh, TableSkeleton, useSort } from "@/components/ui/bits";
import { api, fmtDate, useApi, useMe } from "@/lib/client";
import { confirmDialog } from "@/lib/confirm";
import { toast, toastError } from "@/lib/toast";

type Cred = {
  _id: string; service?: string; name?: string; username?: string; password: string | null; notes?: string; createdBy: string; createdByName: string;
  billingStatus?: string; billingAmount?: string; nextPaymentDate?: string; cardLast4?: string;
};

const EMPTY = { service: "", name: "", username: "", password: "", notes: "", billingStatus: "active", billingAmount: "", nextPaymentDate: "", cardLast4: "" };
const serviceOf = (c: Cred) => (c.service || c.name || "Other").trim();

export default function CredentialsPage() {
  const { data: me } = useMe();
  const { data: creds, isLoading, mutate } = useApi<Cred[]>("/api/credentials");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const services = useMemo(() => [...new Set((creds || []).map(serviceOf))].sort(), [creds]);
  const list = useMemo(() => {
    const term = q.toLowerCase();
    return (creds || []).filter((c) => !term || [serviceOf(c), c.name, c.username, c.notes].some((v) => v?.toLowerCase().includes(term)));
  }, [creds, q]);
  // Account type (service) is a sortable column; sorted by it by default.
  const { sorted, sort, toggle } = useSort(list, {
    service: (c) => `${serviceOf(c)} ${c.name || ""}`,
    name: (c) => c.name,
    username: (c) => c.username,
    billing: (c) => (c.billingStatus === "suspended" ? 0 : 1),
  });

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
    if (!(await confirmDialog(`Delete this ${serviceOf(c)} account?`, { danger: true, confirmLabel: "Delete" }))) return;
    try {
      await api(`/api/credentials/${c._id}`, { method: "DELETE" });
      mutate();
    } catch (e) {
      toastError(e);
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied.`);
    } catch {
      toast.error("Could not copy — select it and copy manually.");
    }
  }

  const canManage = (c: Cred) => me?.role === "admin" || me?.id === String(c.createdBy);

  const billing = (c: Cred) => c.billingStatus === "suspended"
    ? <span className="chip bg-danger/10 text-danger"><TriangleAlert className="h-3 w-3" />Payment due</span>
    : (c.billingAmount || c.nextPaymentDate)
      ? <span className="text-xs text-muted">{[c.billingAmount, c.nextPaymentDate && `Next ${fmtDate(c.nextPaymentDate)}`].filter(Boolean).join(" · ")}</span>
      : <span className="text-muted">—</span>;

  const copyable = (text: string | undefined | null, what: string, mono = false) => text ? (
    <button className={`flex max-w-56 items-center gap-1 hover:text-accent ${mono ? "" : "text-muted"}`} onClick={() => copy(text, what)} title={`Copy ${what.toLowerCase()}`}>
      <span className={`truncate ${mono ? "rounded bg-panel2 px-1.5 py-0.5 font-mono text-xs text-fg" : ""}`}>{text}</span>
      <Copy className="h-3 w-3 shrink-0 text-muted" />
    </button>
  ) : <span className="text-muted">—</span>;

  const password = (c: Cred) => c.password === null
    ? <span className="text-xs text-danger" title="CREDENTIALS_SECRET may have changed">Can&apos;t be read</span>
    : copyable(c.password, "Password", true);

  const actions = (c: Cred) => (
    <span className="flex items-center justify-end">
      <span className="icon-btn !h-6 !w-6 cursor-help" title={`Added by ${c.createdByName}`}><Info className="h-3 w-3" /></span>
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
      <PageHeader title="Credentials" subtitle="Shared logins for the team. Click a username or password to copy it."
        icon={<PageIcon><KeyRound /></PageIcon>}
        actions={<button className="btn-primary" onClick={() => openNew()}><Plus className="h-3.5 w-3.5" />New credential</button>} />
      <div className="mb-3 flex items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search service, label, username, notes…" />
        {creds && <span className="ml-auto text-xs text-muted">{sorted.length} account{sorted.length === 1 ? "" : "s"}</span>}
      </div>

      {isLoading && !creds ? <TableSkeleton /> : sorted.length === 0 ? (
        <div className="card"><EmptyState icon={<KeyRound />} title={q ? "Nothing matches." : "No credentials saved yet."}
          hint={q ? undefined : "Add a login the whole team needs — it's stored encrypted."}
          action={!q && <button className="btn-primary" onClick={() => openNew()}><Plus className="h-3.5 w-3.5" />New credential</button>} /></div>
      ) : (
        <>
          <div className="card hidden overflow-x-auto !p-0 lg:block">
            <table className="tbl">
              <thead>
                <tr>
                  <SortTh label="Service" k="service" sort={sort} onSort={toggle} />
                  <SortTh label="Account" k="name" sort={sort} onSort={toggle} />
                  <SortTh label="Username" k="username" sort={sort} onSort={toggle} />
                  <th>Password</th><th>Notes</th>
                  <SortTh label="Billing" k="billing" sort={sort} onSort={toggle} />
                  <th>Card</th><th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <tr key={c._id}>
                    <td className="font-semibold whitespace-nowrap">{serviceOf(c)}</td>
                    <td className="max-w-40 truncate">{c.name || <span className="text-muted">—</span>}</td>
                    <td>{copyable(c.username, "Username")}</td>
                    <td>{password(c)}</td>
                    <td className="max-w-56 truncate text-xs text-muted" title={c.notes}>{c.notes || "—"}</td>
                    <td>{billing(c)}</td>
                    <td className="text-xs whitespace-nowrap text-muted">{c.cardLast4 ? <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" />•••• {c.cardLast4}</span> : "—"}</td>
                    <td className="w-24 !px-1">{actions(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card overflow-hidden !p-0 lg:hidden">
            {sorted.map((c) => (
              <div key={c._id} className="border-b border-line/70 px-3 py-2 last:border-0">
                <div className="flex items-center gap-1.5">
                  <span className="chip shrink-0 bg-accent-soft text-accent">{serviceOf(c)}</span>
                  <p className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold">{c.name || ""}</p>
                  {actions(c)}
                </div>
                <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-xs">
                  <span className="text-muted">User</span>{copyable(c.username, "Username")}
                  <span className="text-muted">Password</span>{password(c)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {billing(c)}
                  {c.cardLast4 && <span className="chip bg-panel2 text-muted"><CreditCard className="h-3 w-3" />•••• {c.cardLast4}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={edit ? "Edit credential" : "New credential"}
        footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving || !form.service.trim() || (!edit && !form.password)}>{saving ? "Saving…" : "Save"}</button></>}>
        <Field label="Service" help="The account type — e.g. Adobe, Canva. Pick an existing one to keep them together.">
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
