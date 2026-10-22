// One-time (re-runnable) import from error-tracking-api's "task-tracker"
// database into this app's database. Only READS the old database.
//
//   node --env-file=.env scripts/import-from-error-tracking.mjs
//
// Imports: product types (+ default templates), users (same logins),
// companies, brands, printers, credentials, and every RxPad project with
// its tasks and daily counts. Re-running never overwrites edits made in the
// new system — existing documents are left alone ($setOnInsert).

import { MongoClient } from "mongodb";
import { DEFAULT_TYPES, stepsFromTemplate } from "../lib/workflow.ts";

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
  await ensureType({ name, icon: ICONS[name] || "box" }, order++);
}
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

// ---- RxPad projects + tasks + daily counts --------------------------------
const rxType = typeBySlug.get("rxpad");
const rxProjects = await src.collection("projects").find({ projectType: /^rx-?pad$/i, deleted: { $ne: true } }).toArray();
let projectsNew = 0, tasksNew = 0, logsNew = 0;
for (const op of rxProjects) {
  const brand = op.brand ? brandMap.get(String(op.brand)) || null : null;
  const brandDoc = brand ? await db.collection("brands").findOne({ _id: brand }) : null;
  const company = op.company ? companyMap.get(String(op.company)) || null : brandDoc?.company || null;
  const theme = String(op.name || "").replace(/[-–(]?\s*rx\s*-?\s*pa?d\s*\)?/gi, " ").replace(/[\s\-–()]+$/g, "").replace(/^[\s\-–()]+/g, "").replace(/\s+/g, " ").trim();
  const inserted = await upsert("projects", op._id, {
    productType: rxType._id,
    // Old names were usually "<Brand> - RxPad"; drop a theme that only repeats the brand.
    theme: brandDoc && (nameKey(theme).includes(nameKey(brandDoc.name)) || nameKey(brandDoc.name).includes(nameKey(theme))) ? "" : theme,
    legacyName: op.name,
    company, brand,
    deadline: op.deadline ? String(op.deadline).slice(0, 10) : null,
    notes: op.description || "",
    status: op.status === "completed" ? "completed" : "active",
    steps: stepsFromTemplate(rxType.steps),
    createdBy: op.createdBy || null,
    createdByName: userName.get(String(op.createdBy)) || "",
    completedAt: op.status === "completed" ? op.updatedAt || now : null,
    importedFrom: SOURCE_DB,
    deleted: false,
    createdAt: op.createdAt || now,
    updatedAt: now,
  });
  projectsNew += inserted;
  const project = await db.collection("projects").findOne({ _id: op._id });
  const qStep = project.steps.find((s) => s.kind === "quantity");

  const oldTasks = await src.collection("tasks").find({ project: op._id, deleted: { $ne: true } }).toArray();
  const tracked = oldTasks.filter((t) => t.trackProgress);
  for (const t of oldTasks) {
    tasksNew += await upsert("tasks", t._id, {
      title: t.title, assignees: t.assignedTo || [], project: op._id, dueDate: t.dueDate || null,
      status: t.status === "pending" ? "open" : "done", doneAt: t.completedAt || null,
      createdBy: t.createdBy || null, createdByName: userName.get(String(t.createdBy)) || "",
      deleted: false, createdAt: t.createdAt || now, updatedAt: now,
    });
  }
  if (!qStep) continue;
  const logs = await src.collection("progress").find({ task: { $in: oldTasks.map((t) => t._id) }, deleted: { $ne: true } }).toArray();
  const titleOf = new Map(oldTasks.map((t) => [String(t._id), t.title]));
  for (const l of logs) {
    const prefix = tracked.length > 1 ? `[${titleOf.get(String(l.task))}] ` : "";
    logsNew += await upsert("progress", l._id, {
      project: op._id, stepId: qStep.id, date: l.date,
      added: l.added || 0, completed: l.completed || 0, declined: l.declined || 0,
      note: (prefix + (l.note || "")).trim(), user: l.user || null, userName: userName.get(String(l.user)) || "",
      deleted: false, createdAt: l.createdAt || now,
    });
  }
  // Re-total and, if production has started, mark the earlier steps done.
  const [t] = await db.collection("progress").aggregate([
    { $match: { project: op._id, stepId: qStep.id, deleted: { $ne: true } } },
    { $group: { _id: null, added: { $sum: "$added" }, completed: { $sum: "$completed" }, declined: { $sum: "$declined" } } },
  ]).toArray();
  if (t && inserted) {
    const qi = project.steps.findIndex((s) => s.id === qStep.id);
    const steps = project.steps.map((s, i) => {
      if (i < qi && s.status === "todo") return { ...s, status: "done", doneAt: now.toISOString(), doneByName: "Imported" };
      if (i === qi) return { ...s, status: s.status === "todo" ? "doing" : s.status, data: { ...s.data, totals: { added: t.added, completed: t.completed, declined: t.declined } } };
      return s;
    });
    await db.collection("projects").updateOne({ _id: op._id }, { $set: { steps } });
  }
}
log(`RxPad projects: ${projectsNew} new of ${rxProjects.length} · tasks: ${tasksNew} new · daily logs: ${logsNew} new`);

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
