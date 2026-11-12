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

// ---- safety net: protect the free daily quota (20,000 writes / 50,000 reads) ----
const MIN_GAP_MS = 3000;            // at most one upload every 3 seconds
const MAX_AUTO_UPLOADS = 12;        // ... and at most 12 automatic uploads per 10 minutes
const WINDOW_MS = 10 * 60 * 1000;
let uploadTimes = [];
let paused = "";                    // reason sync is paused ("" = running)
let lastUploadAt = 0;

export async function syncNow() {
  paused = "";                      // pressing "Sync now" always tries again
  uploadTimes = [];
  await uploadNow(true);
}

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
  }, (e) => {
    if (e?.code === "resource-exhausted") paused = friendly(e);
    setStatus("error", { error: friendly(e) });
  });
  offStore = store.onChange((what, meta) => { if (what === "words" && !meta.fromSync) scheduleUpload(); });
}

function stop() {
  unsubDoc?.(); unsubDoc = null;
  offStore?.(); offStore = null;
  clearTimeout(uploadTimer);
}

function scheduleUpload(delay = 900) {
  if (paused) return;
  clearTimeout(uploadTimer);
  setStatus("syncing");
  const wait = Math.max(delay, lastUploadAt + MIN_GAP_MS - Date.now());
  uploadTimer = setTimeout(() => uploadNow(false), wait);
}

async function uploadNow(manual = false) {
  clearTimeout(uploadTimer);
  if (!fb || !user || (paused && !manual)) return;
  const now = Date.now();
  uploadTimes = uploadTimes.filter((t) => now - t < WINDOW_MS);
  if (!manual && uploadTimes.length >= MAX_AUTO_UPLOADS) {
    paused = "Sync paused to protect the free daily limit (too many uploads in a short time). Your words are safe on this device — press Sync now to try again.";
    setStatus("error", { error: paused });
    return;
  }
  const { fs, db } = fb;
  try {
    const ref = fs.doc(db, "users", user.uid);
    let wrote = false;
    // read-merge-write in one transaction, so two devices saving at the same moment can't overwrite each other
    await fs.runTransaction(db, async (tx) => {
      wrote = false;
      const snap = await tx.get(ref);
      const remote = snap.exists() ? snap.data().state : null;
      const merged = store.mergeStates(store.exportSyncState(), remote);
      // nothing new for the cloud? then don't write at all (saves quota)
      if (remote && store.canonical(merged) === store.canonical(store.mergeStates(remote, {}))) return;
      // JSON round-trip drops `undefined` values, which Firestore refuses
      tx.set(ref, { app: "xue-learn-chinese", state: JSON.parse(JSON.stringify(merged)), updatedAt: fs.serverTimestamp() });
      wrote = true;
    });
    lastUploadAt = Date.now();
    if (wrote) uploadTimes.push(lastUploadAt);
    setStatus("synced", { at: new Date(), error: "" });
  } catch (e) {
    if (e?.code === "resource-exhausted") paused = friendly(e);   // don't keep retrying against the limit
    setStatus("error", { error: friendly(e) });
  }
}

function friendly(e) {
  const code = e?.code || "";
  if (code === "auth/unauthorized-domain") return "This web address isn't allowed yet: add it under Firebase → Authentication → Settings → Authorized domains.";
  if (code === "auth/network-request-failed" || code === "unavailable") return "No internet connection — changes will sync when you're back online.";
  if (code === "resource-exhausted") return "Today's free sync limit is used up. It resets automatically within 24 hours (midnight US Pacific time). Your words are safe on this device and will sync after that.";
  if (code === "permission-denied") return "The database refused access — check the Firestore rules (see README).";
  if (code === "auth/operation-not-allowed") return "Google sign-in isn't switched on in Firebase → Authentication → Sign-in method.";
  return e?.message || String(e);
}
