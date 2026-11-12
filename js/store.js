// Local data store: settings + words, saved in this browser (localStorage).
// Each device keeps its own copy — use Export / Import to move words between phone and PC.

const KEY = {
  settings: "xue.settings",
  loaded: "xue.notebookLoaded",
  userWords: "xue.userWords",   // [{ id, english, pinyin, hanzi, ..., t }]   t = last change (ms)
  deleted: "xue.deleted",       // { id: t }  deleted own words (so sync doesn't bring them back)
  edits: "xue.edits",           // { notebookId: { english?, pinyin?, hanzi?, t } }
  hiddenMap: "xue.hiddenMap",   // { notebookId: { h: true|false, t } }
  hidden: "xue.hidden",         // (old format, migrated to hiddenMap)
  speed: "xue.rowSpeed",
  tabs: "xue.tabs",
};

export const DEFAULT_SETTINGS = {
  voiceURI: "",          // "" = pick the best Mandarin voice automatically
  normalRate: 0.95,
  slowRate: 0.55,
  defaultSpeed: "normal",
  toneColors: true,
  showHanzi: true,
  theme: "auto",         // auto | light | dark
  navSide: "left",       // left | right
  showZhuyin: true,      // Pinyin page: show ㄅㄆㄇ next to pinyin
  pinyinSpeed: "slow",   // Pinyin page: slow | normal
};

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

// ---- tiny event bus so pages refresh when data/settings change elsewhere ----
const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
/** meta.fromSync = true when the change came from the cloud (so it isn't uploaded straight back) */
function emit(what, meta = {}) { listeners.forEach((fn) => fn(what, meta)); }

// ---- settings ----
export function getSettings() { return { ...DEFAULT_SETTINGS, ...read(KEY.settings, {}) }; }
export function setSetting(name, value) {
  const s = getSettings();
  s[name] = value;
  write(KEY.settings, s);
  emit("settings");
}

// ---- open tabs (restored on next launch) ----
export function getTabs() { return read(KEY.tabs, null); }
export function saveTabs(state) { write(KEY.tabs, state); }

// ---- words ----
let notebook = null; // { topics: [...], words: [...] } from data/notebook-words.json

export async function loadNotebook() {
  if (!notebook) {
    const res = await fetch("data/notebook-words.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("Could not load notebook words (" + res.status + ")");
    notebook = await res.json();
  }
  write(KEY.loaded, true);
  emit("words");
  return notebook;
}
export function isNotebookLoaded() { return read(KEY.loaded, false); }
export function unloadNotebook() { write(KEY.loaded, false); emit("words"); }
export function getTopics() {
  const t = notebook ? notebook.topics.slice() : [];
  t.push({ id: "mine", num: "★", title: "My words", part: "" });
  return t;
}

// ---- migration from the first version (no timestamps) ----
(function migrate() {
  const old = read(KEY.hidden, null);
  if (Array.isArray(old)) {
    const m = read(KEY.hiddenMap, {});
    old.forEach((id) => { if (!m[id]) m[id] = { h: true, t: 1 }; });
    write(KEY.hiddenMap, m);
    try { localStorage.removeItem(KEY.hidden); } catch {}
  }
  const list = read(KEY.userWords, []);
  if (list.some((w) => !w.t)) write(KEY.userWords, list.map((w) => ({ ...w, t: w.t || Date.parse(w.created) || 1 })));
  const edits = read(KEY.edits, {});
  if (Object.values(edits).some((e) => !e.t)) {
    for (const id in edits) edits[id] = { ...edits[id], t: edits[id].t || 1 };
    write(KEY.edits, edits);
  }
})();

const now = () => Date.now();
const strip = (o) => { const { t, ...rest } = o || {}; return rest; };

/** All visible words, notebook first (in notebook order), then the user's own. */
export function getWords() {
  const edits = read(KEY.edits, {});
  const hidden = read(KEY.hiddenMap, {});
  const out = [];
  if (notebook && isNotebookLoaded()) {
    for (const w of notebook.words) {
      if (hidden[w.id]?.h) continue;
      out.push({ ...w, ...strip(edits[w.id]), source: "notebook" });
    }
  }
  for (const w of read(KEY.userWords, [])) out.push({ ...strip(w), topic: "mine", source: "user" });
  return out;
}

/** speakAs = characters used only for the voice when you didn't type any (found from the pinyin) */
export function addWord({ english, pinyin, hanzi, speakAs = "", speakMethod = "" }) {
  const list = read(KEY.userWords, []);
  const w = { id: "u" + now().toString(36) + Math.random().toString(36).slice(2, 5), english, pinyin, hanzi: hanzi || "",
              speakAs, speakMethod, created: new Date().toISOString(), t: now() };
  list.push(w);
  write(KEY.userWords, list);
  emit("words");
  return w;
}

export function updateWord(word, changes) {
  if (word.source === "user") {
    write(KEY.userWords, read(KEY.userWords, []).map((w) => (w.id === word.id ? { ...w, ...changes, t: now() } : w)));
  } else {
    const edits = read(KEY.edits, {});
    edits[word.id] = { ...(edits[word.id] || {}), ...changes, t: now() };
    write(KEY.edits, edits);
  }
  emit("words");
}

/** Removes a word; returns an undo function. Notebook words are only hidden. */
export function removeWord(word) {
  if (word.source === "user") {
    const list = read(KEY.userWords, []);
    const idx = list.findIndex((w) => w.id === word.id);
    const [gone] = list.splice(idx, 1);
    write(KEY.userWords, list);
    write(KEY.deleted, { ...read(KEY.deleted, {}), [word.id]: now() });
    emit("words");
    return () => {
      const l = read(KEY.userWords, []);
      l.splice(idx, 0, { ...gone, t: now() });
      write(KEY.userWords, l);
      const d = read(KEY.deleted, {}); delete d[word.id]; write(KEY.deleted, d);
      emit("words");
    };
  }
  const setHidden = (h) => { const m = read(KEY.hiddenMap, {}); m[word.id] = { h, t: now() }; write(KEY.hiddenMap, m); emit("words"); };
  setHidden(true);
  return () => setHidden(false);
}

export function restoreHidden() {
  const t = now();
  const m = read(KEY.hiddenMap, {});
  for (const id in m) m[id] = { h: false, t };
  write(KEY.hiddenMap, m);
  const edits = read(KEY.edits, {});
  for (const id in edits) edits[id] = { t };   // empty edit = back to the notebook text
  write(KEY.edits, edits);
  emit("words");
}
export function hiddenCount() { return Object.values(read(KEY.hiddenMap, {})).filter((x) => x.h).length; }

// ---- cloud sync support ----
/** Everything that follows you between devices (not settings: voices differ per device). */
export function exportSyncState() {
  return {
    v: 2,
    userWords: read(KEY.userWords, []),
    deleted: read(KEY.deleted, {}),
    edits: read(KEY.edits, {}),
    hidden: read(KEY.hiddenMap, {}),
  };
}

const newer = (a, b) => ((b?.t || 0) > (a?.t || 0) ? b : a);

/** Pure merge of two sync states: for every item the most recent change wins. */
export function mergeStates(a, b) {
  a = a || {}; b = b || {};
  const deleted = { ...(a.deleted || {}) };
  for (const [id, t] of Object.entries(b.deleted || {})) deleted[id] = Math.max(deleted[id] || 0, t);
  const words = new Map();
  for (const w of [...(a.userWords || []), ...(b.userWords || [])]) words.set(w.id, newer(words.get(w.id), w));
  const userWords = [...words.values()]
    .filter((w) => !(deleted[w.id] && deleted[w.id] >= (w.t || 0)))
    .sort((x, y) => (x.created || "").localeCompare(y.created || "") || x.id.localeCompare(y.id));
  const pick = (x = {}, y = {}) => { const out = { ...x }; for (const k in y) out[k] = newer(out[k], y[k]); return out; };
  return { v: 2, userWords, deleted, edits: pick(a.edits, b.edits), hidden: pick(a.hidden, b.hidden) };
}

/**
 * Applies the cloud copy: merges it with what's on this device and saves the result.
 * Returns true when this device has changes the cloud doesn't (so they should be uploaded).
 */
/**
 * Text form of a state with every object's keys sorted, so two states compare equal when their
 * CONTENT is equal. (Firestore returns fields in alphabetical order; comparing raw JSON made every
 * sync look "changed" and caused an endless upload loop.)
 */
export function canonical(v) {
  const sort = (x) => Array.isArray(x) ? x.map(sort)
    : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort(x[k])])) : x;
  return JSON.stringify(sort(v));
}

export function applySyncState(remote) {
  const local = exportSyncState();
  const merged = mergeStates(local, remote);
  const same = (x, y) => canonical(x) === canonical(y);
  if (!same(merged, local)) {
    write(KEY.userWords, merged.userWords);
    write(KEY.deleted, merged.deleted);
    write(KEY.edits, merged.edits);
    write(KEY.hiddenMap, merged.hidden);
    emit("words", { fromSync: true });
  }
  const r = remote ? mergeStates(remote, {}) : null;
  return !r || !same(merged, r);
}

// per-row Slow / Normal choice
export function getRowSpeed(id) { return read(KEY.speed, {})[id] || getSettings().defaultSpeed; }
export function setRowSpeed(id, speed) { const m = read(KEY.speed, {}); m[id] = speed; write(KEY.speed, m); }

// ---- backup (file) ----
export function exportData() {
  return { app: "xue-learn-chinese", version: 2, exported: new Date().toISOString(), ...exportSyncState() };
}
export function importData(data) {
  if (!data || data.app !== "xue-learn-chinese") throw new Error("This file is not a Xué backup.");
  const before = new Set(read(KEY.userWords, []).map((w) => (w.pinyin + "|" + w.english).toLowerCase()));
  // version-1 backups had no timestamps and kept hidden words as a list
  const incoming = {
    userWords: (data.userWords || []).map((w) => ({ ...w, t: w.t || Date.parse(w.created) || 1 })),
    deleted: data.deleted || {},
    edits: Object.fromEntries(Object.entries(data.edits || {}).map(([id, e]) => [id, { ...e, t: e.t || 1 }])),
    hidden: Array.isArray(data.hidden) ? Object.fromEntries(data.hidden.map((id) => [id, { h: true, t: 1 }])) : data.hidden || {},
  };
  // skip words that are already in the list under another id (same pinyin + English)
  incoming.userWords = incoming.userWords.filter((w) => !before.has((w.pinyin + "|" + w.english).toLowerCase()) ||
    read(KEY.userWords, []).some((x) => x.id === w.id));
  const merged = mergeStates(exportSyncState(), incoming);
  write(KEY.userWords, merged.userWords);
  write(KEY.deleted, merged.deleted);
  write(KEY.edits, merged.edits);
  write(KEY.hiddenMap, merged.hidden);
  emit("words");
  return merged.userWords.filter((w) => !before.has((w.pinyin + "|" + w.english).toLowerCase())).length;
}
