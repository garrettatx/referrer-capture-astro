/**
 * Search engine referrers. Keys are matched against the registrable part of the
 * referrer hostname, so "google." matches google.com, google.co.uk, and
 * www.google.de without listing every ccTLD.
 */
export declare const SEARCH_ENGINES: Record<string, string>;
