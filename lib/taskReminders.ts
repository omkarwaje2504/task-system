import "server-only";
import { ObjectId, type Db } from "mongodb";
import { pushTo } from "./notify";
import { REMIND_EVERY_MS } from "./generalTasks";

/**
 * Pushes a reminder to everyone who hasn't acknowledged a general task yet,
 * at most once a minute for the whole team. Runs whenever anyone's app checks
 * for pending tasks (so reminders keep going while someone has the app open)
 * and from /api/cron/task-reminders (an external every-minute cron covers the
 * rest). A shared lock document keeps it to one run per minute.
 */
export async function sendDueReminders(db: Db) {
  const now = new Date();
  const locks = db.collection<{ _id: string; at: Date }>("locks");
  try {
    // Matches only when the last run was a minute ago; otherwise the upsert hits the existing _id and throws.
    await locks.updateOne(
      { _id: "taskReminders", at: { $lte: new Date(now.getTime() - REMIND_EVERY_MS + 5_000) } },
      { $set: { at: now } },
      { upsert: true },
    );
  } catch {
    return 0; // duplicate key: another run holds the lock this minute
  }

  const tasks = await db.collection("generalTasks").find(
    { deleted: { $ne: true }, done: { $ne: true }, "assignees.0": { $exists: true } },
    { projection: { text: 1, assignees: 1, acks: 1, createdByName: 1 } },
  ).toArray();

  let sent = 0;
  for (const t of tasks) {
    const acked = new Set((t.acks || []).map((a: { user: string }) => a.user));
    const waiting = (t.assignees as string[]).filter((a) => !acked.has(a) && ObjectId.isValid(a));
    if (!waiting.length) continue;
    await pushTo(db, waiting, {
      type: "task.assigned",
      title: `⏰ Reminder: task from ${t.createdByName}`,
      body: `${String(t.text).slice(0, 140)} — tap to acknowledge`,
      link: `/dashboard?task=${t._id}`,
      tag: `task-${t._id}`,
    }).catch((e) => console.error("Task reminder push failed:", e));
    sent += waiting.length;
  }
  return sent;
}
