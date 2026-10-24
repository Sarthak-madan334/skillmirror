export const STORAGE_KEY = 'skillmirror.prototype.v1';

export function emptyStore() {
  return { projects: [], sessions: {} };
}

function getBrowserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function readStore(storage = getBrowserStorage()) {
  if (!storage) return { data: emptyStore(), recovered: false };

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { data: emptyStore(), recovered: false };

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.projects)) {
      return { data: emptyStore(), recovered: true };
    }

    return {
      data: {
        projects: parsed.projects.filter((project) => project && typeof project.id === 'string' && Array.isArray(project.steps)),
        sessions: parsed.sessions && typeof parsed.sessions === 'object' && !Array.isArray(parsed.sessions)
          ? parsed.sessions
          : {},
      },
      recovered: false,
    };
  } catch {
    return { data: emptyStore(), recovered: true };
  }
}

export function writeStore(data, storage = getBrowserStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}