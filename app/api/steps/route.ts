import { NextResponse } from "next/server";
import type { Document } from "mongodb";
import { connectDB, notDeleted, notSample } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PROJECT_LOOKUPS, TYPE_FIELDS } from "@/lib/projects";

/**
 * Steps across projects (steps are the tasks), for "My steps" and the dashboard.
 * ?mine=1  &status=open|done (default open)  &limit=500
 * Open steps only come from projects still running (active / on hold).
 */
export async function GET(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const params = new URL(req.url).searchParams;
  const done = params.get("status") === "done";
  const mine = params.get("mine") === "1";
  const limit = Math.min(500, Math.max(1, Number(params.get("limit")) || 500));

  const project: Document = { ...notDeleted, ...notSample, ...(done ? {} : { status: { $in: ["active", "on-hold"] } }) };
  const step: Document = { "steps.status": done ? "done" : { $ne: "done" } };
  if (mine) {
    project["steps.assignees"] = s.id;
    step["steps.assignees"] = s.id;
  }

  const db = await connectDB();
  const rows = await db.collection("projects").aggregate([
    { $match: project },
    { $unwind: { path: "$steps", includeArrayIndex: "index" } },
    { $match: step },
    // Open: soonest due first, undated last. Done: most recent first.
    ...(done
      ? [{ $sort: { "steps.doneAt": -1 } }]
      : [{ $addFields: { _due: { $ifNull: ["$steps.dueDate", "9999-12-31"] } } }, { $sort: { _due: 1, createdAt: -1, index: 1 } }]),
    { $limit: limit },
    ...PROJECT_LOOKUPS,
    {
      $project: {
        _id: 0, index: 1, step: "$steps",
        project: { _id: "$_id", theme: "$theme", legacyName: "$legacyName", status: "$status", deadline: "$deadline" },
        brand: { name: "$brand.name" }, ...TYPE_FIELDS,
      },
    },
  ]).toArray();
  return NextResponse.json(rows);
}
