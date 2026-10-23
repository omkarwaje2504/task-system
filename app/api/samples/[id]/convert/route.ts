import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { stepsFromTemplate, type StepTemplate } from "@/lib/workflow";

type Ctx = { params: Promise<{ id: string }> };

/**
 * The client went ahead: the sample becomes a real project (same id, so its
 * files and history come along). { useTemplate?: boolean = true, deadline? }
 */
export async function POST(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Sample not found.", 404);
  const b = await req.json().catch(() => ({}));
  const db = await connectDB();
  const p = await db.collection("projects").findOne({ _id: oid(id), ...notDeleted, sample: true });
  if (!p) return bad("Sample not found — it may already be a project.", 404);
  const type = await db.collection("productTypes").findOne({ _id: p.productType });

  const now = new Date();
  await db.collection("projects").updateOne({ _id: p._id }, {
    $set: {
      sample: false,
      sampleStatus: "converted",
      convertedAt: now,
      status: "active",
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(b.deadline || "") ? b.deadline : null,
      steps: b.useTemplate === false || !type ? [] : stepsFromTemplate((type.steps || []) as StepTemplate[]),
      requestedAt: p.createdAt, // when the sample was asked for
      createdAt: now, // counts as a new project from today
      updatedAt: now,
    },
  });
  await logActivity(db, s, "sample.converted", `turned a ${type?.name || ""} sample into a project`.replace("  ", " "), { project: p._id });
  return NextResponse.json({ _id: p._id });
}
