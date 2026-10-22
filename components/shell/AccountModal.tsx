"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Field, PageIcon } from "@/components/ui/bits";
import { api } from "@/lib/client";
import { toast, toastError } from "@/lib/toast";

export default function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api("/api/auth/password", { body: { current, next } });
      toast.success("Password changed.");
      setCurrent("");
      setNext("");
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="sm" title="Change password"
      icon={<PageIcon><KeyRound /></PageIcon>}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving || !current || next.length < 6}>{saving ? "Saving…" : "Change password"}</button>
      </>}>
      <Field label="Current password">
        <input type="password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
      </Field>
      <Field label="New password" help="At least 6 characters.">
        <input type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
      </Field>
    </Modal>
  );
}
