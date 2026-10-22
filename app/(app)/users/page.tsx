"use client";

import { useState } from "react";
import { Dices, Plus, ShieldCheck, Trash, UserRound, Users } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Avatar, EmptyState, Field, PageHeader, PageIcon, SearchInput, SortTh, TableSkeleton, useSort } from "@/components/ui/bits";
import { api, refresh, timeAgo, useMe, useUsers } from "@/lib/client";
import { confirmDialog } from "@/lib/confirm";
import { toast, toastError } from "@/lib/toast";
import type { User } from "@/lib/types";

const TEAMS = ["graphic", "video", "frontend", "backend", "app", "all"];

function makePassword() {
  const words = ["sun", "moon", "star", "leaf", "wave", "rock", "fire", "snow", "bird", "tree"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${Math.floor(100 + Math.random() * 900)}`;
}

function UserModal({ user, onClose }: { user?: User; onClose: () => void }) {
  const [form, setForm] = useState({
    name: user?.name || "", email: user?.email || "", mobile: user?.mobile || "", team: user?.team || "",
    role: user?.role || "member", password: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      if (user) await api(`/api/users/${user._id}`, { method: "PUT", body: { ...form, password: form.password || undefined } });
      else await api("/api/users", { body: form });
      toast.success(user ? "User saved." : `Account created. Share the password with ${form.name.split(" ")[0]}.`);
      refresh("/api/users");
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={user ? `Edit ${user.name}` : "Add a team member"} subtitle={user ? undefined : "They log in with this email and password."}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving || !form.name.trim() || !form.email.trim() || (!user && form.password.length < 6)}>{saving ? "Saving…" : user ? "Save" : "Create account"}</button></>}>
      <Field label="Full name"><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Email"><input type="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Mobile" optional><input className="input" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} inputMode="tel" /></Field>
        <Field label="Team" optional>
          <input className="input" list="teams" value={form.team} onChange={(e) => set("team", e.target.value)} placeholder="graphic, video…" />
          <datalist id="teams">{TEAMS.map((t) => <option key={t} value={t} />)}</datalist>
        </Field>
        <Field label="Access">
          <select className="input" value={form.role} onChange={(e) => set("role", e.target.value)}>
            <option value="member">Team member</option>
            <option value="admin">Admin — can manage users & product types</option>
          </select>
        </Field>
      </div>
      <Field label={user ? "New password" : "Password"} optional={!!user} help={user ? "Leave empty to keep their current password." : "At least 6 characters. They can change it later."}>
        <div className="flex gap-2">
          <input className="input font-mono" value={form.password} onChange={(e) => set("password", e.target.value)} />
          <button type="button" className="btn-ghost shrink-0" onClick={() => set("password", makePassword())}><Dices className="h-4 w-4" />Generate</button>
        </div>
      </Field>
    </Modal>
  );
}

export default function UsersPage() {
  const { data: me } = useMe();
  const { data: users, isLoading } = useUsers();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [adding, setAdding] = useState(false);

  async function setActive(u: User, active: boolean) {
    try {
      await api(`/api/users/${u._id}`, { method: "PUT", body: { active } });
      refresh("/api/users");
      toast.success(active ? `${u.name} can log in again.` : `${u.name} can no longer log in.`);
    } catch (e) {
      toastError(e);
    }
  }

  async function remove(u: User) {
    if (!(await confirmDialog(`Delete ${u.name}?`, { danger: true, confirmLabel: "Delete", detail: "They won't be able to log in. Their past work stays." }))) return;
    try {
      await api(`/api/users/${u._id}`, { method: "DELETE" });
      refresh("/api/users");
    } catch (e) {
      toastError(e);
    }
  }

  const list = (users || []).filter((u) => [u.name, u.email, u.team].some((v) => v?.toLowerCase().includes(q.toLowerCase())));
  const { sorted, sort, toggle } = useSort(list, {
    name: (u) => u.name, email: (u) => u.email, team: (u) => u.team, role: (u) => u.role,
    seen: (u) => (u.lastLoginAt ? -new Date(u.lastLoginAt).getTime() : null),
  });

  if (me && me.role !== "admin") return <div className="card"><EmptyState title="Admins only" hint="Only admins can manage accounts." /></div>;

  return (
    <>
      <PageHeader title="Users" subtitle="Only admins can create accounts. There is no public sign-up."
        icon={<PageIcon><Users /></PageIcon>}
        actions={<button className="btn-primary" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" />Add user</button>} />
      <div className="mb-3 flex items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, email, team…" />
        {users && <span className="ml-auto text-xs text-muted">{list.length} people</span>}
      </div>

      {isLoading && !users ? <TableSkeleton /> : list.length === 0 ? (
        <div className="card"><EmptyState icon={<UserRound />} title="Nobody found." /></div>
      ) : (
        <>
          <div className="card hidden overflow-x-auto !p-0 lg:block">
            <table className="tbl">
              <thead>
                <tr>
                  <SortTh label="Name" k="name" sort={sort} onSort={toggle} />
                  <SortTh label="Email" k="email" sort={sort} onSort={toggle} />
                  <th>Mobile</th>
                  <SortTh label="Team" k="team" sort={sort} onSort={toggle} />
                  <SortTh label="Access" k="role" sort={sort} onSort={toggle} />
                  <SortTh label="Last seen" k="seen" sort={sort} onSort={toggle} />
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((u) => (
                  <tr key={u._id} className={u.active === false ? "opacity-55" : ""}>
                    <td><span className="flex items-center gap-2 font-semibold"><Avatar name={u.name} size="sm" />{u.name}{u.role === "admin" && <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-label="Admin" />}</span></td>
                    <td className="text-muted">{u.email}</td>
                    <td className="text-muted">{u.mobile || "—"}</td>
                    <td className="text-muted capitalize">{u.team || "—"}</td>
                    <td>
                      {u.active === false ? <span className="chip bg-danger/10 text-danger">Switched off</span>
                        : <span className={`chip ${u.role === "admin" ? "bg-accent-soft text-accent" : "bg-panel2 text-muted"}`}>{u.role === "admin" ? "Admin" : "Member"}</span>}
                    </td>
                    <td className="text-xs text-muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost btn-sm" onClick={() => setEditing(u)}>Edit</button>
                        {u._id !== me?.id && (
                          <>
                            <button className="btn-ghost btn-sm" onClick={() => setActive(u, u.active === false)}>{u.active === false ? "Switch on" : "Switch off"}</button>
                            <button className="icon-btn !h-7 !w-7 hover:!text-danger" onClick={() => remove(u)} aria-label={`Delete ${u.name}`}><Trash className="h-3.5 w-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card overflow-hidden !p-0 lg:hidden">
            {sorted.map((u) => (
              <button key={u._id} onClick={() => setEditing(u)} className={`flex w-full items-center gap-2.5 border-b border-line/70 px-3 py-2 text-left last:border-0 ${u.active === false ? "opacity-55" : ""}`}>
                <Avatar name={u.name} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate text-[13px] font-semibold">{u.name}{u.role === "admin" && <ShieldCheck className="h-3.5 w-3.5 text-accent" />}</span>
                  <span className="block truncate text-[11px] text-muted">{[u.email, u.team].filter(Boolean).join(" · ")}</span>
                </span>
                {u.active === false && <span className="chip bg-danger/10 text-danger">Off</span>}
              </button>
            ))}
          </div>
        </>
      )}
      {adding && <UserModal onClose={() => setAdding(false)} />}
      {editing && <UserModal key={editing._id} user={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
