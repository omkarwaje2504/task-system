import { NextResponse } from "next/server";
import type { Document } from "mongodb";
import { connectDB, notDeleted, notSample } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PROJECT_LOOKUPS, TYPE_FIELDS } from "@/lib/projects";

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function GET() {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const db = await connectDB();
  const now = new Date();
  const today = day(now);
  const weekAhead = day(new Date(now.getTime() + 7 * 864e5));
  const monthAgo = new Date(now.getTime() - 30 * 864e5);
  const active = { ...notDeleted, ...notSample, status: "active" };
  const projects = db.collection("projects");

  // Steps are the tasks: "mine" = unfinished steps assigned to me in running projects.
  const running = { ...notDeleted, ...notSample, status: { $in: ["active", "on-hold"] }, "steps.assignees": s.id };
  const myOpen = [{ $unwind: "$steps" }, { $match: { "steps.assignees": s.id, "steps.status": { $ne: "done" } } }];

  const [activeCount, dueSoon, overdue, completed30, myOpenCount, mySteps, upcoming, byType, activity, workload, people, sampleWork] = await Promise.all([
    projects.countDocuments(active),
    projects.countDocuments({ ...active, deadline: { $gte: today, $lte: weekAhead } }),
    projects.countDocuments({ ...active, deadline: { $lt: today, $ne: null } }),
    projects.countDocuments({ ...notDeleted, ...notSample, status: "completed", completedAt: { $gte: monthAgo } }),
    projects.aggregate([{ $match: running }, ...myOpen, { $count: "n" }]).toArray(),
    projects.aggregate([
      { $match: running },
      ...myOpen,
      { $addFields: { _due: { $ifNull: ["$steps.dueDate", "9999-12-31"] } } },
      { $sort: { _due: 1, createdAt: -1 } },
      { $limit: 8 },
      ...PROJECT_LOOKUPS,
      // Same shape as /api/steps rows, so both use one row component.
      {
        $project: {
          _id: 0, step: "$steps",
          project: { _id: "$_id", theme: "$theme", legacyName: "$legacyName", status: "$status", deadline: "$deadline" },
          brand: { name: "$brand.name" }, ...TYPE_FIELDS,
        },
      },
    ]).toArray(),
    projects.aggregate([
      { $match: { ...active, deadline: { $ne: null } } },
      { $sort: { deadline: 1 } },
      { $limit: 6 },
      ...PROJECT_LOOKUPS,
      { $project: { theme: 1, deadline: 1, "steps.status": 1, "steps.title": 1, ...TYPE_FIELDS, "brand.name": 1, "company.name": 1 } },
    ]).toArray(),
    projects.aggregate([
      { $match: active },
      { $group: { _id: "$productType", count: { $sum: 1 } } },
      { $lookup: { from: "productTypes", localField: "_id", foreignField: "_id", as: "type" } },
      { $unwind: "$type" },
      { $project: { count: 1, name: "$type.name", slug: "$type.slug", icon: "$type.icon", special: "$type.special" } },
      { $sort: { count: -1 } },
    ]).toArray(),
    db.collection("activity").find({}).sort({ createdAt: -1 }).limit(12).toArray(),
    // Who's working on what: steps people marked "I'm doing" (in progress), per person,
    // with each person's open / overdue counts alongside.
    projects.aggregate([
      { $match: { ...notDeleted, ...notSample, status: { $in: ["active", "on-hold"] }, "steps.assignees.0": { $exists: true } } },
      { $unwind: "$steps" },
      { $match: { "steps.status": { $ne: "done" }, "steps.assignees.0": { $exists: true } } },
      ...PROJECT_LOOKUPS,
      { $unwind: "$steps.assignees" },
      {
        $project: {
          person: "$steps.assignees",
          item: {
            step: { id: "$steps.id", title: "$steps.title", status: "$steps.status", dueDate: "$steps.dueDate", note: "$steps.note", updatedAt: "$steps.updatedAt", module: "$steps.module" },
            // This person pressed "I'm working" (older steps without the list: everyone on an in-progress step).
            on: { $cond: [{ $isArray: "$steps.working" }, { $in: ["$steps.assignees", "$steps.working"] }, { $eq: ["$steps.status", "doing"] }] },
            project: { _id: "$_id", theme: "$theme", legacyName: "$legacyName" },
            brand: "$brand.name", typeIcon: "$type.icon", typeName: "$type.name",
          },
        },
      },
      // Most recently touched first, so each person's list starts with their latest update.
      { $sort: { "item.step.updatedAt": -1 } },
      {
        $group: {
          _id: "$person",
          open: { $sum: 1 },
          overdue: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$item.step.dueDate", null] }, null] }, { $lt: ["$item.step.dueDate", today] }] }, 1, 0] } },
          items: { $push: "$item" },
        },
      },
      {
        $project: {
          open: 1, overdue: 1,
          doing: { $slice: [{ $filter: { input: "$items", cond: "$$this.on" } }, 5] },
        },
      },
    ]).toArray(),
    db.collection("users").find({ ...notDeleted, active: { $ne: false } }, { projection: { name: 1, team: 1 } }).sort({ name: 1 }).toArray(),
    // Samples people marked "I'm working" on.
    projects.aggregate([
      { $match: { ...notDeleted, sample: true, "workers.0": { $exists: true } } },
      ...PROJECT_LOOKUPS,
      { $project: { theme: 1, notes: 1, workers: 1, workingSince: 1, updatedAt: 1, brand: "$brand.name", typeIcon: "$type.icon", typeName: "$type.name" } },
    ]).toArray(),
  ]);

  // Samples as work items, shaped like steps so the panel lists them the same way.
  const sampleItems = new Map<string, Document[]>();
  for (const x of sampleWork) {
    const since = new Date(x.workingSince || x.updatedAt || 0).toISOString();
    const item = {
      sample: true,
      step: { id: "sample", title: [x.brand, x.theme].filter(Boolean).join(" — ") || `${x.typeName || ""} sample`, status: "doing", dueDate: null, note: x.notes, updatedAt: since },
      project: { _id: x._id, theme: x.theme },
      typeIcon: x.typeIcon, typeName: x.typeName,
    };
    for (const id of x.workers as string[]) sampleItems.set(id, [...(sampleItems.get(id) || []), item]);
  }

  // Only people who are on something right now (pressed "I'm doing"), most recently active first.
  const names = new Map(people.map((u) => [String(u._id), u]));
  const loads = new Map(workload.map((w) => [String(w._id), w]));
  const latest = (items: Document[]) => String(items[0]?.step.updatedAt || "");
  const team = [...new Set([...loads.keys(), ...sampleItems.keys()])]
    .filter((id) => names.has(id))
    .map((id) => {
      const u = names.get(id)!;
      const w = loads.get(id);
      const doing = [...(sampleItems.get(id) || []), ...(w?.doing || [])].sort((a, b) => String(b.step.updatedAt || "").localeCompare(String(a.step.updatedAt || ""))).slice(0, 5);
      return { id, name: u.name, team: u.team || "", open: w?.open || 0, overdue: w?.overdue || 0, doing };
    })
    .filter((m) => m.doing.length)
    .sort((a, b) => latest(b.doing).localeCompare(latest(a.doing)));

  return NextResponse.json({
    stats: { active: activeCount, dueSoon, overdue, completed30, myOpenSteps: myOpenCount[0]?.n || 0 },
    mySteps, upcoming, byType, activity, team,
  });
}
