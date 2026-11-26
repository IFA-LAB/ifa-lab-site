/** Tiny sound effects, synthesised with Web Audio: no files to download, nothing plays until a click.
    Used by the 3D board (coins, cat) and every K 喵 on the site. */
let ctx: AudioContext | null = null;
const audio = () => {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
};

/** Coin: the classic two-note "ding" (B5 → E6), soft triangle wave so it chimes rather than buzzes. */
export function coin() {
  const a = audio(); if (!a) return;
  const t = a.currentTime;
  const out = a.createGain(); out.gain.value = 0.16; out.connect(a.destination);
  ([[988, 0, 0.09], [1319, 0.075, 0.42]] as const).forEach(([f, at, len]) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t + at);
    g.gain.linearRampToValueAtTime(1, t + at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + at + len);
    o.connect(g).connect(out); o.start(t + at); o.stop(t + at + len + 0.02);
  });
}

/** Cat: a short "mew". A buzzy source glides up then down in pitch while a filter opens and closes
    (m → e → ow), with a little vibrato. Pitch varies a touch each time so it never sounds canned. */
export function meow() {
  const a = audio(); if (!a) return;
  const t = a.currentTime, k = 0.9 + Math.random() * 0.25, len = 0.5;
  const o = a.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(430 * k, t);
  o.frequency.exponentialRampToValueAtTime(780 * k, t + 0.13);
  o.frequency.exponentialRampToValueAtTime(470 * k, t + len);
  const lfo = a.createOscillator(), depth = a.createGain();
  lfo.frequency.value = 7; depth.gain.value = 9; lfo.connect(depth).connect(o.frequency);
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
  f.frequency.setValueAtTime(700, t);
  f.frequency.exponentialRampToValueAtTime(2600, t + 0.12);
  f.frequency.exponentialRampToValueAtTime(900, t + len);
  const g = a.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.13, t + 0.04);
  g.gain.setValueAtTime(0.13, t + len - 0.18);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  o.connect(f).connect(g).connect(a.destination);
  o.start(t); lfo.start(t); o.stop(t + len + 0.02); lfo.stop(t + len + 0.02);
}
