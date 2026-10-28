import "server-only";
import { ObjectId, type Db } from "mongodb";

/**
 * One "I'm working" at a time per person. Starting on something clears the
 * person's other marks: steps they're on that are in progress go back to no
 * status, and they're taken off any other sample they're working on.
 * Returns what was cleared, so the UI can say so.
 */
export async function stopOtherWork(db: Db, userId: string, keep: { project?: ObjectId; stepId?: string }) {
  const now = new Date();
  const stopped: string[] = [];

  // Steps in progress that I'm on (except the one I'm starting).
  const projects = await db.collection("projects").find(
    { deleted: { $ne: true }, steps: { $elemMatch: { status: "doing", assignees: userId } } },
    { projection: { steps: 1, theme: 1, legacyName: 1 } },
  ).toArray();
  for (const p of projects) {
    let changed = false;
    const steps = p.steps.map((s: { id: string; title: string; status: string; assignees?: string[] }) => {
      const isKept = keep.project && String(p._id) === String(keep.project) && s.id === keep.stepId;
      if (isKept || s.status !== "doing" || !(s.assignees || []).includes(userId)) return s;
      changed = true;
      stopped.push(`“${s.title}”${p.theme || p.legacyName ? ` (${p.theme || p.legacyName})` : ""}`);
      return { ...s, status: "todo", updatedAt: now.toISOString() };
    });
    if (changed) await db.collection("projects").updateOne({ _id: p._id }, { $set: { steps, updatedAt: now } });
  }

  // Other samples I'm marked as working on.
  const samples = await db.collection("projects").find(
    { deleted: { $ne: true }, sample: true, workers: userId, ...(keep.project && !keep.stepId ? { _id: { $ne: keep.project } } : {}) },
    { projection: { theme: 1 } },
  ).toArray();
  if (samples.length) {
    await db.collection("projects").updateMany({ _id: { $in: samples.map((x) => x._id) } }, { $pull: { workers: userId } as never, $set: { updatedAt: now } });
    stopped.push(...samples.map((x) => `the sample${x.theme ? ` “${x.theme}”` : ""}`));
  }
  return stopped;
}
