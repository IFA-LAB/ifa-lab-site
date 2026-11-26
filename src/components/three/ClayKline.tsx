import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { coin, meow } from '@/lib/sfx';
import { canRun3D, usePrefersReducedMotion, useMedia } from './env';

/** label = short text painted on the board; name = full area name for the hint. */
export type Bar = { key: string; label: string; name: string; count: number; href: string; clay: string };
/** One step of the timeline: works per area counted up to and including that year. */
export type Step = { label: string; counts: Record<string, number> };

type Props = {
  bars: Bar[];
  /** Cumulative counts, oldest first; the last step is "now" and matches bars[].count. */
  steps?: Step[];
  /** Short hint shown under the scene, e.g. "drag to look around". */
  hint: string;
  /** Same hint for touch screens, where there is no hover. */
  hintTouch: string;
  unit: string;
  /** Touch screens, before the scene starts: how to wake it. */
  wake?: string;
  /** UI strings for the timeline and the toys. */
  text?: { play: string; pause: string; year: string; total: string; more?: string; replay?: string; coin: string[]; cat: string[] };
};

// three.js (~240 KB gzip) is only fetched and parsed when the scene is about to show.
const KlineScene = lazy(() => import('./KlineScene'));

export default function ClayKline({ bars, steps = [], hint, hintTouch, unit, wake, text }: Props) {
  const touch = useMedia('(hover: none)');
  const [ok, setOk] = useState(false);
  const [visible, setVisible] = useState(true);
  const host = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const [active, setActive] = useState<Bar | null>(null);
  const last = Math.max(0, steps.length - 1);
  const [step, setStep] = useState(last);
  const [playing, setPlaying] = useState(false);
  const [say, setSay] = useState<string | null>(null);
  const sayTimer = useRef(0);
  const toyN = useRef({ coin: 0, cat: 0 });

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

  // Play: one year every 700 ms from the first step to now. Starting at "now" rewinds first.
  useEffect(() => {
    if (!playing) return;
    if (step >= last) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => Math.min(last, s + 1)), reduce ? 250 : 700);
    return () => clearTimeout(id);
  }, [playing, step, last, reduce]);
  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    if (step >= last) setStep(0);
    setPlaying(true);
  };

  const shown = useMemo(
    () => (steps.length ? bars.map((b) => ({ ...b, count: steps[step]?.counts[b.key] ?? 0 })) : bars),
    [bars, steps, step],
  );
  const total = shown.reduce((n, b) => n + b.count, 0);
  const atNow = step >= last;
  // what this step added: the area that grew most since the previous step (the cat goes to look at it)
  const grew = useMemo(() => {
    if (!steps.length || step === 0) return null;
    const prev = steps[step - 1].counts, cur = steps[step].counts;
    let best: { bar: Bar; n: number } | null = null;
    for (const b of bars) { const n = (cur[b.key] ?? 0) - (prev[b.key] ?? 0); if (n > 0 && (!best || n > best.n)) best = { bar: b, n }; }
    return best;
  }, [bars, steps, step]);
  const added = steps.length && step > 0 ? total - bars.reduce((n, b) => n + (steps[step - 1].counts[b.key] ?? 0), 0) : 0;

  const onToy = (what: 'coin' | 'cat') => {
    (what === 'coin' ? coin : meow)();
    const lines = text?.[what] ?? [];
    if (!lines.length) return;
    setSay(lines[toyN.current[what]++ % lines.length]);
    clearTimeout(sayTimer.current);
    sayTimer.current = window.setTimeout(() => setSay(null), 3200);
  };

  // Always render the host div: client:visible needs an element to observe, or it never hydrates.
  if (!ok) return <div ref={host} className="kline-canvas" aria-hidden="true">{touch && wake && <span className="kline-hint">{wake}</span>}</div>;
  const activeNow = active ? shown.find((b) => b.key === active.key) ?? active : null;
  return (
    <div ref={host} className="kline-canvas">
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
        <Suspense fallback={null}>
          <KlineScene bars={shown} visible={visible} reduce={reduce} active={active} onHover={setActive} onToy={onToy} lookAt={!atNow && grew ? grew.bar.key : null} />
        </Suspense>
      </div>
      {steps.length > 1 && text && (
        <div className="kline-time" role="group" aria-label={text.year}>
          <button type="button" className="kline-play" onClick={togglePlay} aria-label={playing ? text.pause : text.play} aria-pressed={playing}>
            {playing
              ? <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1.2" /><rect x="9.5" y="2" width="3.5" height="12" rx="1.2" /></svg>
              : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11a1 1 0 0 0 1.5.86l9-5.5a1 1 0 0 0 0-1.72l-9-5.5A1 1 0 0 0 4 2.5Z" /></svg>}
          </button>
          <span className="kline-year">
            <b>{steps[step]?.label}</b>
            <small>{total} {text.total}{atNow && !playing && text.replay ? ` · ${text.replay.replace('{y}', steps[0].label)}` : ''}</small>
          </span>
          <input
            type="range" min={0} max={last} step={1} value={step}
            aria-label={text.year} aria-valuetext={`${steps[step]?.label}, ${total} ${text.total}`}
            onChange={(e) => { setPlaying(false); setStep(+e.currentTarget.value); }}
          />
        </div>
      )}
      <span className="kline-hint" aria-live="polite">
        {say ? say
          : activeNow ? <><b>{activeNow.name}</b> · {activeNow.count} {unit}{!atNow && steps[step] ? ` (${steps[step].label})` : ''}</>
          : !atNow && grew ? <><b>{steps[step].label}</b> · {grew.bar.name} +{grew.n}{added > grew.n ? ` · ${text?.more ?? '+'}${added - grew.n}` : ''}</>
          : touch ? hintTouch : hint}
      </span>
    </div>
  );
}
