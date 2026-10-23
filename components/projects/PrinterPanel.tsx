"use client";

import Link from "next/link";
import { Copy, Mail, Printer as PrinterIcon } from "lucide-react";
import { usePrinters } from "@/lib/client";
import { toast } from "@/lib/toast";
import type { ProjectStep, StepData } from "@/lib/workflow";

const SPECS = [
  ["printerType", "Printer type"],
  ["pageColor", "Color"],
  ["fileType", "File type"],
  ["fileSize", "File size"],
  ["pageType", "Paper"],
] as const;

/** Pick a printer from Printer Types and see exactly what file it needs. */
export default function PrinterPanel({ step, onSave }: { step: ProjectStep; onSave: (data: Partial<StepData>) => void }) {
  const { data: printers = [] } = usePrinters();
  const chosen = printers.find((p) => p._id === step.data.printer);

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <PrinterIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
        <select className="input" value={step.data.printer || ""} onChange={(e) => onSave({ printer: e.target.value || null })}>
          <option value="">Choose a printer…</option>
          {printers.map((p) => <option key={p._id} value={p._id}>{p.name}{p.printerType ? ` — ${p.printerType}` : ""}</option>)}
        </select>
      </div>
      {!printers.length && <p className="help">No printers yet. <Link href="/printers" className="text-accent underline">Add one in Printer Types</Link>.</p>}
      {chosen && (
        <div className="animate-pop mt-2 rounded-lg border border-line p-2.5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.8125rem] sm:grid-cols-5">
            {SPECS.map(([k, label]) => chosen[k] && (
              <div key={k}>
                <p className="text-[0.625rem] font-semibold tracking-wide text-muted uppercase">{label}</p>
                <p className="font-semibold">{chosen[k]}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <a className="btn-soft btn-sm" href={`mailto:${chosen.email_id}`}><Mail className="h-3 w-3" />Email {chosen.email_id}</a>
            <button className="btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(chosen.email_id); toast.success("Email copied."); }}>
              <Copy className="h-3 w-3" />Copy email
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
