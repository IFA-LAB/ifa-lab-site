/** Split off the last few Chinese characters (and the punctuation after them) so they can be kept on one line:
 *  a paragraph then never ends on a line holding one or two characters. Returns ['', s] when there is nothing to glue.
 *  The same rule runs on server-rendered text in Base.astro (inline script); keep the two in step. */
export function glueTail(s: string, n = 4): [string, string] {
  const cjk = /[\u3400-\u9fff\uf900-\ufaff]/;
  let i = s.length, count = 0;
  while (i > 0 && count < n) {
    const c = s[i - 1];
    if (/\s/.test(c)) break;
    if (cjk.test(c)) count++;
    i--;
  }
  // move the cut back to the start of the word it falls in
  if (count && typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    let start = 0;
    for (const w of new Intl.Segmenter('zh-Hant', { granularity: 'word' }).segment(s)) { if (w.index > i) break; start = w.index; }
    i = start;
  }
  return count && i >= 6 ? [s.slice(0, i), s.slice(i)] : ['', s];
}
