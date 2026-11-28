/** Split off the last few Chinese characters (and the punctuation after them) so they can be kept on one line:
 *  a paragraph then never ends on a line holding one or two characters. Returns ['', s] when there is nothing to glue.
 *  The same rule runs on server-rendered text in Base.astro (inline script); keep the two in step. */
/** Names the word dictionary does not know (台／積電); Base.astro's inline pass gets this same list. */
export const KEEP = ['台積電', '工研院', '中研院', '國科會', '資策會', '中華電信', '玉山銀行', '國泰金控', '富邦金控', '聯發科', '鴻海', '邱信瑜', '黑客松', '懶人包', '資安', '準實驗', '自適應', '去過', '沙盒', '生成式', '衍生性', '個人化', '財伴', '研發替代役', '替代役',
  '博士後', '衍生性商品', '江彌修', '宏泰人壽', '決策者', '資產定價', '資料集', '歷史資料', '投資人', '管理學院', '圖神經網路', '學長姐', '研究助理'];

export function glueTail(s: string, n = 4): [string, string] {
  const cjk = /[\u3400-\u9fff\uf900-\ufaff]/;
  let i = s.length, count = 0;
  while (i > 0 && count < n) {
    const c = s[i - 1];
    if (/[\sA-Za-z0-9]/.test(c)) break;
    if (cjk.test(c)) count++;
    i--;
  }
  // move the cut back to the start of the word it falls in
  if (count && typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    let start = 0;
    for (const w of new Intl.Segmenter('zh-Hant', { granularity: 'word' }).segment(s)) { if (w.index > i) break; start = w.index; }
    i = start;
  }
  for (const k of KEEP) for (let j = s.indexOf(k); j >= 0; j = s.indexOf(k, j + 1)) if (j < i && i < j + k.length) i = j;
  return count && i >= 6 ? [s.slice(0, i), s.slice(i)] : ['', s];
}

/** Split Chinese text at word boundaries (投資人 stays whole; KEEP names too). Join the pieces with <wbr> and set
 *  word-break: keep-all (class `wb`) so lines break only there. Same rule as the <wbr> pass in Base.astro, for text
 *  that pass cannot reach: React islands and text written by scripts. */
export function wordPieces(s: string): string[] {
  if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) return [s];
  const cjk = /[\u3400-\u9fff\uf900-\ufaff]/, end = /[\u3400-\u9fff\uf900-\ufaff]$/;
  const inside = new Set<number>();
  for (const k of KEEP) for (let i = s.indexOf(k); i >= 0; i = s.indexOf(k, i + 1)) for (let j = 1; j < k.length; j++) inside.add(i + j);
  const out: string[] = [];
  let prev = '';
  for (const x of new Intl.Segmenter('zh-Hant', { granularity: 'word' }).segment(s)) {
    if (prev && end.test(prev) && cjk.test(x.segment[0]) && !inside.has(x.index)) out.push(x.segment);
    else if (out.length) out[out.length - 1] += x.segment;
    else out.push(x.segment);
    prev = x.segment;
  }
  return out;
}
