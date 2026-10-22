// Creates (or resets) an admin account — use when nobody can log in yet.
//
//   node --env-file=.env scripts/create-admin.mjs "Full Name" email@example.com "password"

import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password || password.length < 6) {
  console.error('Usage: node --env-file=.env scripts/create-admin.mjs "Full Name" email "password (6+ chars)"');
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const users = client.db(process.env.MONGODB_DB || "new-system").collection("users");
const now = new Date();
const clean = email.trim().toLowerCase();
await users.updateOne(
  { email: clean },
  {
    $set: { name, role: "admin", active: true, deleted: false, password: await bcrypt.hash(password, 10), updatedAt: now },
    $setOnInsert: { email: clean, mobile: "", team: "", createdAt: now },
  },
  { upsert: true },
);
console.log(`Admin ready: ${clean}`);
await client.close();
