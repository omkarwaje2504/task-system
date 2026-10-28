import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notify, projectLabel, watcherIds } from "@/lib/notify";
import { stopOtherWork } from "@/lib/working";
import { getProject } from "@/lib/projects";
import { cleanModule, languageProgress, stepPeople, uid, type LanguageRow, type ProjectStep, type StepStatus, type VoiceState } from "@/lib/workflow";

type Ctx = { params: Promise<{ id: string; stepId: string }> };

const cleanVoice = (v: Partial<VoiceState> | undefined): VoiceState => ({
  text: !!v?.text,
  audio: !!v?.audio,
  assignee: isId(v?.assignee) ? v!.assignee! : null,
});

function cleanLanguages(rows: unknown): LanguageRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && String(r.name || "").trim())
    .map((r) => ({ id: r.id || uid(), name: String(r.name).trim(), male: cleanVoice(r.male), female: cleanVoice(r.female) }));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id, stepId } = await params;
  if (!isId(id)) return bad("Project not found.", 404);
  const b = await req.json().catch(() => ({}));
  const db = await connectDB();
  const project = await db.collection("projects").findOne({ _id: oid(id), ...notDeleted });
  if (!project) return bad("Project not found.", 404);
  const steps: ProjectStep[] = project.steps || [];
  const step = steps.find((st) => st.id === stepId);
  if (!step) return bad("Step not found — refresh the page.", 404);

  const next: ProjectStep = { ...step, data: { ...step.data } };
  if (b.title !== undefined && String(b.title).trim()) next.title = String(b.title).trim();
  if (b.note !== undefined) next.note = String(b.note).slice(0, 4000);
  if (b.link !== undefined) next.link = String(b.link).trim();
  if (b.assignees !== undefined) next.assignees = Array.isArray(b.assignees) ? [...new Set<string>(b.assignees.filter(isId))] : [];
  if (b.dueDate !== undefined) next.dueDate = /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate || "") ? b.dueDate : null;
  if (b.module !== undefined) {
    const m = cleanModule(b.module);
    if (m) next.module = m;
    else delete next.module;
  }
  next.updatedAt = new Date().toISOString();

  if (b.data) {
    if (step.kind === "languages") {
      if (b.data.languages !== undefined) next.data.languages = cleanLanguages(b.data.languages);
      if (Array.isArray(b.data.voices)) {
        const voices = b.data.voices.filter((v: string) => v === "male" || v === "female");
        next.data.voices = voices.length ? voices : ["male", "female"];
      }
    }
    if (step.kind === "quantity") {
      if (b.data.unit !== undefined) next.data.unit = String(b.data.unit).trim() || "pcs";
      if (b.data.target !== undefined) next.data.target = Number(b.data.target) > 0 ? Number(b.data.target) : null;
    }
    if (step.kind === "printer" && b.data.printer !== undefined) {
      const printer = isId(b.data.printer) ? await db.collection("printers").findOne({ _id: oid(b.data.printer) }) : null;
      next.data.printer = printer ? String(printer._id) : null;
      next.data.printerName = printer?.name || "";
    }
  }

  // Language steps finish themselves once every voice has text + audio.
  let status: StepStatus | undefined = ["todo", "doing", "done"].includes(b.status) ? b.status : undefined;
  if (!status && step.kind === "languages" && b.data?.languages !== undefined) {
    const { done, total } = languageProgress(next.data);
    status = total > 0 && done === total ? "done" : done > 0 ? "doing" : "todo";
  }
  if (status && status !== step.status) {
    next.status = status;
    next.doneAt = status === "done" ? new Date().toISOString() : null;
    next.doneByName = status === "done" ? s.name : null;
    if (status === "done") await logActivity(db, s, "step.done", `finished “${next.title}”`, { project: project._id });
  }

  await db.collection("projects").updateOne(
    { _id: project._id, "steps.id": stepId },
    { $set: { "steps.$": next, updatedAt: new Date() }, ...(next.module ? { $addToSet: { modules: next.module } } : {}) },
  );

  // One "I'm working" at a time: marking this step clears my other marks (steps and samples).
  const stopped = next.status === "doing" && b.status === "doing" && (next.assignees || []).includes(s.id)
    ? await stopOtherWork(db, s.id, { project: project._id, stepId })
    : [];

  // Notifications: people newly put on the step; heads when someone starts or finishes it.
  const before = new Set(stepPeople(step));
  const added = (next.assignees || []).filter((a) => !before.has(a));
  const moved = status && status !== step.status && (status === "doing" || status === "done") ? status : null;
  if (added.length || moved) {
    const where = await projectLabel(db, project);
    const link = `/project/${project._id}`;
    if (added.length) await notify(db, s, added, { type: "step.assigned", title: `${s.name} assigned you a step`, body: `“${next.title}” — ${where}`, link, project: project._id });
    // Heads, the actor's team leads, and everyone else on this step.
    const watchers = moved ? await watcherIds(db, s, next.assignees || []) : [];
    if (moved === "doing") await notify(db, s, watchers, { type: "step.doing", title: `${s.name} is working on “${next.title}”`, body: where, link, project: project._id });
    if (moved === "done") await notify(db, s, watchers, { type: "step.done", title: `${s.name} finished “${next.title}”`, body: where, link, project: project._id });
  }
  return NextResponse.json({ ...(await getProject(db, project._id)), stopped });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id, stepId } = await params;
  if (!isId(id)) return bad("Project not found.", 404);
  const db = await connectDB();
  await db.collection("projects").updateOne(
    { _id: oid(id) },
    { $pull: { steps: { id: stepId } } as never, $set: { updatedAt: new Date() } },
  );
  await db.collection("progress").updateMany({ project: oid(id), stepId }, { $set: { deleted: true } });
  return NextResponse.json(await getProject(db, oid(id)));
}
