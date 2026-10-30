// General tasks: quick priority work anyone can hand to anyone (dashboard panel).
// Assignees must acknowledge them; until they do, they're reminded every minute.

import type { FileKind } from "./files";

export type TaskFile = { name: string; url: string; mime: string; size: number; kind: FileKind; thumb?: string | null };

export type TaskComment = { id: string; user: string; userName: string; text: string; files: TaskFile[]; createdAt: string };

export type GeneralTask = {
  _id: string;
  /** What the task is. */
  text: string;
  files: TaskFile[];
  /** User ids. */
  assignees: string[];
  /** Who has seen it (pressed Acknowledge), and when. */
  acks: { user: string; at: string }[];
  comments: TaskComment[];
  done: boolean;
  doneAt: string | null;
  doneByName: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

/** Reminder interval for unacknowledged tasks. */
export const REMIND_EVERY_MS = 60_000;

export const ackedBy = (t: Pick<GeneralTask, "acks">, userId: string) => t.acks.some((a) => a.user === userId);

/** Assigned to me, still open, and I haven't acknowledged it yet. */
export const needsMyAck = (t: Pick<GeneralTask, "acks" | "assignees" | "done">, userId: string) =>
  !t.done && t.assignees.includes(userId) && !ackedBy(t, userId);
