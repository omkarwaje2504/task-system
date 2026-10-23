"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { APPEARANCE_KEY, applyAppearance, cleanAppearance, type Appearance } from "@/lib/appearance";
import { toastError } from "@/lib/toast";

const ENDPOINT = "/api/me/appearance";
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function keepLocal(a: Appearance) {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(a));
  } catch {}
}

/**
 * The signed-in person's appearance. Changes apply instantly, are kept in
 * localStorage for the pre-paint script, and are saved to the account after
 * a short pause (so dragging a slider doesn't send a request per pixel).
 */
export function useAppearance() {
  const { data, mutate } = useSWR<Appearance>(ENDPOINT, fetcher, { revalidateOnFocus: false });

  // The account is the source of truth: a new device picks up the saved look.
  useEffect(() => {
    if (!data) return;
    applyAppearance(data);
    keepLocal(data);
  }, [data]);

  function update(patch: Partial<Appearance>) {
    const next = cleanAppearance({ ...data, ...patch });
    applyAppearance(next);
    keepLocal(next);
    mutate(next, { revalidate: false });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => api(ENDPOINT, { method: "PUT", body: next }).catch(toastError), 500);
  }

  return { appearance: data, loading: !data, update, reset: () => update(Object.fromEntries(Object.keys(data || {}).map((k) => [k, undefined]))) };
}

/** Mounted once in the app shell so every page follows the account's settings. */
export function AppearanceSync() {
  useAppearance();
  return null;
}
