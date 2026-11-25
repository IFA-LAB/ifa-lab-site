import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { canRun3D, usePrefersReducedMotion, useMedia } from './env';

/** label = short text painted on the board; name = full area name for the hint. */
export type Bar = { key: string; label: string; name: string; count: number; href: string; clay: string };

type Props = {
  bars: Bar[];
  /** Short hint shown under the scene, e.g. "drag to look around". */
  hint: string;
  /** Same hint for touch screens, where there is no hover. */
  hintTouch: string;
  unit: string;
  /** Touch screens, before the scene starts: how to wake it. */
  wake?: string;
};

// three.js (~240 KB gzip) is only fetched and parsed when the scene is about to show.
const KlineScene = lazy(() => import('./KlineScene'));

export default function ClayKline({ bars, hint, hintTouch, unit, wake }: Props) {
  const touch = useMedia('(hover: none)');
  const [ok, setOk] = useState(false);
  const [visible, setVisible] = useState(true);
  const host = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const [active, setActive] = useState<Bar | null>(null);

  // Touch devices: keep the static clay picture until the first touch/key, so three.js never competes with first load on a phone CPU.
  useEffect(() => {
    let done = false;
    const start = () => { if (!done) { done = true; setOk(canRun3D()); } };
    if (matchMedia('(hover: none)').matches) {
      const evs = ['pointerdown', 'touchstart', 'keydown', 'wheel'] as const;
      const go = () => { evs.forEach((e) => removeEventListener(e, go)); start(); };
      evs.forEach((e) => addEventListener(e, go, { passive: true }));
      return () => evs.forEach((e) => removeEventListener(e, go));
    }
    // Desktop: the first mouse move, scroll or key builds it (the entrance plays as a reveal); otherwise after 6 s,
    // so parsing three.js never lands inside page load.
    const evs = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll'] as const;
    const go = () => { evs.forEach((e) => removeEventListener(e, go)); clearTimeout(timer); start(); };
    const timer = setTimeout(go, 6000);
    evs.forEach((e) => addEventListener(e, go, { passive: true }));
    return () => { clearTimeout(timer); evs.forEach((e) => removeEventListener(e, go)); };
  }, []);
  useEffect(() => {
    if (!host.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(host.current);
    return () => io.disconnect();
  }, [ok]);

  // Always render the host div: client:visible needs an element to observe, or it never hydrates.
  if (!ok) return <div ref={host} className="kline-canvas" aria-hidden="true">{touch && wake && <span className="kline-hint">{wake}</span>}</div>;
  return (
    <div ref={host} className="kline-canvas" aria-hidden="true">
      <Suspense fallback={null}>
        <KlineScene bars={bars} visible={visible} reduce={reduce} active={active} onHover={setActive} />
      </Suspense>
      <span className="kline-hint">{active ? <><b>{active.name}</b> · {active.count} {unit}</> : touch ? hintTouch : hint}</span>
    </div>
  );
}
