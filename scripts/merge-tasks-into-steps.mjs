// Steps are the tasks. Moves every task into its project as a step (after the
// steps already there, oldest task first; done tasks become ticked steps) and
// turns the old single step `assignee` into an `assignees` list.
// Steps whose task was later finished in the old tracker get ticked too.
// Re-runnable: merged tasks are marked (mergedAt) and never merged twice; the
// `tasks` collection itself is left in place as a record.
//
//   node --env-file=.env scripts/merge-tasks-into-steps.mjs          # merge
//   node --env-file=.env scripts/merge-tasks-into-steps.mjs --dry    # only report
//
// import-from-error-tracking.mjs runs this at the end, so imports land as steps.

import { MongoClient } from "mongodb";
import { uid } from "../lib/workflow.ts";

const DRY = process.argv.includes("--dry");
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "new-system");
const projects = db.collection("projects");
const iso = (d) => (d ? new Date(d).toISOString() : null);
const now = new Date();

// ---- 1. One assignee → a list of people, and a due date on every step ------
let stepsFixed = 0;
for (const p of await projects.find({ "steps.0": { $exists: true } }).toArray()) {
  let changed = false;
  const steps = p.steps.map((s) => {
    if (Array.isArray(s.assignees) && "dueDate" in s && !("assignee" in s)) return s;
    changed = true;
    stepsFixed++;
    const { assignee, ...rest } = s;
    return { ...rest, assignees: Array.isArray(s.assignees) ? s.assignees : assignee ? [String(assignee)] : [], dueDate: s.dueDate ?? null };
  });
  if (changed && !DRY) await projects.updateOne({ _id: p._id }, { $set: { steps } });
}
console.log(`• steps given a people list: ${stepsFixed}`);

// ---- 2. Tasks → steps --------------------------------------------------------
const tasks = await db.collection("tasks")
  .find({ deleted: { $ne: true }, mergedAt: { $exists: false }, project: { $ne: null } })
  .sort({ createdAt: 1 })
  .toArray();
const byProject = new Map();
for (const t of tasks) {
  const k = String(t.project);
  if (!byProject.has(k)) byProject.set(k, []);
  byProject.get(k).push(t);
}

let merged = 0, skipped = 0;
for (const [pid, list] of byProject) {
  const p = await projects.findOne({ _id: list[0].project, deleted: { $ne: true } }, { projection: { steps: 1 } });
  if (!p) { skipped += list.length; continue; } // project deleted — leave the task alone
  const already = new Set((p.steps || []).map((s) => s.fromTask).filter(Boolean));
  const steps = list.filter((t) => !already.has(String(t._id))).map((t) => {
    const done = t.status === "done";
    return {
      id: uid(), title: String(t.title || "Task").trim(), hint: "", kind: "check",
      status: done ? "done" : "todo",
      assignees: (t.assignees || []).map(String),
      dueDate: t.dueDate ? String(t.dueDate).slice(0, 10) : null,
      note: t.description || "", link: "",
      doneAt: done ? iso(t.doneAt || t.updatedAt || now) : null,
      doneByName: done ? "Imported" : null,
      data: {},
      createdByName: t.createdByName || "",
      createdAt: iso(t.createdAt || now),
      // Not the import time: when the work actually last moved.
      updatedAt: iso(t.doneAt || t.createdAt || now),
      fromTask: String(t._id),
    };
  });
  if (!DRY) {
    if (steps.length) await projects.updateOne({ _id: p._id }, { $push: { steps: { $each: steps } } });
    await db.collection("tasks").updateMany({ _id: { $in: list.map((t) => t._id) } }, { $set: { mergedAt: now, mergedInto: pid } });
  }
  merged += steps.length;
}
console.log(`• tasks merged into steps: ${merged}${skipped ? ` · ${skipped} skipped (project deleted)` : ""}${DRY ? " (dry run — nothing written)" : ""}`);

// ---- 3. Tasks finished in the old tracker after they were merged ------------
// Only moves forward: a step still open gets ticked; a done step is never re-opened.
// Only for tasks finished AFTER they were merged, on steps nobody has touched here
// since — so a step someone re-opened in this app stays open.
const finished = (await db.collection("tasks").find({ mergedAt: { $exists: true }, status: "done", deleted: { $ne: true } }).toArray())
  // updatedAt: when the import recorded the finish here (the old completion time can predate the merge).
  .filter((t) => t.updatedAt && new Date(t.updatedAt) > new Date(t.mergedAt));
const doneTask = new Map(finished.map((t) => [String(t._id), t]));
let ticked = 0;
for (const p of await projects.find({ "steps.fromTask": { $in: [...doneTask.keys()] } }).toArray()) {
  let changed = false;
  const steps = p.steps.map((s) => {
    const t = s.fromTask && doneTask.get(s.fromTask);
    if (!t || s.status === "done") return s;
    if (s.updatedAt && new Date(s.updatedAt) > new Date(t.mergedAt)) return s; // edited here since the merge
    changed = true;
    ticked++;
    const at = iso(t.doneAt || now);
    return { ...s, status: "done", doneAt: at, doneByName: "Imported", updatedAt: at };
  });
  if (changed && !DRY) await projects.updateOne({ _id: p._id }, { $set: { steps } });
}
console.log(`• steps ticked because their task was finished in the old tracker: ${ticked}`);

await client.close();
