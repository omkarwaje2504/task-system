import { NextResponse } from "next/server";
import { connectDB, notDeleted } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { resolveBrand, resolveCompany } from "@/lib/clients";

/** Brand ↔ company relation — feeds the typeahead on project/asset forms. */
export async function GET() {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const db = await connectDB();
  const brands = await db.collection("brands").aggregate([
    { $match: notDeleted },
    { $lookup: { from: "companies", localField: "company", foreignField: "_id", as: "company" } },
    { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
    { $project: { name: 1, "company._id": 1, "company.name": 1 } },
    { $sort: { name: 1 } },
  ]).toArray();
  return NextResponse.json(brands);
}

export async function POST(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { name, company } = await req.json().catch(() => ({}));
  if (!String(name || "").trim()) return bad("Name is required.");
  const db = await connectDB();
  const companyId = await resolveCompany(db, company);
  const { brand } = await resolveBrand(db, name, companyId);
  return NextResponse.json(await db.collection("brands").findOne({ _id: brand! }));
}
