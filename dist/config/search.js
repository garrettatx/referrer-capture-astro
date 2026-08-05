/**
 * Search engine referrers. Keys are matched against the registrable part of the
 * referrer hostname, so "google." matches google.com, google.co.uk, and
 * www.google.de without listing every ccTLD.
 */
export const SEARCH_ENGINES = {
    'google.': 'google',
    'bing.': 'bing',
    'duckduckgo.': 'duckduckgo',
    'search.yahoo.': 'yahoo',
    'yahoo.': 'yahoo',
    'ecosia.': 'ecosia',
    'brave.': 'brave',
    'startpage.': 'startpage',
    'qwant.': 'qwant',
    'baidu.': 'baidu',
    'yandex.': 'yandex',
    'naver.': 'naver',
    'seznam.': 'seznam',
    'ask.com': 'ask',
    'aol.': 'aol',
    'lycos.': 'lycos',
    'mojeek.': 'mojeek',
    'search.marcia': 'marcia',
};
