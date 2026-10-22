import { NextResponse } from "next/server";
import { connectDB, notDeleted, oid } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PROJECT_LOOKUPS, TYPE_FIELDS } from "@/lib/projects";

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function GET() {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const db = await connectDB();
  const me = oid(s.id);
  const now = new Date();
  const today = day(now);
  const weekAhead = day(new Date(now.getTime() + 7 * 864e5));
  const monthAgo = new Date(now.getTime() - 30 * 864e5);
  const active = { ...notDeleted, status: "active" };
  const projects = db.collection("projects");

  const [activeCount, dueSoon, overdue, completed30, myOpenTasks, myTasks, mySteps, upcoming, byType, activity] = await Promise.all([
    projects.countDocuments(active),
    projects.countDocuments({ ...active, deadline: { $gte: today, $lte: weekAhead } }),
    projects.countDocuments({ ...active, deadline: { $lt: today, $ne: null } }),
    projects.countDocuments({ ...notDeleted, status: "completed", completedAt: { $gte: monthAgo } }),
    db.collection("tasks").countDocuments({ ...notDeleted, assignees: me, status: { $ne: "done" } }),
    db.collection("tasks").aggregate([
      { $match: { ...notDeleted, assignees: me, status: { $ne: "done" } } },
      { $sort: { dueDate: 1, createdAt: -1 } },
      { $limit: 8 },
      { $lookup: { from: "projects", localField: "project", foreignField: "_id", as: "p" } },
      { $lookup: { from: "brands", localField: "p.brand", foreignField: "_id", as: "b" } },
      { $lookup: { from: "productTypes", localField: "p.productType", foreignField: "_id", as: "t" } },
      {
        $project: {
          title: 1, dueDate: 1, status: 1, project: 1, assignees: 1,
          brandName: { $arrayElemAt: ["$b.name", 0] }, theme: { $arrayElemAt: ["$p.theme", 0] },
          typeName: { $arrayElemAt: ["$t.name", 0] }, typeIcon: { $arrayElemAt: ["$t.icon", 0] },
        },
      },
    ]).toArray(),
    projects.aggregate([
      { $match: { ...active, "steps.assignee": s.id } },
      { $unwind: "$steps" },
      { $match: { "steps.assignee": s.id, "steps.status": { $ne: "done" } } },
      ...PROJECT_LOOKUPS,
      { $project: { theme: 1, deadline: 1, step: "$steps", ...TYPE_FIELDS, "brand.name": 1 } },
      { $limit: 8 },
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
  ]);

  return NextResponse.json({
    stats: { active: activeCount, dueSoon, overdue, completed30, myOpenTasks },
    myTasks, mySteps, upcoming, byType, activity,
  });
}
