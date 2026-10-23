"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { CircleCheck, CircleDot, Paperclip, Star } from "lucide-react";
import TypeIcon from "@/components/ui/TypeIcon";
import { Avatar, DeadlineBadge } from "@/components/ui/bits";
import { useUserName } from "@/components/ui/UserPicker";
import { fmtDate, timeAgo } from "@/lib/client";
import { countSummary, stepPeople, workingStep } from "@/lib/workflow";
import type { Project } from "@/lib/types";
import { CountCell, StatusChip, projectTitle } from "./ProjectCard";

const OPEN_DELAY = 350;
const CLOSE_DELAY = 150;
const WIDTH = 380;

type Hover = { p: Project; rect: DOMRect };

/**
 * Hover a project row → a quick-review card: the step being worked on (with
 * its details), the last finished one, counts and the final artwork thumbnail.
 */
export function useProjectHover() {
  const [hover, setHover] = useState<Hover | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!hover) return;
    const close = () => setHover(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [hover]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const rowProps = (p: Project) => ({
    onMouseEnter: (e: MouseEvent<HTMLElement>) => {
      clearTimeout(timer.current);
      const rect = e.currentTarget.getBoundingClientRect();
      timer.current = setTimeout(() => setHover({ p, rect }), hover ? 80 : OPEN_DELAY);
    },
    onMouseLeave: () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setHover(null), CLOSE_DELAY);
    },
  });

  const card = hover && (
    <ProjectHoverCard hover={hover}
      onEnter={() => clearTimeout(timer.current)}
      onLeave={() => { timer.current = setTimeout(() => setHover(null), CLOSE_DELAY); }} />
  );
  return { rowProps, card };
}

function ProjectHoverCard({ hover: { p, rect }, onEnter, onLeave }: { hover: Hover; onEnter: () => void; onLeave: () => void }) {
  const nameOf = useUserName();
  const count = countSummary(p.steps);
  // Steps are the tasks: what's in progress (else next up), and what finished last.
  const open = p.steps.filter((s) => s.status !== "done");
  const working = workingStep(p.steps);
  const lastDone = p.steps.filter((s) => s.status === "done" && s.doneAt).sort((a, b) => (b.doneAt! > a.doneAt! ? 1 : -1))[0];
  const people = working ? stepPeople(working) : [];

  // Below the row, or above it when there isn't room.
  const left = Math.min(rect.left + 16, window.innerWidth - WIDTH - 12);
  const below = window.innerHeight - rect.bottom > 340;
  const style = below ? { left, top: rect.bottom + 6 } : { left, bottom: window.innerHeight - rect.top + 6 };

  return createPortal(
    <div role="tooltip" className="glass animate-pop fixed z-[85] max-h-[70dvh] overflow-y-auto rounded-[22px] p-3.5 text-[0.8125rem]"
      style={{ ...style, width: WIDTH }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div className="flex items-start gap-2.5">
        {p.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- R2 thumbnail
          <img src={p.cover.thumb} alt={p.cover.title || p.cover.name} title={p.cover.title || p.cover.name} className="h-14 w-14 shrink-0 rounded-xl border border-line object-cover" />
        ) : <TypeIcon icon={p.type?.icon} size="lg" />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{projectTitle(p)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <StatusChip status={p.status} />
            {p.type?.name && <span className="chip bg-panel2 text-muted">{p.type.name}</span>}
            {!!p.fileCount && (
              <span className="chip bg-panel2 text-muted">
                {p.cover?.final ? <Star className="h-3 w-3 fill-current" /> : <Paperclip className="h-3 w-3" />}
                {p.fileCount} file{p.fileCount === 1 ? "" : "s"}
              </span>
            )}
            <DeadlineBadge date={p.deadline} done={p.status === "completed"} />
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-panel2 px-2.5 py-2">
          <p className="section-title mb-1">Steps</p>
          <span className="font-semibold tabular-nums">{p.steps.length - open.length}<span className="font-normal text-muted">/{p.steps.length} done</span></span>
        </div>
        <div className="rounded-xl bg-panel2 px-2.5 py-2">
          <p className="section-title mb-1">{count ? "Count" : "To do"}</p>
          {count ? <CountCell c={count} /> : <span className="font-semibold tabular-nums">{open.length}</span>}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <p className="section-title">{working?.status === "doing" ? "Working on" : "Up next"}</p>
          {working?.updatedAt && <span className="text-[0.6875rem] text-muted">updated {timeAgo(working.updatedAt)}</span>}
        </div>
        {working && p.status !== "completed" ? (
          <div className="rounded-xl border border-line px-2.5 py-2">
            <p className="flex items-start gap-1.5 font-semibold">
              <CircleDot className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${working.status === "doing" ? "text-accent" : "text-muted"}`} />
              <span>{working.title}</span>
            </p>
            {working.note
              ? <p className="mt-1.5 line-clamp-6 text-xs whitespace-pre-wrap text-fg/85">{working.note}</p>
              : <p className="mt-1 text-xs text-muted italic">No details yet — add them with the step&apos;s Edit button.</p>}
            {(people.length > 0 || working.dueDate) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {people.map((a) => (
                  <span key={a} className="flex items-center gap-1 rounded-full bg-panel2 py-0.5 pr-2 pl-0.5 text-[0.6875rem]">
                    <Avatar name={nameOf(a)} size="xs" />{nameOf(a)}
                  </span>
                ))}
                {working.dueDate && <DeadlineBadge date={working.dueDate} />}
              </div>
            )}
          </div>
        ) : <p className="text-xs text-muted">{p.steps.length ? "All steps are done." : "No steps yet."}</p>}
        {lastDone && (
          <p className="mt-2 flex items-center gap-1.5 truncate text-[0.6875rem] text-muted">
            <CircleCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Last finished: <b className="font-semibold text-fg/80">{lastDone.title}</b>{lastDone.doneByName ? ` by ${lastDone.doneByName}` : ""} · {fmtDate(lastDone.doneAt)}</span>
          </p>
        )}
      </div>

      {p.notes && (
        <div className="mt-3">
          <p className="section-title mb-1">Notes</p>
          <p className="line-clamp-3 text-xs whitespace-pre-wrap text-muted">{p.notes}</p>
        </div>
      )}
    </div>,
    document.body,
  );
}
