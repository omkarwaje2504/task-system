"use client";

import { useRef, useState } from "react";
import { Check, Mic, Plus, Type, X } from "lucide-react";
import { UserSelect } from "@/components/ui/UserPicker";
import { confirmDialog } from "@/lib/confirm";
import { COMMON_LANGUAGES, languageProgress, languageRow, type LanguageRow, type ProjectStep, type StepData } from "@/lib/workflow";

type Voice = "male" | "female";
const VOICE_LABEL = { male: "Male video", female: "Female video" } as const;

function Toggle({ on, label, icon, onClick, compact = false }: { on: boolean; label: string; icon: React.ReactNode; onClick: () => void; compact?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-pressed={on}
      className={`flex items-center justify-center gap-1 rounded-md border text-[0.6875rem] font-semibold transition-colors ${compact ? "h-7 w-full" : "flex-1 px-2 py-1"} ${
        on ? "border-accent bg-accent text-[var(--accent-fg)]" : "border-line text-muted hover:border-accent hover:text-fg"
      }`}>
      {on ? <Check className="h-3 w-3" strokeWidth={3} /> : icon}
      {!compact && label}
    </button>
  );
}

/**
 * Every language gets a male and a female video; each video needs its text
 * setting and its audio added. The step finishes itself when all are ticked.
 */
export default function LanguagesPanel({ step, onSave }: { step: ProjectStep; onSave: (data: Partial<StepData>) => Promise<void> | void }) {
  // Saves run one after another so the server applies them in click order.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const save = (data: Partial<StepData>) => (queue.current = queue.current.then(() => onSave(data)));
  // Local state is the source of truth while this panel is open: every click
  // sends the full list, so a slower earlier reply can't undo a newer click.
  const [rows, setRows] = useState<LanguageRow[]>(step.data.languages || []);
  const [voices, setVoices] = useState<Voice[]>(step.data.voices?.length ? step.data.voices : ["male", "female"]);
  const [adding, setAdding] = useState("");

  function commit(next: LanguageRow[]) {
    setRows(next);
    save({ languages: next, voices });
  }
  const update = (id: string, fn: (r: LanguageRow) => LanguageRow) => commit(rows.map((r) => (r.id === id ? fn(r) : r)));
  const flip = (r: LanguageRow, v: Voice, k: "text" | "audio") => update(r.id, (x) => ({ ...x, [v]: { ...x[v], [k]: !x[v][k] } }));
  const assign = (r: LanguageRow, v: Voice, id: string | null) => update(r.id, (x) => ({ ...x, [v]: { ...x[v], assignee: id } }));

  function addLanguage(name: string) {
    const clean = name.trim();
    if (!clean || rows.some((r) => r.name.toLowerCase() === clean.toLowerCase())) return;
    commit([...rows, languageRow(clean)]);
    setAdding("");
  }

  async function removeLanguage(r: LanguageRow) {
    if (await confirmDialog(`Remove ${r.name}?`, { danger: true, confirmLabel: "Remove" })) commit(rows.filter((x) => x.id !== r.id));
  }

  function toggleVoice(v: Voice) {
    const next = voices.includes(v) ? voices.filter((x) => x !== v) : [...voices, v];
    if (!next.length) return;
    setVoices(next);
    save({ voices: next, languages: rows });
  }

  const { done, total } = languageProgress({ languages: rows, voices });
  const suggestions = COMMON_LANGUAGES.filter((l) => !rows.some((r) => r.name.toLowerCase() === l.toLowerCase())).slice(0, 6);
  const rowProgress = (r: LanguageRow) => languageProgress({ languages: [r], voices });

  return (
    <div className="mt-2">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold text-muted">Videos needed:</span>
        {(["male", "female"] as const).map((v) => (
          <button key={v} onClick={() => toggleVoice(v)}
            className={`chip ${voices.includes(v) ? "bg-accent-soft text-accent" : "bg-panel2 text-muted line-through"}`}>
            {voices.includes(v) && <Check className="h-3 w-3" />}{VOICE_LABEL[v]}
          </button>
        ))}
        <span className="ml-auto font-bold">{done}/{total} done</span>
      </div>

      {/* Desktop: one table row per language */}
      <div className="hidden overflow-x-auto rounded-lg border border-line md:block">
        <table className="tbl">
          <thead>
            <tr>
              <th rowSpan={2}>Language</th>
              {voices.map((v) => <th key={v} colSpan={3} className="!text-center">{VOICE_LABEL[v]}</th>)}
              <th rowSpan={2} className="text-right">Done</th>
              <th rowSpan={2} />
            </tr>
            <tr>
              {voices.map((v) => (
                <th key={v} colSpan={3} className="!py-1 !normal-case !tracking-normal">
                  <div className="grid grid-cols-[48px_48px_1fr] gap-1"><span>Text</span><span>Audio</span><span>Who</span></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = rowProgress(r);
              return (
                <tr key={r.id}>
                  <td className="font-semibold whitespace-nowrap">{r.name}</td>
                  {voices.map((v) => (
                    <td key={v} colSpan={3} className="!py-1.5">
                      <div className="grid grid-cols-[48px_48px_minmax(120px,1fr)] items-center gap-1">
                        <Toggle compact on={r[v].text} label={`${r.name} ${v} text setting`} icon={<Type className="h-3 w-3" />} onClick={() => flip(r, v, "text")} />
                        <Toggle compact on={r[v].audio} label={`${r.name} ${v} audio added`} icon={<Mic className="h-3 w-3" />} onClick={() => flip(r, v, "audio")} />
                        <UserSelect compact value={r[v].assignee} placeholder="Assign" onChange={(id) => assign(r, v, id)} />
                      </div>
                    </td>
                  ))}
                  <td className={`text-right text-xs font-bold whitespace-nowrap ${p.done === p.total ? "text-accent" : "text-muted"}`}>{p.done}/{p.total}</td>
                  <td className="!px-1"><button className="icon-btn !h-7 !w-7 hover:!text-danger" onClick={() => removeLanguage(r)} aria-label={`Remove ${r.name}`}><X className="h-3.5 w-3.5" /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phones: one compact block per language */}
      <div className="space-y-1.5 md:hidden">
        {rows.map((r) => {
          const p = rowProgress(r);
          return (
            <div key={r.id} className="rounded-lg border border-line p-2">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="flex-1 text-[0.8125rem] font-bold">{r.name}</span>
                <span className={`text-[0.6875rem] font-bold ${p.done === p.total ? "text-accent" : "text-muted"}`}>{p.done}/{p.total}</span>
                <button className="icon-btn !h-6 !w-6 hover:!text-danger" onClick={() => removeLanguage(r)} aria-label={`Remove ${r.name}`}><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="space-y-1.5">
                {voices.map((v) => (
                  <div key={v} className="grid grid-cols-[64px_1fr] items-center gap-1.5">
                    <span className="text-[0.6875rem] font-semibold text-muted">{v === "male" ? "Male" : "Female"}</span>
                    <div className="flex gap-1">
                      <Toggle on={r[v].text} label="Text" icon={<Type className="h-3 w-3" />} onClick={() => flip(r, v, "text")} />
                      <Toggle on={r[v].audio} label="Audio" icon={<Mic className="h-3 w-3" />} onClick={() => flip(r, v, "audio")} />
                    </div>
                    <span />
                    <UserSelect compact value={r[v].assignee} placeholder="Who makes it?" onChange={(id) => assign(r, v, id)} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <input className="input !w-36 !py-1 !text-xs" placeholder="Add a language…" value={adding}
          onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLanguage(adding)} />
        {adding.trim() && <button className="btn-soft btn-sm" onClick={() => addLanguage(adding)}><Plus className="h-3 w-3" />Add</button>}
        {suggestions.map((l) => (
          <button key={l} onClick={() => addLanguage(l)} className="chip bg-panel2 text-muted hover:text-fg"><Plus className="h-3 w-3" />{l}</button>
        ))}
      </div>
    </div>
  );
}
