import "server-only";
import { after } from "next/server";
import { ObjectId, type Db, type Document } from "mongodb";
import { SignJWT, importPKCS8 } from "jose";
import type { Session } from "./auth";
import { escapeRegex } from "./db";

/*
 * Notifications: saved for the notification panel (bell, top right) and, when
 * Firebase is set up, pushed to phones / browsers with FCM.
 *
 * Push needs a Firebase service account in .env:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * Without it, notifications still appear in the panel.
 */

export type NotifyInput = {
  type: "step.assigned" | "step.doing" | "step.done" | "sample.working" | "task.assigned" | "task.comment" | "task.ack" | "task.done";
  title: string;
  body: string;
  /** Where clicking it goes, e.g. /project/<id> */
  link: string;
  project?: ObjectId | string | null;
  /** Pushes with the same tag replace each other on the device (reminders). */
  tag?: string;
};

const pushConfigured = () => !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);

/** "Brand — theme" (or the old name / type) for notification text. */
export async function projectLabel(db: Db, p: Document) {
  const [brand, type] = await Promise.all([
    p.brand ? db.collection("brands").findOne({ _id: p.brand }, { projection: { name: 1 } }) : null,
    p.productType ? db.collection("productTypes").findOne({ _id: p.productType }, { projection: { name: 1 } }) : null,
  ]);
  return [brand?.name, p.theme].filter(Boolean).join(" — ") || p.legacyName || `${type?.name || ""} project`.trim();
}

/**
 * Who hears when someone starts or finishes work: admins (the old tracker's
 * "head" role), team leads of that person's team, and the people working on
 * it with them (other assignees / sample workers). notify() drops the actor.
 */
export async function watcherIds(db: Db, actor: Session, coWorkers: Iterable<string> = []) {
  const me = await db.collection("users").findOne({ _id: new ObjectId(actor.id) }, { projection: { team: 1 } });
  const team = String(me?.team || "").trim();
  const leadsOfTeam = team ? [{ lead: true, team: { $regex: `^${escapeRegex(team)}$`, $options: "i" } }] : [];
  const heads = await db.collection("users").find(
    { deleted: { $ne: true }, active: { $ne: false }, $or: [{ role: "admin" }, ...leadsOfTeam] },
    { projection: { _id: 1 } },
  ).toArray();
  return [...heads.map((h) => String(h._id)), ...coWorkers];
}

/**
 * Saves a notification for each person (never the one who did it) and pushes
 * it after the response is sent, so the click that caused it stays fast.
 */
export async function notify(db: Db, actor: Session, userIds: Iterable<string>, n: NotifyInput) {
  const to = [...new Set(userIds)].filter((id) => id && id !== actor.id && ObjectId.isValid(id));
  if (!to.length) return;
  const now = new Date();
  await db.collection("notifications").insertMany(to.map((u) => ({
    user: new ObjectId(u), ...n,
    project: n.project ? new ObjectId(String(n.project)) : null,
    actor: new ObjectId(actor.id), actorName: actor.name,
    read: false, createdAt: now,
  })));
  if (pushConfigured()) after(() => push(db, to, n).catch((e) => console.error("FCM push failed:", e)));
}

// ---- FCM HTTP v1 -------------------------------------------------------------

let token: { value: string; exp: number } | null = null;

/** OAuth access token for FCM from the service account (cached ~55 min). */
async function accessToken() {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const key = await importPKCS8(process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"), "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(process.env.FIREBASE_CLIENT_EMAIL!)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const data = await res.json();
  token = { value: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return token.value;
}

/** Push only (no new entry in the panel) — used for repeat reminders. */
export async function pushTo(db: Db, userIds: string[], n: NotifyInput) {
  if (pushConfigured() && userIds.length) await push(db, userIds, n);
}

async function push(db: Db, userIds: string[], n: NotifyInput) {
  const users = await db.collection("users").find(
    { _id: { $in: userIds.map((u) => new ObjectId(u)) }, "fcmTokens.0": { $exists: true } },
    { projection: { fcmTokens: 1 } },
  ).toArray();
  const tokens = users.flatMap((u) => (u.fcmTokens || []) as string[]);
  if (!tokens.length) return;

  const auth = await accessToken();
  const base = process.env.APP_URL || "";
  const dead: string[] = [];
  await Promise.all(tokens.map(async (t) => {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token: t,
          notification: { title: n.title, body: n.body },
          data: { link: n.link, type: n.type },
          webpush: {
            fcm_options: { link: `${base}${n.link}` },
            notification: {
              icon: `${base}/apple-icon`, badge: `${base}/apple-icon`,
              // General tasks stay on screen and buzz again on each reminder.
              ...(n.tag ? { tag: n.tag, renotify: true } : {}),
              ...(n.type.startsWith("task.") ? { requireInteraction: true } : {}),
            },
          },
        },
      }),
    });
    // Uninstalled app / revoked permission: forget that device.
    if (res.status === 404 || res.status === 410) dead.push(t);
    else if (!res.ok) console.error("FCM send failed:", res.status, await res.text().catch(() => ""));
  }));
  if (dead.length) await db.collection("users").updateMany({ _id: { $in: users.map((u) => u._id) } }, { $pull: { fcmTokens: { $in: dead } } as never });
}
