import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { canRun3D, gated, usePrefersReducedMotion, useMedia } from './env';
import type { Pick, WalkMember, WalkStep } from './WalkScene';
import { glueTail, wordPieces } from '@/lib/glue';

// behind the loading screen, fetch the scene as soon as this island's script runs, not after the first render
const loadScene = () => import('./WalkScene');
if (gated()) void loadScene();
const WalkScene = lazy(loadScene);

type Text = { next: string; eyebrow: string; totals: string; solo: string; more: string; skip: string; skipHref: string; hint: string; endH: string; endP: string; mail: string; mailHref: string; join: string; joinHref: string };

/** The lab's history as its own candlestick chart, climbed by K 喵 as the page scrolls.
    Scroll progress through [data-walk] becomes time T (0 = first year, steps-1 = the last candle).
    Without WebGL2 or with reduced motion nothing mounts; the page's text list tells the same story. */
export default function LabWalk({ steps, crew, text }: { steps: WalkStep[]; crew: WalkMember[]; text: Text }) {
  const reduce = usePrefersReducedMotion();
  const small = useMedia('(max-width: 767px)');
  const [ok, setOk] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pick, setPick] = useState<Pick>(null);
  const [idx, setIdx] = useState(0);
  const [end, setEnd] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const T = useRef(0);
  const reveal = useRef(0);
  const host = useRef<HTMLDivElement>(null);
  const N = steps.length;

  const joinOf = useMemo(() => Object.fromEntries(steps.flatMap((s, i) => s.joins.map((id) => [id, i]))), [steps]);
  const cumWorks = useMemo(() => { let n = 0; return steps.map((s) => (n += s.bricks.length)); }, [steps]);
  const cumPeople = useMemo(() => { let n = 0; return steps.map((s) => (n += s.joins.length)); }, [steps]);
  // scroll budget: a short hold on the first candle, then each year gets more scroll the more it built
  const segs = useMemo(() => {
    const w = [0.8, ...steps.slice(1).map((s) => 0.8 + 0.15 * s.bricks.length)];
    const sum = w.reduce((a, b) => a + b, 0);
    let acc = 0;
    return w.map((x) => { const a = acc / sum; acc += x; return [a, acc / sum] as const; });
  }, [steps]);

  useEffect(() => {
    const can = canRun3D() && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    setOk(can);
    if (!can) host.current?.closest('[data-walk]')?.setAttribute('data-flat', '');
  }, []);
  useEffect(() => {
    const walk = host.current?.closest<HTMLElement>('[data-walk]');
    if (!walk || !ok) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(walk);
    // progress through the section, read once per frame (no scroll handler); the overlay re-renders only when the year changes
    let raf = 0, lastIdx = -1, lastEnd = false;
    const tick = () => {
      const r = walk.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      // the climb takes the first 86% of the section, the pull-back to the whole chart the rest
      const u = Math.min(1, p / 0.86);
      const k = Math.max(0, segs.findIndex(([, b]) => u <= b));
      const [a, b] = segs[k];
      // each year builds and hops in the first 55% of its scroll, then holds finished for the rest: wherever the reader
      // stops, they mostly see a whole year, not bricks in mid-air
      T.current = k === 0 ? 0 : Math.min(N - 1, k - 1 + Math.min(1, (u - a) / Math.max(1e-6, b - a) / 0.55));
      reveal.current = Math.min(1, Math.max(0, (p - 0.88) / 0.1));
      // the card turns to a year once the camera has arrived there and most of its bricks are down
      const i = Math.min(N - 1, Math.max(0, Math.ceil(T.current - 0.6)));
      if (i !== lastIdx) { lastIdx = i; setIdx(i); }
      const e = p > 0.9;
      if (e !== lastEnd) { lastEnd = e; setEnd(e); }
      if (p > 0.03) setScrolled(true);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [ok, N, segs]);

  if (!ok || reduce) return <div ref={host} className="walk-canvas" aria-hidden="true" />;
  const s = steps[idx];
  return (
    <div ref={host} className="walk-canvas">
      <div className="walk-3d" aria-hidden="true">
        <Suspense fallback={null}>
          <WalkScene T={T} reveal={reveal} steps={steps} crew={crew} joinOf={joinOf} reduce={reduce} visible={visible} small={small} onPick={setPick} next={text.next} />
        </Suspense>
      </div>
      {/* decorative for screen readers: the page's text list carries the same content */}
      <div className="walk-card" aria-hidden="true">
        {text.eyebrow && !end && idx === 0 && <p className="eyebrow">{text.eyebrow}</p>}
        {end ? <>
          <p className="walk-h"><Glued text={text.endH} /></p>
          <p className="walk-cap"><Glued text={text.endP} /></p>
          <p className="walk-cta"><a className="btn" href={text.mailHref} tabIndex={-1}>{text.mail}</a> <a href={text.joinHref} tabIndex={-1}>{text.join} →</a></p>
        </> : <>
          <p className={s.label.length > 5 ? 'walk-year long' : 'walk-year'} key={s.label}>{s.label}</p>
          <p className="walk-cap"><Glued text={s.caption} /></p>
          {s.sub && <p className="walk-sub"><Glued text={s.sub} /></p>}
          {s.anchor && <a className="walk-more" href={s.anchor} tabIndex={-1}>{text.more}</a>}
        </>}
        {(cumPeople[idx] ? text.totals : text.solo) && <p className="walk-tot">{(cumPeople[idx] ? text.totals : text.solo).replace('{w}', String(cumWorks[idx])).replace('{m}', String(cumPeople[idx]))}</p>}
        {/* inside the card, so it never sits on top of the scene */}
        {!end && idx === 0 && <a className="walk-skip" href={text.skipHref} tabIndex={-1}>{text.skip}</a>}
      </div>
      {/* it looks like a button, so it is one: one step down (pointer only; keyboard users have the skip link) */}
      <button type="button" className="walk-hint" aria-hidden="true" tabIndex={-1} data-off={scrolled ? '' : undefined}
        onClick={() => window.scrollBy({ top: window.innerHeight * 0.9, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>{text.hint}</button>
      {pick && <Tip pick={pick} host={host.current} />}
    </div>
  );
}

/** Chinese text whose last four characters stay on one line and whose lines break only between words
    (see src/lib/glue.ts). */
function Glued({ text }: { text: string }) {
  const t = text.replace(/K 喵/g, 'K\u00a0喵');
  const [head, tail] = glueTail(t);
  const words = (s: string) => wordPieces(s).map((w, i) => <span key={i}>{i > 0 && <wbr />}{w}</span>);
  return <span className="wb">{head ? <>{words(head)}<span className="nw">{tail}</span></> : words(t)}</span>;
}

/** The name of what the pointer is over, in page type next to the pointer (kept inside the stage). */
function Tip({ pick, host }: { pick: NonNullable<Pick>; host: HTMLDivElement | null }) {
  const r = host?.getBoundingClientRect();
  if (!r) return null;
  const x = Math.min(r.width - 170, Math.max(170, pick.x - r.left)), y = pick.y - r.top;
  return <span className="walk-tip" aria-hidden="true" style={{ left: x, top: y }}>{pick.text}</span>;
}
