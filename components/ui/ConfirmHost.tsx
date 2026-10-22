"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { registerConfirmHandler, registerPromptHandler, type ConfirmOpts, type PromptOpts } from "@/lib/confirm";

type ConfirmState = ConfirmOpts & { message: string; resolve: (v: boolean) => void };
type PromptState = PromptOpts & { message: string; resolve: (v: string | null) => void };

export default function ConfirmHost() {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    registerConfirmHandler((message, opts) => new Promise((resolve) => setConfirm({ message, resolve, ...opts })));
    registerPromptHandler((message, opts) => new Promise((resolve) => {
      setValue("");
      setPrompt({ message, resolve, ...opts });
    }));
  }, []);

  function closeConfirm(v: boolean) {
    confirm?.resolve(v);
    setConfirm(null);
  }
  function closePrompt(v: string | null) {
    prompt?.resolve(v);
    setPrompt(null);
    setValue("");
  }
  function submitPrompt() {
    const t = value.trim();
    if (prompt?.required && !t) return;
    closePrompt(t || null);
  }

  if (!confirm && !prompt) return null;
  return (
    <div className="animate-fade fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4" onMouseDown={() => (confirm ? closeConfirm(false) : closePrompt(null))}>
      <div className="animate-pop card w-full max-w-sm" style={{ boxShadow: "var(--shadow-lg)" }} onMouseDown={(e) => e.stopPropagation()}>
        {confirm ? (
          <>
            <div className="mb-4 flex gap-2.5">
              {confirm.danger && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
                  <TriangleAlert className="h-4 w-4" />
                </span>
              )}
              <div>
                <p className="text-sm font-semibold">{confirm.message}</p>
                {confirm.detail && <p className="mt-0.5 text-xs text-muted">{confirm.detail}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => closeConfirm(false)}>{confirm.cancelLabel || "Cancel"}</button>
              <button className={confirm.danger ? "btn-danger" : "btn-primary"} onClick={() => closeConfirm(true)} autoFocus>
                {confirm.confirmLabel || "Yes, continue"}
              </button>
            </div>
          </>
        ) : prompt && (
          <>
            <p className="mb-2 text-sm font-semibold">{prompt.message}</p>
            {prompt.inputType === "textarea" ? (
              <textarea className="input mb-4" rows={3} placeholder={prompt.placeholder} value={value} autoFocus
                onChange={(e) => setValue(e.target.value)} />
            ) : (
              <input type={prompt.inputType || "text"} className="input mb-4" placeholder={prompt.placeholder} value={value} autoFocus
                onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitPrompt()} />
            )}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => closePrompt(null)}>Cancel</button>
              <button className="btn-primary" onClick={submitPrompt} disabled={prompt.required && !value.trim()}>
                {prompt.confirmLabel || "OK"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
