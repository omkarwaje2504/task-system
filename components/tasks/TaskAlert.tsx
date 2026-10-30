"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import useSWR from "swr";
import { BellRing } from "lucide-react";
import { fetcher } from "@/lib/client";
import { toast } from "@/lib/toast";
import { REMIND_EVERY_MS } from "@/lib/generalTasks";

export type Pending = { count: number; items: { _id: string; text: string; createdByName: string }[] };
export const PENDING_URL = "/api/general-tasks/pending";

/** Tasks waiting for my acknowledgement (shared by the alert and the bell). */
export const usePendingTasks = () => useSWR<Pending>(PENDING_URL, fetcher, { refreshInterval: 15_000, revalidateOnFocus: true });

const BELL_ICON = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#ff3b30"/><path d="M32 12a14 14 0 0 0-14 14v9l-5 7h38l-5-7v-9a14 14 0 0 0-14-14Zm-6 34a6 6 0 0 0 12 0Z" fill="#fff"/></svg>`,
)}`;

/** A short double "ding" (only plays once the page has had a click — browser rule). */
function ding() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.22].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {}
}

/** System notification while the tab is in the background (if allowed). */
async function systemNotify(title: string, body: string, id: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
  const opts = { body, tag: `task-${id}`, renotify: true, requireInteraction: true, icon: "/apple-icon", data: { link: `/dashboard?task=${id}` } } as NotificationOptions;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts).onclick = () => { window.focus(); window.open(`/dashboard?task=${id}`, "_self"); };
  } catch {}
}

/**
 * While I have unacknowledged priority tasks: the tab title flashes with a bell,
 * the tab icon turns into a red bell, the screen edge flashes, a banner sits on
 * top, and every minute it dings + reminds (system notification if the tab is
 * in the background).
 */
export default function TaskAlert() {
  const { data } = usePendingTasks();
  const count = data?.count || 0;
  const first = data?.items[0];
  const seen = useRef(new Set<string>());

  // Title + tab icon + screen flash.
  useEffect(() => {
    if (!count) return;
    const root = document.documentElement;
    root.dataset.taskAlert = "";
    const icons = [...document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']")];
    const oldIcons = icons.map((l) => l.href);
    icons.forEach((l) => (l.href = BELL_ICON));
    let base = document.title;
    let on = false;
    const alertTitle = `🔔 ${count} new task${count === 1 ? "" : "s"}!`;
    const tick = setInterval(() => {
      if (!document.title.startsWith("🔔")) base = document.title;
      on = !on;
      document.title = on ? alertTitle : `🔔 ${base}`;
    }, 1000);
    return () => {
      clearInterval(tick);
      delete root.dataset.taskAlert;
      icons.forEach((l, i) => (l.href = oldIcons[i]));
      if (document.title.startsWith("🔔")) document.title = base;
    };
  }, [count]);

  // New task: ding + toast right away; then a reminder every minute until acknowledged.
  useEffect(() => {
    if (!data?.items.length) return;
    const fresh = data.items.filter((t) => !seen.current.has(t._id));
    fresh.forEach((t) => seen.current.add(t._id));
    if (fresh.length) {
      ding();
      toast.info(`🔔 ${fresh[0].createdByName} gave you a priority task: ${fresh[0].text.slice(0, 80)}`);
      systemNotify(`🔔 Task from ${fresh[0].createdByName}`, fresh[0].text.slice(0, 140), fresh[0]._id);
    }
  }, [data]);

  useEffect(() => {
    if (!count || !first) return;
    const remind = setInterval(() => {
      ding();
      toast.info(`⏰ Reminder: ${count} task${count === 1 ? "" : "s"} waiting for your acknowledgement.`);
      systemNotify(`⏰ Reminder: task from ${first.createdByName}`, `${first.text.slice(0, 140)} — tap to acknowledge`, first._id);
    }, REMIND_EVERY_MS);
    return () => clearInterval(remind);
  }, [count, first]);

  if (!count || !first) return null;
  return (
    <Link href={`/dashboard?task=${first._id}`} scroll={false}
      className="task-flash glass fixed top-3 left-1/2 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold shadow-lg lg:top-3.5">
      <BellRing className="bell-ring h-4 w-4 shrink-0 text-danger" />
      <span className="truncate">
        {count === 1 ? `${first.createdByName.split(" ")[0]} gave you a task` : `${count} tasks waiting for you`} — tap to acknowledge
      </span>
    </Link>
  );
}
