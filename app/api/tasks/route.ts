import { NextResponse } from "next/server";
import type { Document } from "mongodb";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter(isId))].map(oid) : []);

/** ?mine=1 &project=<id> &status=open|done|all (default open) */
export async function GET(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const params = new URL(req.url).searchParams;
  const status = params.get("status") || "open";
  const match: Document = { ...notDeleted };
  if (params.get("mine") === "1") match.assignees = oid(s.id);
  const project = params.get("project");
  if (isId(project)) match.project = oid(project);
  if (status === "open") match.status = { $ne: "done" };
  else if (status === "done") match.status = "done";

  const db = await connectDB();
  const tasks = await db.collection("tasks").aggregate([
    { $match: match },
    { $sort: status === "done" ? { doneAt: -1 } : { dueDate: 1, createdAt: -1 } },
    { $limit: 500 },
    { $lookup: { from: "projects", localField: "project", foreignField: "_id", as: "project" } },
    { $unwind: { path: "$project", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "brands", localField: "project.brand", foreignField: "_id", as: "brand" } },
    { $lookup: { from: "productTypes", localField: "project.productType", foreignField: "_id", as: "type" } },
    {
      $project: {
        title: 1, status: 1, assignees: 1, dueDate: 1, createdAt: 1, doneAt: 1, createdByName: 1,
        "project._id": 1, "project.theme": 1,
        brandName: { $arrayElemAt: ["$brand.name", 0] },
        typeName: { $arrayElemAt: ["$type.name", 0] },
        typeIcon: { $arrayElemAt: ["$type.icon", 0] },
      },
    },
  ]).toArray();
  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const b = await req.json().catch(() => ({}));
  const title = String(b.title || "").trim();
  if (!title) return bad("Write what needs to be done.");
  const now = new Date();
  const doc = {
    title,
    assignees: ids(b.assignees),
    project: isId(b.project) ? oid(b.project) : null,
    dueDate: b.dueDate || null,
    status: "open",
    createdBy: oid(s.id),
    createdByName: s.name,
    doneAt: null,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
  const db = await connectDB();
  const { insertedId } = await db.collection("tasks").insertOne(doc);
  await logActivity(db, s, "task.created", `added a task “${title}”`, { project: doc.project ?? undefined, task: insertedId });
  return NextResponse.json({ _id: insertedId, ...doc });
}
