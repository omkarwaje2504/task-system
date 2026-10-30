import { firebaseWebConfig } from "@/lib/firebaseConfig";

// The FCM service worker, built from the server's FIREBASE_* settings so no
// keys are hard-coded. Shows pushes while the app is closed / in the
// background; clicking one opens its link (FCM's webpush.fcm_options.link).

const FIREBASE_VERSION = "12.19.0"; // keep in step with the "firebase" package

export function GET() {
  const { ready, config } = firebaseWebConfig();
  const js = ready
    ? `importScripts("https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging-compat.js");
firebase.initializeApp(${JSON.stringify(config)});
firebase.messaging();
// Task reminders the app shows itself carry data.link (FCM's own pushes open their link).
self.addEventListener("notificationclick", (e) => {
  const link = e.notification.data && e.notification.data.link;
  if (!link) return;
  e.notification.close();
  e.waitUntil(clients.openWindow(link));
});`
    : "// Push isn't set up: add the FIREBASE_* settings to .env.";
  return new Response(js, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-cache" } });
}
