import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { cleanModule } from "@/lib/workflow";

// IT projects: modules (pages / parts / sections) that group a project's tasks.
// Tasks point at their module by name; `project.modules` keeps the order.

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!isId(id)) return null;
  const db = await connectDB();
  const p = await db.collection("projects").findOne({ _id: oid(id), ...notDeleted });
  return p ? { db, p } : null;
}

/** Add a module: { name } */
export async function POST(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const found = await load((await params).id);
  if (!found) return bad("Project not found.", 404);
  const name = cleanModule((await req.json().catch(() => ({}))).name);
  if (!name) return bad("Give the module a name.");
  const { db, p } = found;
  if ((p.modules || []).some((m: string) => m.toLowerCase() === name.toLowerCase())) return bad("This project already has that module.");
  await db.collection("projects").updateOne({ _id: p._id }, { $push: { modules: name } as never, $set: { updatedAt: new Date() } });
  return NextResponse.json(await getProject(db, p._id));
}

/** Rename (its tasks move with it) or reorder: { from, to } | { order: [names] } */
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const found = await load((await params).id);
  if (!found) return bad("Project not found.", 404);
  const { db, p } = found;
  const b = await req.json().catch(() => ({}));
  const modules: string[] = p.modules || [];

  if (Array.isArray(b.order)) {
    const order = b.order.map(cleanModule).filter((m: string) => modules.includes(m));
    if (order.length !== modules.length) return bad("Module list is out of date — refresh and try again.", 409);
    await db.collection("projects").updateOne({ _id: p._id }, { $set: { modules: order, updatedAt: new Date() } });
    return NextResponse.json(await getProject(db, p._id));
  }

  const from = cleanModule(b.from);
  const to = cleanModule(b.to);
  if (!from || !to) return bad("Give the module a name.");
  if (from !== to && modules.some((m) => m.toLowerCase() === to.toLowerCase() && m !== from)) return bad("This project already has that module.");
  const steps = (p.steps || []).map((st: { module?: string }) => (st.module === from ? { ...st, module: to } : st));
  await db.collection("projects").updateOne(
    { _id: p._id },
    { $set: { modules: modules.map((m) => (m === from ? to : m)), steps, updatedAt: new Date() } },
  );
  return NextResponse.json(await getProject(db, p._id));
}

/** Remove a module: ?name=…  Its tasks stay, under "General". */
export async function DELETE(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const found = await load((await params).id);
  if (!found) return bad("Project not found.", 404);
  const { db, p } = found;
  const name = cleanModule(new URL(req.url).searchParams.get("name"));
  const steps = (p.steps || []).map((st: { module?: string }) => {
    if (st.module !== name) return st;
    const { module: _m, ...rest } = st; // eslint-disable-line @typescript-eslint/no-unused-vars
    return rest;
  });
  await db.collection("projects").updateOne(
    { _id: p._id },
    { $set: { modules: (p.modules || []).filter((m: string) => m !== name), steps, updatedAt: new Date() } },
  );
  return NextResponse.json(await getProject(db, p._id));
}
