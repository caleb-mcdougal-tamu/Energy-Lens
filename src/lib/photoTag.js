// Fixed photo-type tag list. Single global "active tag" that sticks across
// screens and sessions. Until the user explicitly picks a tag, the active tag
// is the contextual default (DATACOLLECTION inside Data Collection, else
// EQUIPMENT); once explicitly chosen it persists everywhere.

export const TAGS = [
  "NAMEPLATE",
  "EQUIPMENT",
  "SCREEN",
  "LOGGER",
  "DATACOLLECTION",
  "MEASUREMENT",
  "TEAM",
];

export const DEFAULT_TAG = "EQUIPMENT";

const KEY = "energylens.activePhotoTag";
const EXPLICIT_KEY = "energylens.activePhotoTagExplicit";

const listeners = new Set();

function readStored() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function readExplicit() {
  try {
    return localStorage.getItem(EXPLICIT_KEY) === "1";
  } catch {
    return false;
  }
}

function write(tag, explicit) {
  try {
    localStorage.setItem(KEY, tag);
    localStorage.setItem(EXPLICIT_KEY, explicit ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function notify() {
  listeners.forEach((l) => l());
}

export function getActiveTag(contextDefault = DEFAULT_TAG) {
  if (readExplicit()) {
    const s = readStored();
    if (s && TAGS.includes(s)) return s;
  }
  return TAGS.includes(contextDefault) ? contextDefault : DEFAULT_TAG;
}

export function setActiveTag(tag) {
  if (!TAGS.includes(tag)) return;
  write(tag, true);
  notify();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}