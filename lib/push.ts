"use client";

import { api } from "./client";

// Browser side of FCM push. The Firebase web config comes from the server at
// run time (/api/push-config), so .env needs no NEXT_PUBLIC_ settings.

type PushConfig = {
  ready: boolean;
  config: { apiKey?: string; authDomain?: string; projectId?: string; messagingSenderId?: string; appId?: string };
  vapidKey: string;
};

const TOKEN_KEY = "fcmToken";
let configPromise: Promise<PushConfig> | null = null;

/** Fetched once per page load. */
export function pushConfig() {
  configPromise ??= api<PushConfig>("/api/push-config").catch(() => ({ ready: false, config: {}, vapidKey: "" }));
  return configPromise;
}

export const pushSupported = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
export const savedToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

async function messaging() {
  const { config } = await pushConfig();
  const [{ getApps, initializeApp }, m] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
  if (!(await m.isSupported())) throw new Error("This browser can't receive push notifications.");
  const app = getApps()[0] || initializeApp(config);
  return { m, messaging: m.getMessaging(app) };
}

/** Asks permission, registers the service worker and saves this device's token. */
export async function enablePush() {
  const { ready, vapidKey } = await pushConfig();
  if (!ready) throw new Error("Push isn't set up on the server yet.");
  if (!pushSupported()) throw new Error("This browser can't receive push notifications. On iPhone, add the app to your Home Screen first.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked — allow them in the browser's site settings.");
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const { m, messaging: msg } = await messaging();
  const token = await m.getToken(msg, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Couldn't get a push token — try again.");
  await api("/api/me/push-token", { body: { token } });
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
  return token;
}

export async function disablePush() {
  const token = savedToken();
  if (token) await api("/api/me/push-token", { method: "DELETE", body: { token } }).catch(() => {});
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

/** While the app is open, pushes arrive here instead of as a system notification. */
export async function onForegroundPush(cb: (title: string, body: string) => void) {
  if (!savedToken() || !(await pushConfig()).ready) return () => {};
  try {
    const { m, messaging: msg } = await messaging();
    return m.onMessage(msg, (p) => cb(p.notification?.title || "New notification", p.notification?.body || ""));
  } catch {
    return () => {};
  }
}
