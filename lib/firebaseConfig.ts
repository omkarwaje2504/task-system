import "server-only";

/**
 * Firebase *web* config, read on the server and handed to signed-in browsers
 * at run time (so no NEXT_PUBLIC_ settings are needed). These values identify
 * the Firebase project; they are not secrets. The service-account key
 * (FIREBASE_PRIVATE_KEY) never leaves the server.
 */
export function firebaseWebConfig() {
  const e = process.env;
  const config = {
    apiKey: e.FIREBASE_API_KEY,
    authDomain: e.FIREBASE_AUTH_DOMAIN,
    projectId: e.FIREBASE_PROJECT_ID,
    messagingSenderId: e.FIREBASE_MESSAGING_SENDER_ID,
    appId: e.FIREBASE_APP_ID,
  };
  const ready = !!(config.apiKey && config.projectId && config.messagingSenderId && config.appId && e.FIREBASE_VAPID_KEY);
  return { ready, config, vapidKey: e.FIREBASE_VAPID_KEY || "" };
}
