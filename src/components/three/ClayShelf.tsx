import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { canRun3D, usePrefersReducedMotion, useMedia } from './env';
import type { ShelfMember, ShelfRow } from './ShelfScene';

type Props = {
  rows: ShelfRow[];
  /** Mouse: "hover a figure, click to open". */
  hint: string;
  /** Touch: "tap a figure, tap again to open". */
  hintTouch: string;
  /** Shown after a figure's name, e.g. "click to open". */
  open: string;
  openTouch: string;
};

const ShelfScene = lazy(() => import('./ShelfScene'));

/** The members cabinet in 3D. The CSS cabinet underneath is the fallback and stays until this draws.
    Mouse: hover picks a figure, click opens the profile. Touch: the first tap picks, the second opens. */
export default function ClayShelf({ rows, hint, hintTouch, open, openTouch }: Props) {
  const touch = useMedia('(hover: none)');
  const reduce = usePrefersReducedMotion();
  const [ok, setOk] = useState(false);
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState<ShelfMember | null>(null);
  const host = useRef<HTMLDivElement>(null);

  // Same start rule as the home board: never during page load. Desktop: first pointer move / scroll / key, or after 3 s.
  // Touch: the first touch, so a phone CPU never parses three.js unasked.
  useEffect(() => {
    let done = false;
    const start = () => { if (!done) { done = true; setOk(canRun3D()); } };
    const evs = (matchMedia('(hover: none)').matches
      ? ['pointerdown', 'touchstart', 'keydown']
      : ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll']) as string[];
    const go = () => { evs.forEach((e) => removeEventListener(e, go)); clearTimeout(timer); start(); };
    const timer = matchMedia('(hover: none)').matches ? 0 : window.setTimeout(go, 3000);
    evs.forEach((e) => addEventListener(e, go, { passive: true }));
    return () => { clearTimeout(timer); evs.forEach((e) => removeEventListener(e, go)); };
  }, []);
  useEffect(() => {
    if (!host.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(host.current);
    return () => io.disconnect();
  }, [ok]);

  const onHover = (m: ShelfMember | null) => { if (!touch) setActive(m); };
  const onPick = (m: ShelfMember) => {
    if (touch && active?.id !== m.id) { setActive(m); return; }
    window.location.assign(m.href);
  };

  if (!ok) return <div ref={host} className="shelf-canvas" aria-hidden="true" />;
  return (
    <div ref={host} className="shelf-canvas" aria-hidden="true">
      <div style={{ position: 'absolute', inset: 0 }}>
        <Suspense fallback={null}>
          <ShelfScene rows={rows} visible={visible} reduce={reduce} active={active} onHover={onHover} onPick={onPick} />
        </Suspense>
      </div>
      <span className="shelf-hint">
        {active ? <><b>{active.name}</b> · {active.sub} · {touch ? openTouch : open}</> : touch ? hintTouch : hint}
      </span>
    </div>
  );
}
