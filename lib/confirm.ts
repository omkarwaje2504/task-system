"use client";

export type ConfirmOpts = { danger?: boolean; confirmLabel?: string; cancelLabel?: string; detail?: string };
export type PromptOpts = { placeholder?: string; confirmLabel?: string; required?: boolean; inputType?: "text" | "password" | "textarea" };

type ConfirmFn = (message: string, opts: ConfirmOpts) => Promise<boolean>;
type PromptFn = (message: string, opts: PromptOpts) => Promise<string | null>;

let confirmHandler: ConfirmFn | null = null;
let promptHandler: PromptFn | null = null;

export const registerConfirmHandler = (fn: ConfirmFn) => (confirmHandler = fn);
export const registerPromptHandler = (fn: PromptFn) => (promptHandler = fn);

/** Promise-based confirm dialog. */
export function confirmDialog(message: string, opts: ConfirmOpts = {}) {
  return confirmHandler ? confirmHandler(message, opts) : Promise.resolve(window.confirm(message));
}

/** Promise-based single input prompt. Resolves to the trimmed text, or null if cancelled. */
export function promptDialog(message: string, opts: PromptOpts = {}) {
  if (promptHandler) return promptHandler(message, opts);
  const v = window.prompt(message);
  return Promise.resolve(v ? v.trim() : null);
}
