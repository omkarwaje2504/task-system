import { NextResponse } from "next/server";
import type { Document } from "mongodb";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { resolveBrand, resolveCompany } from "@/lib/clients";
import { logActivity } from "@/lib/activity";
import { PROJECT_LOOKUPS, TYPE_FIELDS } from "@/lib/projects";
import { OPEN_STATUSES } from "@/lib/samples";

/** ?status=open (requested / working / sent) | converted | declined | all */
export async function GET(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const status = new URL(req.url).searchParams.get("status") || "open";
  // Everything that started as a sample keeps its sampleStatus — converted ones are
  // projects now (sample flag removed) but still show here under "Became a project".
  const match: Document = { ...notDeleted, sampleStatus: { $exists: true } };
  if (status === "open") match.sampleStatus = { $in: OPEN_STATUSES };
  else if (status !== "all") match.sampleStatus = status;

  const db = await connectDB();
  const rows = await db.collection("projects").aggregate([
    { $match: match },
    ...PROJECT_LOOKUPS,
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
        theme: 1, notes: 1, sample: 1, sampleStatus: 1, workers: 1, workingSince: 1, priority: 1, convertedAt: 1,
        createdBy: 1, createdByName: 1, createdAt: 1, updatedAt: 1,
        ...TYPE_FIELDS, "brand._id": 1, "brand.name": 1, "company._id": 1, "company.name": 1,
        fileCount: { $ifNull: [{ $arrayElemAt: ["$fileCount.n", 0] }, 0] },
        cover: { $arrayElemAt: ["$cover", 0] },
      },
    },
    { $sort: { priority: -1, updatedAt: -1 } },
  ]).toArray();
  return NextResponse.json(rows);
}

/** { productType, theme?, companyName?, brandName?, notes? } */
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

  const now = new Date();
  const doc = {
    sample: true,
    sampleStatus: "requested",
    workers: [] as string[],
    productType: type._id,
    theme: String(b.theme || "").trim(),
    company,
    brand,
    notes: String(b.notes || "").trim(),
    deadline: null,
    status: "active",
    steps: [],
    createdBy: oid(s.id),
    createdByName: s.name,
    completedAt: null,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await db.collection("projects").insertOne(doc);
  await logActivity(db, s, "sample.created", `added a ${type.name} sample request`, { project: insertedId });
  return NextResponse.json({ _id: insertedId, ...doc });
}
