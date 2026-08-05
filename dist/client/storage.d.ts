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
export declare function createStore(): Store;
