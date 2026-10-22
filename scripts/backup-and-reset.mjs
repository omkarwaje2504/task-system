// Backs up every collection to backups/<db>-<timestamp>/ as Extended JSON
// (ObjectIds and dates survive), then optionally empties everything except
// `users`. Collections and indexes are kept; only documents are removed.
//
//   node --env-file=.env scripts/backup-and-reset.mjs            # backup only
//   node --env-file=.env scripts/backup-and-reset.mjs --clear    # backup, then clear all but users
//   node --env-file=.env scripts/backup-and-reset.mjs --restore backups/<folder>
//
// Restore only fills collections that are empty, so it never duplicates data.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BSON, MongoClient } from "mongodb";

const KEEP = new Set(["users"]);
const args = process.argv.slice(2);
const restoreDir = args.includes("--restore") ? args[args.indexOf("--restore") + 1] : null;

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const dbName = process.env.MONGODB_DB || "new-system";
const db = client.db(dbName);

if (restoreDir) {
  for (const file of (await readdir(restoreDir)).filter((f) => f.endsWith(".json"))) {
    const name = file.replace(/\.json$/, "");
    const docs = BSON.EJSON.parse(await readFile(path.join(restoreDir, file), "utf8"), { relaxed: false });
    const col = db.collection(name);
    if (!docs.length) continue;
    if (await col.estimatedDocumentCount()) {
      console.log(`skip     ${name} (not empty)`);
      continue;
    }
    await col.insertMany(docs);
    console.log(`restored ${name}: ${docs.length}`);
  }
  await client.close();
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = path.join("backups", `${dbName}-${stamp}`);
await mkdir(dir, { recursive: true });

const names = (await db.listCollections({}, { nameOnly: true }).toArray())
  .map((c) => c.name)
  .filter((n) => !n.startsWith("system."));

for (const name of names) {
  const docs = await db.collection(name).find().toArray();
  await writeFile(path.join(dir, `${name}.json`), BSON.EJSON.stringify(docs, null, 2, { relaxed: false }));
  console.log(`backed up ${name}: ${docs.length}`);
}
console.log(`Backup written to ${path.resolve(dir)}`);

if (args.includes("--clear")) {
  for (const name of names.filter((n) => !KEEP.has(n))) {
    const { deletedCount } = await db.collection(name).deleteMany({});
    console.log(`cleared  ${name}: ${deletedCount}`);
  }
  console.log(`Kept: ${[...KEEP].join(", ")}`);
}

await client.close();
