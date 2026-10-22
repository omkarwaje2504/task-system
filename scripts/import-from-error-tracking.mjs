// One-time (re-runnable) import from error-tracking-api's "task-tracker"
// database into this app's database. Only READS the old database.
//
//   node --env-file=.env scripts/import-from-error-tracking.mjs
//
// Imports: product types (+ default templates), users (same logins),
// companies, brands, printers, credentials, every project (all product
// types, reshaped into steps) with its tasks and daily counts, and the
// activity history. Discussions and old-only fields (link, client, sales /
// service person, attachments) are kept in the project notes. Re-running
// never overwrites edits made in the new system — existing documents are
// left alone ($setOnInsert); the only exception is filling an EMPTY step
// template / step list with the starter App, Website and Other steps.

import { MongoClient } from "mongodb";
import { DEFAULT_TYPES, stepsFromTemplate, uid } from "../lib/workflow.ts";

const SOURCE_DB = process.env.SOURCE_DB || "task-tracker";
const TARGET_DB = process.env.MONGODB_DB || "new-system";

const nameKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Old product type name → new name (merges duplicates like "E poster"/"Eposter").
const RENAME = {
  "rx-pad": "RxPad", "e-video": "EVideo", "ai-video": "AI Video",
  "e poster": "E-Poster", "eposter": "E-Poster",
};
const ICONS = {
  Reels: "film", "QR Poster": "qr", "Pledge Link": "link", Certificate: "award", PVR: "monitor",
  App: "smartphone", Website: "globe", Other: "box", "Bio-Video": "video", "Youtube video": "play",
  "NFC Card": "nfc", Game: "gamepad", Egreet: "mail", Caricature: "smile", "In-Out": "arrows",
  Box: "package", "E-Poster": "file-image",
};

// Starter step templates for old types that had none (admins can edit them
// on the Product Types page). Old projects only knew a "design" and a
// "development" stage, so those titles are what the stage mapping looks for.
const step = (title, kind = "check", hint = "") => ({ id: uid(), title, kind, hint });
const TEMPLATES = {
  App: [
    step("Requirements received", "check", "Collect the features, content and logins needed from the client."),
    step("Design", "check", "UI screens designed and approved."),
    step("Development"),
    step("Testing", "check", "Test on Android and iPhone before sharing."),
    step("Client approval"),
    step("Published", "link", "Paste the Play Store / App Store or download link."),
  ],
  Website: [
    step("Content & requirements received"),
    step("Design", "check", "Page designs approved."),
    step("Development"),
    step("Client approval"),
    step("Live", "link", "Paste the live website link."),
  ],
  Other: [
    step("Brief received"),
    step("Design", "check", "Design or production of the item."),
    step("Client approval"),
    step("Delivered"),
  ],
};

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const src = client.db(SOURCE_DB);
const db = client.db(TARGET_DB);
const now = new Date();
const log = (...a) => console.log("•", ...a);

async function upsert(col, _id, doc) {
  const r = await db.collection(col).updateOne({ _id }, { $setOnInsert: doc }, { upsert: true });
  return r.upsertedCount;
}

// ---- Product types --------------------------------------------------------
const typeBySlug = new Map();
async function ensureType(def, order) {
  const slug = slugify(def.name);
  let t = await db.collection("productTypes").findOne({ slug });
  if (!t) {
    const doc = {
      name: def.name, slug, icon: def.icon || "box",
      special: !!def.special, assetTab: !!def.assetTab, assetSlots: def.assetSlots || ["Cover", "Front", "Back"],
      steps: def.steps || [], order, deleted: false, createdAt: now, updatedAt: now,
    };
    const { insertedId } = await db.collection("productTypes").insertOne(doc);
    t = { _id: insertedId, ...doc };
  } else if (!t.steps?.length && def.steps?.length) {
    // Fill an empty template only — never replace one an admin has set up.
    await db.collection("productTypes").updateOne({ _id: t._id }, { $set: { steps: def.steps, updatedAt: now } });
    t = { ...t, steps: def.steps };
  }
  typeBySlug.set(slug, t);
  return t;
}
let order = 0;
for (const def of DEFAULT_TYPES) await ensureType(def, order++);
const oldTypes = await src.collection("productTypes").find({ deleted: { $ne: true } }).toArray();
for (const ot of oldTypes) {
  const name = RENAME[ot.name.trim().toLowerCase()] || ot.name.trim();
  if (typeBySlug.has(slugify(name))) continue;
  await ensureType({ name, icon: ICONS[name] || "box", steps: TEMPLATES[name] }, order++);
}
for (const name of Object.keys(TEMPLATES)) await ensureType({ name, icon: ICONS[name], steps: TEMPLATES[name] }, order++);
log(`product types: ${typeBySlug.size}`);

// ---- Users ----------------------------------------------------------------
const oldUsers = await src.collection("users").find({}).toArray();
const userName = new Map(oldUsers.map((u) => [String(u._id), u.name]));
let n = 0;
for (const u of oldUsers) {
  n += await upsert("users", u._id, {
    name: u.name, email: String(u.email).trim().toLowerCase(), mobile: u.mobile || "",
    password: u.password, role: u.role === "head" ? "admin" : "member", team: u.team || "",
    active: !u.deleted, deleted: !!u.deleted, importedFrom: SOURCE_DB,
    createdAt: u.createdAt || now, updatedAt: now,
  });
}
log(`users: ${n} new of ${oldUsers.length}`);

// ---- Companies & brands (deduped on a normalized name key) ----------------
const companyMap = new Map();
n = 0;
for (const c of await src.collection("companies").find({ deleted: { $ne: true } }).toArray()) {
  const key = nameKey(c.name);
  const existing = await db.collection("companies").findOne({ key, _id: { $ne: c._id } });
  if (existing) { companyMap.set(String(c._id), existing._id); continue; }
  n += await upsert("companies", c._id, { name: c.name.trim(), key, deleted: false, createdAt: c.createdAt || now, updatedAt: now });
  companyMap.set(String(c._id), c._id);
}
log(`companies: ${n} new`);

const brandMap = new Map();
n = 0;
for (const b of await src.collection("brands").find({ deleted: { $ne: true } }).toArray()) {
  const key = nameKey(b.name);
  const existing = await db.collection("brands").findOne({ key, _id: { $ne: b._id } });
  if (existing) { brandMap.set(String(b._id), existing._id); continue; }
  n += await upsert("brands", b._id, {
    name: b.name.trim(), key, company: b.company ? companyMap.get(String(b.company)) || null : null,
    deleted: false, createdAt: b.createdAt || now, updatedAt: now,
  });
  brandMap.set(String(b._id), b._id);
}
log(`brands: ${n} new`);

// ---- Printers & credentials (copied as-is; same CREDENTIALS_SECRET) --------
n = 0;
for (const p of await src.collection("printers").find({ deleted: { $ne: true } }).toArray()) n += await upsert("printers", p._id, p);
log(`printers: ${n} new`);
n = 0;
for (const c of await src.collection("credentials").find({ deleted: { $ne: true } }).toArray()) n += await upsert("credentials", c._id, c);
log(`credentials: ${n} new`);

// ---- Projects (every product type) + tasks + daily counts ---------------
// Old projects had loose "sections" and tasks; new ones follow their product
// type's step template. Completed projects get every step ticked; daily
// counts land on a quantity step (added to the project if its type has
// none); printing details go on the printer step.

async function typeFor(projectType) {
  const raw = String(projectType || "").trim();
  const name = raw ? RENAME[raw.toLowerCase()] || raw : "Other";
  return typeBySlug.get(slugify(name)) || ensureType({ name, icon: ICONS[name] || "box", steps: TEMPLATES[name] }, order++);
}

// Live projects can still point at a company/brand deleted in the old app.
async function companyFor(oldId) {
  if (!oldId) return null;
  if (companyMap.has(String(oldId))) return companyMap.get(String(oldId));
  const oc = await src.collection("companies").findOne({ _id: oldId });
  if (!oc) return null;
  const existing = await db.collection("companies").findOne({ key: nameKey(oc.name) });
  const id = existing?._id || oc._id;
  if (!existing) await upsert("companies", oc._id, { name: oc.name.trim(), key: nameKey(oc.name), deleted: false, createdAt: oc.createdAt || now, updatedAt: now });
  companyMap.set(String(oldId), id);
  return id;
}
async function brandFor(oldId) {
  if (!oldId) return null;
  if (brandMap.has(String(oldId))) return brandMap.get(String(oldId));
  const ob = await src.collection("brands").findOne({ _id: oldId });
  if (!ob) return null;
  const existing = await db.collection("brands").findOne({ key: nameKey(ob.name) });
  const id = existing?._id || ob._id;
  if (!existing) {
    await upsert("brands", ob._id, {
      name: ob.name.trim(), key: nameKey(ob.name), company: await companyFor(ob.company),
      deleted: false, createdAt: ob.createdAt || now, updatedAt: now,
    });
  }
  brandMap.set(String(oldId), id);
  return id;
}

const printerByKey = new Map((await db.collection("printers").find().toArray()).map((p) => [nameKey(p.name), p]));
const done = (s, at, extra = {}) => ({ ...s, ...extra, status: "done", doneAt: at.toISOString(), doneByName: "Imported" });
const nameOf = (id) => userName.get(String(id)) || "";
const fileList = (files) => (files || []).map((f) => `- ${f.name || "file"}: ${f.url || f.link || ""}`).join("\n");

const oldProjects = await src.collection("projects").find({ deleted: { $ne: true } }).toArray();
const allOldTasks = await src.collection("tasks").find({}).toArray();
const taskTitle = new Map(allOldTasks.map((t) => [String(t._id), t.title]));
let projectsNew = 0, projectsFilled = 0, tasksNew = 0, logsNew = 0;
for (const op of oldProjects) {
  const type = await typeFor(op.projectType);
  const brand = await brandFor(op.brand);
  const brandDoc = brand ? await db.collection("brands").findOne({ _id: brand }) : null;
  const company = (await companyFor(op.company)) || brandDoc?.company || null;
  const completed = op.status === "completed";
  const finishedAt = new Date(op.completedAt || op.updatedAt || now);

  // Old names were usually "<Brand> - RxPad"; drop a theme that only repeats the brand.
  let theme = String(op.name || "").trim();
  if (type.slug === "rxpad") theme = theme.replace(/[-–(]?\s*rx\s*-?\s*pa?d\s*\)?/gi, " ").replace(/[\s\-–()]+$/g, "").replace(/^[\s\-–()]+/g, "").replace(/\s+/g, " ").trim();
  if (brandDoc && theme && (nameKey(theme) === nameKey(brandDoc.name) || (type.slug === "rxpad" && (nameKey(theme).includes(nameKey(brandDoc.name)) || nameKey(brandDoc.name).includes(nameKey(theme)))))) theme = "";

  // Fields the new format has no place for are kept in the notes.
  const discussions = await src.collection("discussions").find({ project: op._id, deleted: { $ne: true } }).sort({ createdAt: 1 }).toArray();
  const notes = [
    op.description,
    op.link && `Link: ${op.link}`,
    op.client && `Client: ${op.client}`,
    op.salesPerson && `Sales: ${nameOf(op.salesPerson)}`,
    op.servicePerson && `Service: ${nameOf(op.servicePerson)}`,
    op.attachments?.length && `Attachments:\n${fileList(op.attachments)}`,
    discussions.length && `Discussion:\n${discussions.map((d) => `- ${nameOf(d.user)} (${new Date(d.createdAt).toISOString().slice(0, 10)}): ${d.message}${d.attachments?.length ? `\n${fileList(d.attachments)}` : ""}`).join("\n")}`,
  ].filter(Boolean).join("\n\n");

  const oldTasks = allOldTasks.filter((t) => String(t.project) === String(op._id) && !t.deleted);
  const tracked = oldTasks.filter((t) => t.trackProgress);
  const logs = await src.collection("progress").find({ task: { $in: oldTasks.map((t) => t._id) }, deleted: { $ne: true } }).toArray();

  let steps = stepsFromTemplate(type.steps || []);
  let q = steps.find((s) => s.kind === "quantity");
  if (!q && logs.length) {
    q = stepsFromTemplate([{ id: "", kind: "quantity", title: tracked.length === 1 ? tracked[0].title.trim() : "Daily count", hint: "Daily counts imported from the old tracker." }])[0];
    steps.push(q);
  }
  if (q && tracked.length) q.data.target = Number(tracked[0].target) || null;
  if (q) {
    const sum = (k) => logs.reduce((n, l) => n + (Number(l[k]) || 0), 0);
    q.data.totals = { added: sum("added"), completed: sum("completed"), declined: sum("declined") };
  }

  const prod = op.sections?.find((s) => s.type === "production")?.data;
  if (prod?.printerName) {
    if (!steps.some((s) => s.kind === "printer")) steps.push(...stepsFromTemplate([{ id: "", kind: "printer", title: "Printing" }]));
    const printer = printerByKey.get(nameKey(prod.printerName));
    steps = steps.map((s) => s.kind !== "printer" ? s : {
      ...s,
      status: prod.sendDate ? "done" : "doing",
      link: prod.fileSharedLink || "",
      note: [prod.quantity && `Quantity: ${prod.quantity}`, prod.printType && `Print type: ${prod.printType}`, prod.sendDate && `Sent: ${prod.sendDate}`, prod.otherInstructions].filter(Boolean).join("\n"),
      data: { ...s.data, printer: printer?._id || null, printerName: printer?.name || prod.printerName },
      ...(prod.sendDate ? { doneAt: new Date(prod.sendDate).toISOString(), doneByName: "Imported" } : {}),
    });
  }

  // Old "design" / "development" stage → that step is in progress, earlier ones done.
  const stages = new Set([op.currentStage, ...(op.sections || []).map((s) => s.type)].filter(Boolean));
  const stageAt = TEMPLATES[type.name]
    ? steps.findIndex((s) => s.title === (stages.has("development") ? "Development" : stages.has("design") ? "Design" : null))
    : -1;

  if (completed) steps = steps.map((s) => s.status === "done" ? s : done(s, finishedAt));
  else if (stageAt >= 0) {
    steps = steps.map((s, i) => i < stageAt && s.status === "todo" ? done(s, now) : i === stageAt && s.status === "todo" ? { ...s, status: "doing" } : s);
  } else if (q && logs.length) {
    // Production has started: on RxPad the steps before the count are done.
    const qi = steps.findIndex((s) => s.id === q.id);
    steps = steps.map((s, i) => {
      if (type.slug === "rxpad" && i < qi && s.status === "todo") return done(s, now);
      if (i === qi && s.status === "todo") return { ...s, status: "doing" };
      return s;
    });
  }

  const inserted = await upsert("projects", op._id, {
    productType: type._id, theme, legacyName: op.name, company, brand,
    deadline: op.deadline ? String(op.deadline).slice(0, 10) : null,
    notes, status: ["completed", "on-hold"].includes(op.status) ? op.status : "active", steps,
    createdBy: op.createdBy || null, createdByName: nameOf(op.createdBy),
    completedAt: completed ? finishedAt : null,
    importedFrom: SOURCE_DB, deleted: false, createdAt: op.createdAt || now, updatedAt: now,
  });
  projectsNew += inserted;
  // Imported earlier while its type had no template: give it the steps now.
  if (!inserted && steps.length) {
    const r = await db.collection("projects").updateOne({ _id: op._id, "steps.0": { $exists: false } }, { $set: { steps, updatedAt: now } });
    projectsFilled += r.modifiedCount;
  }
  // On a re-run the project already exists: attach logs to ITS quantity step.
  const qStepId = (await db.collection("projects").findOne({ _id: op._id })).steps.find((s) => s.kind === "quantity")?.id;

  for (const t of oldTasks) {
    const isDone = t.status !== "pending";
    const description = [t.description, t.attachments?.length && `Attachments:\n${fileList(t.attachments)}`].filter(Boolean).join("\n\n");
    tasksNew += await upsert("tasks", t._id, {
      // The new app has no sub-tasks, so a sub-task carries its parent's title.
      title: t.parentTask && taskTitle.has(String(t.parentTask)) ? `${taskTitle.get(String(t.parentTask)).trim()} › ${t.title.trim()}` : t.title.trim(),
      ...(description ? { description } : {}),
      assignees: t.assignedTo || [], project: op._id, dueDate: t.dueDate ? String(t.dueDate).slice(0, 10) : null,
      status: isDone ? "done" : "open", doneAt: isDone ? t.completedAt || t.updatedAt || now : null,
      createdBy: t.createdBy || null, createdByName: nameOf(t.createdBy),
      importedFrom: SOURCE_DB, deleted: false, createdAt: t.createdAt || now, updatedAt: now,
    });
  }
  if (!qStepId) continue;
  for (const l of logs) {
    const prefix = tracked.length > 1 ? `[${taskTitle.get(String(l.task))}] ` : "";
    logsNew += await upsert("progress", l._id, {
      project: op._id, stepId: qStepId, date: l.date,
      added: l.added || 0, completed: l.completed || 0, declined: l.declined || 0,
      note: (prefix + (l.note || "")).trim(), user: l.user || null, userName: nameOf(l.user),
      deleted: false, createdAt: l.createdAt || now,
    });
  }
}
log(`projects: ${projectsNew} new of ${oldProjects.length}${projectsFilled ? ` (${projectsFilled} given steps)` : ""} · tasks: ${tasksNew} new · daily logs: ${logsNew} new`);

// ---- Activity history ------------------------------------------------------
// Old messages start with the person's name; the new feed shows it separately.
const importedProjects = new Set(oldProjects.map((p) => String(p._id)));
const ops = [];
for (const a of await src.collection("activity").find({}).toArray()) {
  if (a.project && !importedProjects.has(String(a.project))) continue;
  const who = nameOf(a.user);
  const message = who && String(a.message).startsWith(`${who} `) ? String(a.message).slice(who.length + 1) : String(a.message);
  ops.push({ updateOne: { filter: { _id: a._id }, upsert: true, update: { $setOnInsert: {
    type: a.type, message, user: a.user || null, userName: who, project: a.project || null, task: a.task || null, createdAt: a.createdAt || now,
  } } } });
}
const actRes = ops.length ? await db.collection("activity").bulkWrite(ops, { ordered: false }) : { upsertedCount: 0 };
log(`activity: ${actRes.upsertedCount} new of ${ops.length}`);

// ---- Indexes --------------------------------------------------------------
await db.collection("users").createIndex({ email: 1 });
await db.collection("companies").createIndex({ key: 1 });
await db.collection("brands").createIndex({ key: 1 });
await db.collection("productTypes").createIndex({ slug: 1 });
await db.collection("projects").createIndex({ productType: 1, status: 1, createdAt: -1 });
await db.collection("tasks").createIndex({ assignees: 1, status: 1 });
await db.collection("tasks").createIndex({ project: 1 });
await db.collection("progress").createIndex({ project: 1, stepId: 1 });
await db.collection("assets").createIndex({ productType: 1, createdAt: -1 });
await db.collection("activity").createIndex({ createdAt: -1 });
log("indexes ready");

await client.close();
