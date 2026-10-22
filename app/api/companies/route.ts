import { NextResponse } from "next/server";
import { connectDB, notDeleted } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { resolveCompany } from "@/lib/clients";

export async function GET() {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const db = await connectDB();
  const companies = await db.collection("companies").aggregate([
    { $match: notDeleted },
    {
      $lookup: {
        from: "brands",
        let: { c: "$_id" },
        pipeline: [{ $match: { $expr: { $eq: ["$company", "$$c"] }, deleted: { $ne: true } } }, { $project: { name: 1 } }],
        as: "brands",
      },
    },
    { $project: { name: 1, brands: 1, createdAt: 1 } },
    { $sort: { name: 1 } },
  ]).toArray();
  return NextResponse.json(companies);
}

export async function POST(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { name } = await req.json().catch(() => ({}));
  if (!String(name || "").trim()) return bad("Name is required.");
  const db = await connectDB();
  const id = await resolveCompany(db, name);
  return NextResponse.json(await db.collection("companies").findOne({ _id: id! }));
}
