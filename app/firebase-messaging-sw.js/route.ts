// The FCM service worker, built from the NEXT_PUBLIC_FIREBASE_* settings so
// no keys are hard-coded. Shows pushes while the app is closed / in the
// background; clicking one opens its link (FCM's webpush.fcm_options.link).

const FIREBASE_VERSION = "12.19.0"; // keep in step with the "firebase" package

export function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const js = config.apiKey
    ? `importScripts("https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging-compat.js");
firebase.initializeApp(${JSON.stringify(config)});
firebase.messaging();`
    : "// Push isn't set up: add the NEXT_PUBLIC_FIREBASE_* settings to .env.";
  return new Response(js, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-cache" } });
}
