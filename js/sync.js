// Cloud sync: sign in with Google, keep your words in Firebase Firestore, follow you on every device.
// - This device's copy (localStorage) stays the main copy, so the app works offline as before.
// - On sign-in and whenever another device changes something, the cloud copy is merged in
//   (newest change wins per word). Local changes are uploaded about a second after you make them.
// - Data lives in one document per person: users/{your Google user id}.
import { firebaseConfig } from "./firebase-config.js";
import * as store from "./store.js";

const SDK = "https://www.gstatic.com/firebasejs/12.6.0/";
let fb = null;          // loaded Firebase modules + instances
let user = null;
let unsubDoc = null, offStore = null, uploadTimer = null;
const listeners = new Set();
let status = { state: "off", at: null, error: "" }; // off | signed-out | connecting | syncing | synced | error

export function isConfigured() { return !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId); }
export function getStatus() { return { ...status, user: user && { name: user.displayName, email: user.email, photo: user.photoURL } }; }
export function onSyncChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function setStatus(state, extra = {}) { status = { ...status, state, ...extra }; listeners.forEach((fn) => fn(getStatus())); }

async function load() {
  if (fb) return fb;
  const [app, auth, fs] = await Promise.all([
    import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js"),
  ]);
  const a = app.initializeApp(firebaseConfig);
  fb = { auth, fs, authI: auth.getAuth(a), db: fs.getFirestore(a) };
  return fb;
}

/** Called once at app start. Does nothing (and loads nothing) until sync is configured. */
export async function initSync() {
  if (!isConfigured()) return;
  setStatus("connecting");
  try {
    const { auth, authI } = await load();
    await auth.setPersistence(authI, auth.browserLocalPersistence);
    auth.getRedirectResult(authI).catch((e) => setStatus("error", { error: friendly(e) }));
    auth.onAuthStateChanged(authI, (u) => {
      user = u;
      if (u) start(); else { stop(); setStatus("signed-out"); }
    });
  } catch (e) {
    setStatus("error", { error: "Couldn't reach the sync service (offline?). Your words are safe on this device." });
  }
}

export async function signIn() {
  const { auth, authI } = await load();
  const provider = new auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await auth.signInWithPopup(authI, provider);
  } catch (e) {
    // installed phone apps sometimes block pop-ups: fall back to a full-page sign-in
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(e.code)) {
      await auth.signInWithRedirect(authI, provider);
    } else if (e.code !== "auth/popup-closed-by-user") {
      setStatus("error", { error: friendly(e) });
      throw e;
    }
  }
}

export async function signOut() {
  if (!fb) return;
  await uploadNow();
  await fb.auth.signOut(fb.authI);
}

export async function syncNow() { await uploadNow(); }

function start() {
  stop();
  const { fs, db } = fb;
  const ref = fs.doc(db, "users", user.uid);
  setStatus("syncing");
  unsubDoc = fs.onSnapshot(ref, (snap) => {
    if (snap.metadata.hasPendingWrites) return;            // our own upload echoing back
    const remote = snap.exists() ? snap.data().state : null;
    const localNewer = store.applySyncState(remote);
    if (localNewer) scheduleUpload(0);
    else setStatus("synced", { at: new Date(), error: "" });
  }, (e) => setStatus("error", { error: friendly(e) }));
  offStore = store.onChange((what, meta) => { if (what === "words" && !meta.fromSync) scheduleUpload(); });
}

function stop() {
  unsubDoc?.(); unsubDoc = null;
  offStore?.(); offStore = null;
  clearTimeout(uploadTimer);
}

function scheduleUpload(delay = 900) {
  clearTimeout(uploadTimer);
  setStatus("syncing");
  uploadTimer = setTimeout(uploadNow, delay);
}

async function uploadNow() {
  clearTimeout(uploadTimer);
  if (!fb || !user) return;
  const { fs, db } = fb;
  try {
    const ref = fs.doc(db, "users", user.uid);
    // read-merge-write in one transaction, so two devices saving at the same moment can't overwrite each other
    await fs.runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const merged = store.mergeStates(store.exportSyncState(), snap.exists() ? snap.data().state : null);
      // JSON round-trip drops `undefined` values, which Firestore refuses
      tx.set(ref, { app: "xue-learn-chinese", state: JSON.parse(JSON.stringify(merged)), updatedAt: fs.serverTimestamp() });
    });
    setStatus("synced", { at: new Date(), error: "" });
  } catch (e) {
    setStatus("error", { error: friendly(e) });
  }
}

function friendly(e) {
  const code = e?.code || "";
  if (code === "auth/unauthorized-domain") return "This web address isn't allowed yet: add it under Firebase → Authentication → Settings → Authorized domains.";
  if (code === "auth/network-request-failed" || code === "unavailable") return "No internet connection — changes will sync when you're back online.";
  if (code === "permission-denied") return "The database refused access — check the Firestore rules (see README).";
  if (code === "auth/operation-not-allowed") return "Google sign-in isn't switched on in Firebase → Authentication → Sign-in method.";
  return e?.message || String(e);
}
