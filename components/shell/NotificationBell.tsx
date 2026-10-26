"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Bell, BellOff, BellRing, CheckCheck, CircleCheck, CircleDot, FlaskConical, UserPlus, type LucideIcon } from "lucide-react";
import FloatingPanel from "@/components/ui/Floating";
import { Avatar } from "@/components/ui/bits";
import { api, fetcher, timeAgo } from "@/lib/client";
import { toast, toastError } from "@/lib/toast";
import { disablePush, enablePush, onForegroundPush, pushSupported, savedToken } from "@/lib/push";

type Note = { _id: string; type: string; title: string; body: string; link: string; actorName?: string; read: boolean; createdAt: string };
type Feed = { items: Note[]; unread: number; push: boolean };

const ICONS: Record<string, LucideIcon> = { "step.assigned": UserPlus, "step.doing": CircleDot, "step.done": CircleCheck, "step.finished": CircleCheck, "sample.working": FlaskConical, "sample.finished": CircleCheck };

/** Bell (top right) with the unread count; opens the notification panel. */
export default function NotificationBell() {
  const router = useRouter();
  const { data, mutate } = useSWR<Feed>("/api/notifications", fetcher, { refreshInterval: 30_000, revalidateOnFocus: true });
  const [open, setOpen] = useState(false);
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const unread = data?.unread || 0;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read this device's push state after hydration
    setPushOn(!!savedToken() && typeof Notification !== "undefined" && Notification.permission === "granted");
    let stop = () => {};
    onForegroundPush((title, body) => {
      toast.info(body ? `${title} — ${body}` : title);
      mutate();
    }).then((s) => (stop = s));
    return () => stop();
  }, [mutate]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchor.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  async function markAll() {
    await api("/api/notifications", { body: {} }).catch(toastError);
    mutate();
  }

  async function openNote(n: Note) {
    setOpen(false);
    if (!n.read) api("/api/notifications", { body: { ids: [n._id] } }).then(() => mutate()).catch(() => {});
    router.push(n.link);
  }

  async function togglePush() {
    setBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
        toast.success("Push notifications are off on this device.");
      } else {
        await enablePush();
        setPushOn(true);
        toast.success("Push notifications are on for this device.");
      }
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button ref={anchor} onClick={() => setOpen(!open)} className="icon-btn relative" aria-label={unread ? `${unread} unread notifications` : "Notifications"} title="Notifications">
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.5625rem] leading-none font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <FloatingPanel anchor={anchor} panelRef={panel} width={380} estHeight={480} className="!p-0">
          <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
            <span className="text-[0.8125rem] font-extrabold">Notifications</span>
            {unread > 0 && (
              <button className="flex items-center gap-1 text-[0.6875rem] font-semibold text-accent hover:underline" onClick={markAll}>
                <CheckCheck className="h-3.5 w-3.5" />Mark all read
              </button>
            )}
          </div>

          {data?.push && pushSupported() && pushOn !== null && (
            <button onClick={togglePush} disabled={busy}
              className="flex shrink-0 items-center gap-2 border-b border-line/70 px-3 py-2 text-left text-xs hover:bg-panel2/60">
              {pushOn ? <BellOff className="h-4 w-4 shrink-0 text-muted" /> : <BellRing className="h-4 w-4 shrink-0 text-accent" />}
              <span className="flex-1">
                <span className="block font-semibold">{pushOn ? "Push is on for this device" : "Get push notifications on this device"}</span>
                <span className="text-[0.6875rem] text-muted">{pushOn ? "Click to turn it off." : "Assigned steps — and for heads, when people start or finish work."}</span>
              </span>
            </button>
          )}

          <div className="min-h-0 overflow-y-auto">
            {!data ? <p className="px-3 py-6 text-center text-xs text-muted">Loading…</p>
              : data.items.length === 0 ? <p className="px-3 py-8 text-center text-xs text-muted">No notifications yet.</p>
              : data.items.map((n) => {
                const Icon = ICONS[n.type] || Bell;
                return (
                  <button key={n._id} onClick={() => openNote(n)}
                    className={`flex w-full items-start gap-2.5 border-b border-line/60 px-3 py-2.5 text-left last:border-0 hover:bg-panel2/60 ${n.read ? "" : "bg-accent-soft/40"}`}>
                    <span className="relative mt-0.5 shrink-0">
                      <Avatar name={n.actorName} size="sm" />
                      <span className="glass absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full !shadow-none"><Icon className="h-2.5 w-2.5 text-accent" /></span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[0.8125rem] leading-snug ${n.read ? "" : "font-semibold"}`}>{n.title}</span>
                      {n.body && <span className="block truncate text-[0.6875rem] text-muted">{n.body}</span>}
                      <span className="text-[0.625rem] text-muted">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                  </button>
                );
              })}
          </div>
        </FloatingPanel>
      )}
    </>
  );
}
