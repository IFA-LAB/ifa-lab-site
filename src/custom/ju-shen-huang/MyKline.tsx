import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { canRun3D, usePrefersReducedMotion } from '@/components/three/util';
import { KINDS, YEARS, type Kind } from './data';
import './kline.css';

// three.js is fetched only when the chart scrolls into view on a device that can run it
const Scene = lazy(() => import('./Scene3D'));

type Props = { lang: 'zh-tw' | 'en' };
const ORDER: Kind[] = ['role', 'research', 'work', 'award', 'win'];

/** My K line: one candle per year, each standing on the year before. The year tabs are the accessible way in;
 *  the 3D chart (or its CSS stand-in) follows them, and picking a candle picks the tab. */
export default function MyKline({ lang }: Props) {
  const zh = lang === 'zh-tw';
  const pick = (b: { zh: string; en: string }) => (zh ? b.zh : b.en);
  const [sel, setSel] = useState(YEARS.length - 1);
  const [hot, setHot] = useState<string | null>(null);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [ok, setOk] = useState(false);
  const [visible, setVisible] = useState(false);
  const reduce = usePrefersReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting);
      if (e.isIntersecting && canRun3D() && !matchMedia('(prefers-reduced-motion: reduce)').matches) setOk(true);
    }, { rootMargin: '200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const byId = new Map(YEARS.flatMap((y) => y.items.map((it) => [it.id, it] as const)));
  const onHover = (id: string | null, x = 0, y = 0) => {
    setHot(id);
    const r = stage.current?.getBoundingClientRect();
    const it = id ? byId.get(id) : null;
    setTip(it && r ? { text: pick(it.text), x: Math.min(r.width - 150, Math.max(150, x - r.left)), y: y - r.top } : null);
  };
  // arrow keys move between the year tabs (WAI-ARIA tabs pattern)
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? YEARS.length - 1 : d ? (sel + d + YEARS.length) % YEARS.length : -1;
    if (to < 0) return;
    e.preventDefault();
    setSel(to);
    tabs.current[to]?.focus();
  };

  const y = YEARS[sel];
  const items = [...y.items].sort((a, b) => ORDER.indexOf(b.kind) - ORDER.indexOf(a.kind));
  const link = (h: string) => (h.startsWith('http') ? h : `/${lang}/${h}`);

  return (
    <div className="jsk">
      <div className="jsk-stage" ref={stage}>
        {ok && !reduce ? (
          <Suspense fallback={<Flat sel={sel} onPick={setSel} />}>
            <Scene sel={sel} hot={hot} visible={visible} onPick={setSel} onHover={onHover} />
          </Suspense>
        ) : <Flat sel={sel} onPick={setSel} />}
        {tip && <span className="jsk-tip" aria-hidden="true" style={{ left: tip.x, top: tip.y }}>{tip.text}</span>}
        <ul className="jsk-legend" aria-label={zh ? '顏色' : 'Colors'}>
          {ORDER.map((k) => <li key={k}><i style={{ background: `var(--clay-${KINDS[k].clay})` }} aria-hidden="true" />{pick(KINDS[k].name)}</li>)}
        </ul>
      </div>

      <div className="jsk-panel">
        <div className="jsk-years" role="tablist" aria-label={zh ? '年份' : 'Year'} onKeyDown={onKey}>
          {YEARS.map((x, i) => (
            <button key={x.year} ref={(b) => { tabs.current[i] = b; }} type="button" role="tab" id={`jsk-tab-${x.year}`}
              aria-selected={i === sel} aria-controls="jsk-year" tabIndex={i === sel ? 0 : -1} onClick={() => setSel(i)}>
              <b>{x.year}</b><span>{x.items.length}{zh ? ' 件' : ''}</span>
            </button>
          ))}
        </div>
        <div className="jsk-year" id="jsk-year" role="tabpanel" aria-labelledby={`jsk-tab-${y.year}`}>
          <p className="jsk-note"><b>{y.year}</b>{pick(y.note)}</p>
          <ul>
            {items.map((it) => (
              <li key={it.id} data-hot={hot === it.id ? '' : undefined} onPointerEnter={() => setHot(it.id)} onPointerLeave={() => setHot(null)}>
                <i style={{ background: `var(--clay-${KINDS[it.kind].clay})` }} title={pick(KINDS[it.kind].name)} aria-hidden="true" />
                <span className="jsk-vh">{pick(KINDS[it.kind].name)}{zh ? '：' : ': '}</span>
                {it.href
                  ? <a href={link(it.href)} target={it.href.startsWith('http') ? '_blank' : undefined} rel={it.href.startsWith('http') ? 'noopener' : undefined} onFocus={() => setHot(it.id)} onBlur={() => setHot(null)}><Glued text={pick(it.text)} /></a>
                  : <span><Glued text={pick(it.text)} /></span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Chinese lines keep their last three characters together, so a line never ends with one character alone. */
function Glued({ text }: { text: string }) {
  const m = text.match(/[㐀-鿿][㐀-鿿）」。]{2,3}$/);
  return m && m.index && m.index > 4 ? <span className="jsk-wb">{words(text.slice(0, m.index))}<span className="jsk-nw">{m[0]}</span></span> : <span className="jsk-wb">{words(text)}</span>;
}

/** Break lines only between Chinese words (黑客松, not 黑客／松): <wbr> at word boundaries plus keep-all (.jsk-wb). */
const KEEP = ['黑客松', '財伴', '鉅燊'];
function words(s: string) {
  if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) return s;
  const cjk = /[㐀-鿿]/, inside = new Set<number>();
  for (const k of KEEP) for (let i = s.indexOf(k); i >= 0; i = s.indexOf(k, i + 1)) for (let j = 1; j < k.length; j++) inside.add(i + j);
  const out: ReactNode[] = [];
  let prev = '';
  for (const x of new Intl.Segmenter('zh-Hant', { granularity: 'word' }).segment(s)) {
    if (prev && cjk.test(prev.slice(-1)) && cjk.test(x.segment[0]) && !inside.has(x.index)) out.push(<wbr key={x.index} />);
    out.push(x.segment);
    prev = x.segment;
  }
  return out;
}

/** The same chart in CSS: shown before three.js arrives, and instead of it without WebGL or with reduced motion. */
function Flat({ sel, onPick }: { sel: number; onPick: (i: number) => void }) {
  let base = 0;
  return (
    <div className="jsk-flat" aria-hidden="true">
      {YEARS.map((y, i) => {
        const b = base;
        base += y.items.length;
        const bricks = [...y.items].sort((p, q) => ORDER.indexOf(p.kind) - ORDER.indexOf(q.kind));
        return (
          <button key={y.year} type="button" tabIndex={-1} className="jsk-col" data-on={i === sel ? '' : undefined} style={{ ['--b' as string]: b }} onClick={() => onPick(i)}>
            {bricks.some((x) => x.kind === 'win') && <span className="jsk-cups">{bricks.filter((x) => x.kind === 'win').map((x) => <i key={x.id} />)}</span>}
            {[...bricks].reverse().map((x) => <span key={x.id} className="jsk-brick" style={{ background: `var(--clay-${KINDS[x.kind].clay})` }} />)}
            <span className="jsk-yr">{y.year}</span>
          </button>
        );
      })}
    </div>
  );
}
