"use client";

export type Toast = { id: number; type: "success" | "error" | "info"; message: string };

let idCounter = 0;
let toasts: Toast[] = [];
let listeners: ((t: Toast[]) => void)[] = [];

function emit() {
  listeners.forEach((fn) => fn(toasts));
}

export function subscribeToasts(fn: (t: Toast[]) => void) {
  listeners.push(fn);
  fn(toasts);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(type: Toast["type"], message: string) {
  const id = ++idCounter;
  toasts = [...toasts.slice(-3), { id, type, message }];
  emit();
  setTimeout(() => dismissToast(id), type === "error" ? 5000 : 3000);
  return id;
}

export const toast = {
  success: (m: string) => push("success", m),
  error: (m: string) => push("error", m),
  info: (m: string) => push("info", m),
};

/** Shows the error's message as a toast — use in catch blocks. */
export function toastError(e: unknown) {
  toast.error(e instanceof Error ? e.message : "Something went wrong.");
}
