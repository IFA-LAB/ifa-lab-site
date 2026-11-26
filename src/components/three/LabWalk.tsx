import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { canRun3D, usePrefersReducedMotion, useMedia } from './env';
import type { Pick, WalkMember, WalkStep } from './WalkScene';

const WalkScene = lazy(() => import('./WalkScene'));

type Text = { eyebrow: string; totals: string; hint: string; endH: string; endP: string; mail: string; mailHref: string; join: string; joinHref: string };

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
  const T = useRef(0);
  const host = useRef<HTMLDivElement>(null);
  const N = steps.length;

  const joinOf = useMemo(() => Object.fromEntries(steps.flatMap((s, i) => s.joins.map((id) => [id, i]))), [steps]);
  const cumWorks = useMemo(() => { let n = 0; return steps.map((s) => (n += s.bricks.length)); }, [steps]);
  const cumPeople = useMemo(() => { let n = 0; return steps.map((s) => (n += s.joins.length)); }, [steps]);

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
      T.current = Math.min(N - 1, p * (N - 1) * 1.03);
      const i = Math.min(N - 1, Math.max(0, Math.ceil(T.current - 0.05)));
      if (i !== lastIdx) { lastIdx = i; setIdx(i); }
      const e = p > 0.97;
      if (e !== lastEnd) { lastEnd = e; setEnd(e); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [ok, N]);

  if (!ok || reduce) return <div ref={host} className="walk-canvas" aria-hidden="true" />;
  const s = steps[idx];
  return (
    <div ref={host} className="walk-canvas">
      <div className="walk-3d" aria-hidden="true">
        <Suspense fallback={null}>
          <WalkScene T={T} steps={steps} crew={crew} joinOf={joinOf} reduce={reduce} visible={visible} small={small} onPick={setPick} />
        </Suspense>
      </div>
      {/* decorative for screen readers: the page's text list carries the same content */}
      <div className="walk-card" aria-hidden="true">
        <p className="eyebrow">{text.eyebrow}</p>
        {end ? <>
          <p className="walk-h">{text.endH}</p>
          <p className="walk-cap">{text.endP}</p>
          <p className="walk-cta"><a className="btn" href={text.mailHref} tabIndex={-1}>{text.mail}</a> <a href={text.joinHref} tabIndex={-1}>{text.join} →</a></p>
        </> : <>
          <p className="walk-year" key={s.label}>{s.label}</p>
          <p className="walk-cap">{s.caption}</p>
          {s.sub && <p className="walk-sub">{s.sub}</p>}
        </>}
        <p className="walk-tot">{text.totals.replace('{w}', String(cumWorks[idx])).replace('{m}', String(cumPeople[idx]))}</p>
      </div>
      <span className="walk-hint" aria-hidden="true">{pick ? pick.text : text.hint}</span>
    </div>
  );
}
