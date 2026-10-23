"use client";

import { api } from "./client";

// Browser side of FCM push. Needs NEXT_PUBLIC_FIREBASE_* (+ VAPID key) in .env.

const TOKEN_KEY = "fcmToken";
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const VAPID = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export const pushConfigured = () => !!(config.apiKey && config.projectId && config.messagingSenderId && config.appId && VAPID);
export const pushSupported = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
export const savedToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

async function messaging() {
  const [{ getApps, initializeApp }, m] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
  if (!(await m.isSupported())) throw new Error("This browser can't receive push notifications.");
  const app = getApps()[0] || initializeApp(config);
  return { m, messaging: m.getMessaging(app) };
}

/** Asks permission, registers the service worker and saves this device's token. */
export async function enablePush() {
  if (!pushConfigured()) throw new Error("Push isn't set up on the server yet.");
  if (!pushSupported()) throw new Error("This browser can't receive push notifications. On iPhone, add the app to your Home Screen first.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked — allow them in the browser's site settings.");
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const { m, messaging: msg } = await messaging();
  const token = await m.getToken(msg, { vapidKey: VAPID, serviceWorkerRegistration: registration });
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
  if (!pushConfigured() || !savedToken()) return () => {};
  try {
    const { m, messaging: msg } = await messaging();
    return m.onMessage(msg, (p) => cb(p.notification?.title || "New notification", p.notification?.body || ""));
  } catch {
    return () => {};
  }
}
