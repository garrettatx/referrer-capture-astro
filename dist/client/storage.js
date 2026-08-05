function probe(storage) {
    try {
        const k = '__rc_probe__';
        storage.setItem(k, '1');
        storage.removeItem(k);
        return true;
    }
    catch {
        return false;
    }
}
const memory = new Map();
export function createStore() {
    try {
        if (typeof localStorage !== 'undefined' && probe(localStorage)) {
            return {
                kind: 'local',
                get: (k) => safe(() => localStorage.getItem(k)),
                set: (k, v) => void safe(() => localStorage.setItem(k, v)),
                remove: (k) => void safe(() => localStorage.removeItem(k)),
            };
        }
    }
    catch {
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
    }
    catch {
        /* fall through */
    }
    return {
        kind: 'memory',
        get: (k) => memory.get(k) ?? null,
        set: (k, v) => void memory.set(k, v),
        remove: (k) => void memory.delete(k),
    };
}
function safe(fn) {
    try {
        return fn();
    }
    catch {
        return null;
    }
}
