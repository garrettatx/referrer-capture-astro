/**
 * Storage that degrades instead of throwing.
 *
 * localStorage throws in Safari private mode and in partitioned iframes, and it
 * is missing entirely in some embedded webviews. sessionStorage covers most of
 * those. Memory covers the rest, losing persistence across pages but keeping
 * the current page working.
 *
 * No cookies. Nothing here needs to be read server-side, and a cookie would ride
 * along on every asset request for no return.
 */
export interface Store {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  kind: 'local' | 'session' | 'memory';
}

function probe(storage: Storage): boolean {
  try {
    const k = '__rc_probe__';
    storage.setItem(k, '1');
    storage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const memory = new Map<string, string>();

export function createStore(): Store {
  try {
    if (typeof localStorage !== 'undefined' && probe(localStorage)) {
      return {
        kind: 'local',
        get: (k) => safe(() => localStorage.getItem(k)),
        set: (k, v) => void safe(() => localStorage.setItem(k, v)),
        remove: (k) => void safe(() => localStorage.removeItem(k)),
      };
    }
  } catch {
    /* fall through */
  }

  try {
    if (typeof sessionStorage !== 'undefined' && probe(sessionStorage)) {
      return {
        kind: 'session',
        get: (k) => safe(() => sessionStorage.getItem(k)),
        set: (k, v) => void safe(() => sessionStorage.setItem(k, v)),
        remove: (k) => void safe(() => sessionStorage.removeItem(k)),
      };
    }
  } catch {
    /* fall through */
  }

  return {
    kind: 'memory',
    get: (k) => memory.get(k) ?? null,
    set: (k, v) => void memory.set(k, v),
    remove: (k) => void memory.delete(k),
  };
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
