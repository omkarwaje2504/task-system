import { NextResponse } from "next/server";
import type { Document } from "mongodb";
import { connectDB, escapeRegex, isId, notDeleted, notSample, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { resolveBrand, resolveCompany } from "@/lib/clients";
import { logActivity } from "@/lib/activity";
import { PROJECT_LOOKUPS, TYPE_FIELDS } from "@/lib/projects";
import { stepsFromTemplate, type StepTemplate } from "@/lib/workflow";

/**
 * ?type=all | others | <product type slug>
 * ?status=active | completed | on-hold | all   (default active)
 * ?q=search text
 */
export async function GET(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const db = await connectDB();
  const params = new URL(req.url).searchParams;
  const type = params.get("type") || "all";
  const status = params.get("status") || "active";
  const q = (params.get("q") || "").trim();

  const match: Document = { ...notDeleted, ...notSample };
  if (status !== "all") match.status = status;
  if (type === "others") {
    const special = await db.collection("productTypes").find({ special: true, ...notDeleted }).project({ _id: 1 }).toArray();
    match.productType = { $nin: special.map((t) => t._id) };
  } else if (type !== "all") {
    const t = await db.collection("productTypes").findOne({ slug: type, ...notDeleted });
    if (!t) return NextResponse.json([]);
    match.productType = t._id;
  }

  const pipeline: Document[] = [{ $match: match }, ...PROJECT_LOOKUPS];
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: "i" };
    pipeline.push({ $match: { $or: [{ theme: rx }, { "brand.name": rx }, { "company.name": rx }, { "type.name": rx }] } });
  }
  pipeline.push(
    { $lookup: { from: "projectFiles", let: { p: "$_id" }, pipeline: [{ $match: { $expr: { $eq: ["$project", "$$p"] }, deleted: { $ne: true } } }, { $count: "n" }], as: "fileCount" } },
    {
      $lookup: {
        from: "projectFiles", let: { p: "$_id" }, as: "cover",
        pipeline: [
          { $match: { $expr: { $eq: ["$project", "$$p"] }, deleted: { $ne: true }, thumb: { $ne: null } } },
          { $sort: { final: -1, createdAt: -1 } },
          { $limit: 1 },
          { $project: { name: 1, title: 1, thumb: 1, kind: 1, final: 1 } },
        ],
      },
    },
    {
      $project: {
        theme: 1, deadline: 1, status: 1, createdAt: 1, updatedAt: 1, completedAt: 1, legacyName: 1, priority: 1,
        // Steps are the tasks: enough of each for the table and the hover card.
        "steps.id": 1, "steps.title": 1, "steps.status": 1, "steps.kind": 1, "steps.assignees": 1, "steps.dueDate": 1,
        "steps.note": 1, "steps.doneAt": 1, "steps.doneByName": 1, "steps.updatedAt": 1, "steps.createdAt": 1,
        // Enough step data for the list's count column (daily totals / videos done).
        "steps.data.totals": 1, "steps.data.target": 1, "steps.data.unit": 1, "steps.data.voices": 1, "steps.data.languages": 1,
        ...TYPE_FIELDS, "brand._id": 1, "brand.name": 1, "company._id": 1, "company.name": 1,
        fileCount: { $ifNull: [{ $arrayElemAt: ["$fileCount.n", 0] }, 0] },
        cover: { $arrayElemAt: ["$cover", 0] },
        notes: 1,
      },
    },
    { $sort: status === "completed" ? { completedAt: -1, updatedAt: -1 } : { createdAt: -1 } },
  );
  return NextResponse.json(await db.collection("projects").aggregate(pipeline).toArray());
}

export async function POST(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const b = await req.json().catch(() => ({}));
  if (!isId(b.productType)) return bad("Pick a product type.");
  const db = await connectDB();
  const type = await db.collection("productTypes").findOne({ _id: oid(b.productType), ...notDeleted });
  if (!type) return bad("That product type no longer exists.");

  const companyId = await resolveCompany(db, b.companyName);
  const { brand, company } = await resolveBrand(db, b.brandName, companyId);
  const languages = Array.isArray(b.languages)
    ? [...new Set<string>(b.languages.map((l: unknown) => String(l).trim()).filter(Boolean))]
    : [];

  const now = new Date();
  const doc = {
    productType: type._id,
    theme: String(b.theme || "").trim(),
    company,
    brand,
    deadline: b.deadline || null,
    notes: String(b.notes || "").trim(),
    status: "active",
    // useTemplate: false → start empty and add tasks one by one.
    steps: b.useTemplate === false ? [] : stepsFromTemplate((type.steps || []) as StepTemplate[], { languages }),
    createdBy: oid(s.id),
    createdByName: s.name,
    completedAt: null,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await db.collection("projects").insertOne(doc);
  const brandName = brand ? (await db.collection("brands").findOne({ _id: brand }))?.name : "";
  await logActivity(db, s, "project.created", `started a new ${type.name} project${brandName ? ` for ${brandName}` : ""}`, { project: insertedId });
  return NextResponse.json({ _id: insertedId, ...doc });
}
