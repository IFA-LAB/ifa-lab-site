import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { canRun3D, usePrefersReducedMotion, useMedia } from './env';
import type { Pick, WalkBar, WalkCol, WalkRow } from './WalkScene';

const WalkScene = lazy(() => import('./WalkScene'));

/** The lab walk: one 3D scene behind the page; scrolling the [data-walk] section moves the camera from station to station.
    Without WebGL2 or with reduced motion nothing mounts and the page's own text and links carry everything. */
export default function LabWalk({ bars, cols, rows, mail, mailLabel, hint }: { bars: WalkBar[]; cols: WalkCol[]; rows: WalkRow[]; mail: string; mailLabel: string; hint: string }) {
  const reduce = usePrefersReducedMotion();
  const small = useMedia('(max-width: 767px)');
  const [ok, setOk] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pick, setPick] = useState<Pick>(null);
  const p = useRef(0);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const can = canRun3D() && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    setOk(can);
    // no 3D: the section drops its pinned stage and the cards read as a plain page
    if (!can) host.current?.closest('[data-walk]')?.setAttribute('data-flat', '');
  }, []);
  useEffect(() => {
    const walk = host.current?.closest<HTMLElement>('[data-walk]');
    if (!walk) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(walk);
    // progress through the walk section, read once per frame (no scroll handler)
    let raf = 0;
    const tick = () => {
      const r = walk.getBoundingClientRect();
      p.current = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [ok]);

  if (!ok || reduce) return <div ref={host} className="walk-canvas" aria-hidden="true" />;
  return (
    <div ref={host} className="walk-canvas" aria-hidden="true">
      <Suspense fallback={null}>
        <WalkScene p={p} bars={bars} cols={cols} rows={rows} mail={mail} mailLabel={mailLabel} reduce={reduce} visible={visible} small={small} onPick={setPick} />
      </Suspense>
      <span className="walk-hint">{pick ? pick.text : hint}</span>
    </div>
  );
}
