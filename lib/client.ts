"use client";

import { useSyncExternalStore } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import type { Brand, Department, Me, Printer, ProductTypeDoc, User } from "./types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function goToLogin() {
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    // Hard navigation on purpose: called outside React, and it drops all cached data.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
}

/** fetch + JSON with friendly errors. Throws ApiError with the server's message. */
export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) goToLogin();
  if (!res.ok) throw new ApiError(data.error || "Something went wrong. Please try again.", res.status);
  return data as T;
}

export const fetcher = <T,>(url: string) => api<T>(url);

export function useApi<T>(url: string | null) {
  return useSWR<T>(url, fetcher, { revalidateOnFocus: true, keepPreviousData: true });
}

export const useMe = () => useSWR<Me>("/api/auth/me", fetcher, { revalidateOnFocus: false });
export const useUsers = () => useApi<User[]>("/api/users");
export const useTypes = () => useApi<ProductTypeDoc[]>("/api/product-types");
export const usePrinters = () => useApi<Printer[]>("/api/printers");
export const useBrands = () => useApi<Brand[]>("/api/brands");
export const useDepartments = () => useApi<Department[]>("/api/departments");

/** Revalidate every cached key that starts with one of these prefixes. */
export function refresh(...prefixes: string[]) {
  return globalMutate((key) => typeof key === "string" && prefixes.some((p) => key.startsWith(p)));
}

/** Uploads straight to R2 through a presigned URL. Returns the public URL. */
export async function uploadFile(file: File, folder: string, onProgress?: (pct: number) => void) {
  const { uploadUrl, url } = await api<{ uploadUrl: string; url: string }>("/api/upload/presign", {
    body: { filename: file.name, contentType: file.type, size: file.size, folder },
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Upload failed — check your internet, or the bucket's CORS settings."));
    xhr.send(file);
  });
  return url;
}

// ---- Dates ----------------------------------------------------------------

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export function daysUntil(date: string) {
  const a = new Date(`${todayISO()}T00:00:00`).getTime();
  const b = new Date(`${date.slice(0, 10)}T00:00:00`).getTime();
  return Math.round((b - a) / 864e5);
}

export function fmtDate(date: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!date) return "";
  const d = new Date(date.length === 10 ? `${date}T00:00:00` : date);
  return d.toLocaleDateString(undefined, { ...opts, ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
}

export function timeAgo(date: string) {
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(date);
}

const noopSubscribe = () => () => {};

/**
 * False during server prerender and hydration, true afterwards. Use it to
 * hold back anything that depends on the viewer's clock or locale.
 */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
