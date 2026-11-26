import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CanvasTexture, Color, SRGBColorSpace, type Group, type Mesh, type PerspectiveCamera } from 'three';
import { RoundedBox, TagSprite, useMedia, CLAY } from './util';
import type { Bar } from './ClayKline';

/** Clay palette (light values; the scene keeps one look in both themes, like a physical toy). */
const UP = CLAY.up;
const DOWN = CLAY.down;
const PLATE = '#f3f5f8';
const PLATE_DARK = '#5a6780';
const SUN = '#f2b544';
const FUR = '#3a4252';

/** Follows the site's theme toggle (data-theme on <html>) and the OS setting. */
function useDark() {
  const os = useMedia('(prefers-color-scheme: dark)');
  const [attr, setAttr] = useState<string | undefined>(undefined);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setAttr(el.dataset.theme);
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return attr ? attr === 'dark' : os;
}

/** A clay desk nameplate in front of each candle, tilted toward the viewer so the name reads at a glance. */
function Label({ text, x, dark, on, fill }: { text: string; x: number; dark: boolean; on: boolean; fill: string }) {
  // redraw once the web font for these glyphs has arrived
  const [fontReady, setFontReady] = useState(0);
  useEffect(() => {
    document.fonts?.load(`120px Huninn`, text).then(() => setFontReady(1), () => {});
  }, [text]);
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 280;
    const g = c.getContext('2d')!;
    g.fillStyle = '#1d2633';
    g.font = '400 120px Huninn, Fredoka, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    // long names: CJK splits in half, Latin splits at a space; a single long word shrinks to fit instead
    const w = g.measureText(text).width;
    const cjk = /[㐀-鿿]/.test(text);
    const sp = text.lastIndexOf(' ', Math.ceil(text.length / 2) + 1);
    // short Latin names ("Apps & Viz") shrink onto one line instead of breaking
    const lines = w <= 480 || (!cjk && text.length <= 12) || (cjk && text.length <= 8) ? [text]
      : cjk ? [text.slice(0, Math.ceil(text.length / 2)).trim(), text.slice(Math.ceil(text.length / 2)).trim()]
      : sp > 0 ? [text.slice(0, sp).trim(), text.slice(sp).trim()]
      : [text];
    if (lines.length === 1) {
      if (w > 480) g.font = g.font.replace('120px', `${Math.floor((120 * 480) / w)}px`);
      g.fillText(text, 256, 148);
    } else { g.font = g.font.replace('120px', '104px'); g.fillText(lines[0], 256, 84, 490); g.fillText(lines[1], 256, 204, 490); }
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace; t.anisotropy = 8;
    return t;
  }, [text, dark, fontReady, on]);
  useEffect(() => () => tex.dispose(), [tex]);
  // the plate wears a pale coat of its area colour, so board, legend and cards all speak one colour code
  const tint = useMemo(() => '#' + new Color(fill).lerp(new Color(dark ? '#3a4558' : '#ffffff'), dark ? 0.3 : 0.5).getHexString(), [fill, dark]);
  return (
    <group position={[x, on ? 0.18 : 0, 0.82]} rotation={[on ? -0.45 : -0.62, 0, 0]}>
      <RoundedBox args={[1.14, 0.62, 0.12]} radius={0.05} smoothness={3} position={[0, 0.31, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={on ? fill : tint} roughness={0.9} />
      </RoundedBox>
      <mesh position={[0, 0.31, 0.062]}>
        <planeGeometry args={[1.1, 0.6]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/** One candle = one research area. Body height grows with the number of works in that area. */
function Candle({ bar, x, base, up, reduce, onHover, delay, on, unit }: { bar: Bar; x: number; base: number; up: boolean; reduce: boolean; onHover: (b: Bar | null) => void; delay: number; on: boolean; unit: string }) {
  const g = useRef<Group>(null);
  const lift = useRef<Group>(null);
  const squish = useRef({ v: 0, x: 0 }); // spring state for the press-and-bounce
  const grow = useRef({ t: reduce ? 1 : 0, age: 0 }); // 0→1 rise on load, staggered
  const bodyH = 0.45 + bar.count * 0.16;
  // timeline: when the count changes, the new geometry starts at the old height and eases to the new one;
  // an area with no work yet shrinks to a stub
  const hs = useRef({ x: 1, to: 1, prev: bodyH });
  if (hs.current.prev !== bodyH) {
    const h = hs.current;
    h.x = reduce ? 1 : (h.x * (0.45 + h.prev)) / (0.45 + bodyH);
    h.prev = bodyH;
  }
  hs.current.to = bar.count === 0 ? 0.001 : 1; // no work yet: the candle is not on the board
  const color = (CLAY as Record<string, string>)[bar.clay] ?? (up ? UP : DOWN); // area colour, same as the cards below

  useFrame((_, dt) => {
    const s = squish.current;
    // critically-damped-ish spring back to 0
    const k = 180, d = 14;
    s.v += (-k * s.x - d * s.v) * Math.min(dt, 1 / 30);
    s.x += s.v * Math.min(dt, 1 / 30);
    const r = grow.current;
    r.age += dt;
    if (r.t < 1 && r.age > delay) r.t = Math.min(1, r.t + dt / 0.7);
    // ease-out-back: overshoot a touch, like a soft block settling
    const k1 = 1.4, u = r.t - 1, e = 1 + (k1 + 1) * u * u * u + k1 * u * u;
    const h = hs.current;
    h.x += (h.to - h.x) * (reduce ? 1 : Math.min(1, dt * 9));
    // picked: the candle rises a little off the board
    if (lift.current) lift.current.position.y += ((on ? 0.28 : 0) - lift.current.position.y) * (reduce ? 1 : Math.min(1, dt * 10));
    if (g.current) {
      const sy = Math.max(0.001, e * h.x) * (1 + s.x);
      g.current.scale.set(1 - s.x * 0.5, sy, 1 - s.x * 0.5);
      g.current.visible = sy > 0.02; // a flattened candle would z-fight with the board
    }
  });

  const poke = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!reduce) squish.current.v -= 4.5;
  };

  return (
    <group position={[x, base, 0]}>
      {on && <TagSprite text={`${bar.name} · ${bar.count} ${unit}`} position={[0, bodyH + 1.2, 0.9]} height={0.46} />}
      <group ref={lift}>
      <group
        ref={g}
        onPointerOver={(e) => { e.stopPropagation(); onHover(bar); document.body.style.cursor = 'pointer'; poke(e); }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = ''; }}
        onClick={(e) => { e.stopPropagation(); window.location.href = bar.href; }}
      >
        <mesh position={[0, bodyH / 2 + 0.35, 0]} castShadow>
          <capsuleGeometry args={[0.07, bodyH + 0.55, 4, 12]} />
          <meshStandardMaterial color={color} roughness={0.85} emissive={color} emissiveIntensity={on ? 0.35 : 0} />
        </mesh>
        <RoundedBox args={[0.7, bodyH, 0.7]} radius={0.2} smoothness={5} position={[0, bodyH / 2 + 0.35, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={color} roughness={0.85} emissive={color} emissiveIntensity={on ? 0.35 : 0} />
        </RoundedBox>
      </group>
      </group>
    </group>
  );
}

function Coin({ position, phase, reduce, onFlip }: { position: [number, number, number]; phase: number; reduce: boolean; onFlip: () => void }) {
  const m = useRef<Mesh>(null);
  const flip = useRef(1); // 0→1 over one flip
  useFrame(({ clock }, dt) => {
    if (!m.current || reduce) return;
    const t = clock.getElapsedTime();
    const f = flip.current;
    if (f < 1) flip.current = Math.min(1, f + dt / 0.7);
    const arc = Math.sin(Math.PI * flip.current); // up and back down
    m.current.position.y = position[1] + Math.sin(t * 1.1 + phase) * 0.12 + arc * 0.9;
    m.current.rotation.x = Math.PI / 2.4 + flip.current * Math.PI * 4 * (f < 1 ? 1 : 0);
    m.current.rotation.z = Math.sin(t * 0.7 + phase) * 0.55; // wobble, never edge-on
  });
  return (
    <mesh
      ref={m} position={position} rotation={[Math.PI / 2.4, 0, 0]} castShadow
      onClick={(e) => { e.stopPropagation(); if (flip.current >= 1) flip.current = 0; onFlip(); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      <cylinderGeometry args={[0.38, 0.38, 0.14, 40]} />
      <meshStandardMaterial color={SUN} roughness={0.75} />
    </mesh>
  );
}

/** The advisor's cat, because of course. */
function Cat({ reduce, targetX, dark, onPet }: { reduce: boolean; targetX: number | null; dark: boolean; onPet: () => void }) {
  const tail = useRef<Mesh>(null);
  const hop = useRef(1);
  const head = useRef<Mesh>(null);
  const body = useRef<Group>(null);
  // rests in the back-right corner, beside the last candle; trots to the front edge when a candle is hovered
  const home = { x: 4.0, z: -1.25 }; // behind the last candle's shoulder, clear of its nameplate
  useFrame(({ clock }, dt) => {
    if (reduce) return;
    const t = clock.getElapsedTime();
    const b = body.current;
    if (b) {
      const gx = targetX === null ? home.x : Math.min(4.0, Math.max(-3.6, targetX + 0.66));
      const gz = targetX === null ? home.z : -1.15; // behind the picked candle's shoulder: it looks on without covering the nameplate or the tag
      const dx = gx - b.position.x, dz = gz - b.position.z;
      const d = Math.hypot(dx, dz);
      const k = d > 0 ? Math.min(d, dt * 3.4) / d : 0;
      b.position.x += dx * k;
      b.position.z += dz * k;
      const moving = d > 0.02;
      const face = moving ? Math.atan2(-dz, dx) : -0.5;
      b.rotation.y += (face - b.rotation.y) * Math.min(1, dt * 8);
      if (hop.current < 1) hop.current = Math.min(1, hop.current + dt / 0.5);
      b.position.y = (moving ? Math.abs(Math.sin(t * 14)) * 0.08 : 0) + Math.sin(Math.PI * hop.current) * 0.7;
    }
    if (tail.current) tail.current.rotation.z = 0.6 + Math.sin(t * 2.2) * 0.25;
    if (head.current) head.current.rotation.z = Math.sin(t * 0.9) * 0.06;
  });
  const fur = <meshStandardMaterial color={dark ? '#5d667a' : FUR} roughness={0.9} />;
  return (
    <group
      ref={body} position={[home.x, 0, home.z]} rotation={[0, -0.5, 0]} scale={0.72}
      onClick={(e) => { e.stopPropagation(); if (hop.current >= 1) hop.current = 0; onPet(); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      <mesh position={[0, 0.5, 0]} scale={[1.15, 0.85, 0.9]} castShadow><sphereGeometry args={[0.62, 32, 24]} />{fur}</mesh>
      <mesh ref={head} position={[0.55, 1.15, 0]} castShadow><sphereGeometry args={[0.46, 32, 24]} />{fur}</mesh>
      <mesh position={[0.48, 1.6, 0.22]} rotation={[0, 0, 0.15]} castShadow><coneGeometry args={[0.16, 0.32, 16]} />{fur}</mesh>
      <mesh position={[0.48, 1.6, -0.22]} rotation={[0, 0, 0.15]} castShadow><coneGeometry args={[0.16, 0.32, 16]} />{fur}</mesh>
      <mesh position={[0.98, 1.1, 0]}><sphereGeometry args={[0.06, 12, 8]} /><meshStandardMaterial color="#f2a3b3" roughness={0.8} /></mesh>
      <mesh position={[0.9, 1.25, 0.17]}><sphereGeometry args={[0.07, 12, 8]} /><meshStandardMaterial color="#ffffff" roughness={0.6} /></mesh>
      <mesh position={[0.9, 1.25, -0.17]}><sphereGeometry args={[0.07, 12, 8]} /><meshStandardMaterial color="#ffffff" roughness={0.6} /></mesh>
      <mesh ref={tail} position={[-0.75, 0.85, 0]} rotation={[0, 0, 0.6]} castShadow><capsuleGeometry args={[0.1, 0.8, 4, 12]} />{fur}</mesh>
    </group>
  );
}

/** Narrow (portrait-ish) canvases get a wider lens so the whole board stays in frame. */
function Lens() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    const aspect = size.width / size.height;
    cam.fov = aspect < 1.35 ? 27 * (1.35 / aspect) ** 0.9 : 27;
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

function World({ bars, reduce, onHover, active, dark, onToy, lookAt, unit }: { unit: string; bars: Bar[]; reduce: boolean; onHover: (b: Bar | null) => void; active: Bar | null; dark: boolean; onToy: (what: 'coin' | 'cat') => void; lookAt: string | null }) {
  const compact = useThree((st) => st.size.width) < 560;
  const world = useRef<Group>(null);
  const target = useRef({ x: 0, y: 0 });

  // Rising trend: each candle opens near the previous close; colour follows the step direction.
  const layout = useMemo(() => {
    let level = 0;
    return bars.map((b, i) => {
      const up = i % 3 !== 1; // mostly up, a couple of red/green alternations
      const base = level;
      level += up ? 0.32 : -0.12;
      return { bar: b, x: -3.1 + i * 1.25, base: 0 * base, up };
    });
  }, [bars]);

  useFrame(({ pointer }) => {
    if (!world.current || reduce) return;
    target.current.x += (pointer.x * 0.35 - target.current.x) * 0.05;
    target.current.y += (-pointer.y * 0.08 - target.current.y) * 0.05;
    world.current.rotation.y = target.current.x;
    world.current.rotation.x = target.current.y;
  });

  return (
    <group ref={world}>
      <RoundedBox args={[9, 0.6, 4.4]} radius={0.28} smoothness={6} position={[0, -0.3, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={dark ? PLATE_DARK : PLATE} roughness={0.9} />
      </RoundedBox>
      {layout.map((l, i) => <Candle key={l.bar.key} {...l} delay={0.15 + i * 0.09} reduce={reduce} onHover={onHover} on={active?.key === l.bar.key} unit={unit} />)}
      {!compact && layout.map((l) => <Label key={l.bar.key} text={l.bar.label} x={l.x} dark={dark} on={active?.key === l.bar.key} fill={(CLAY as Record<string, string>)[l.bar.clay] ?? CLAY.grey} />)}
      <Coin position={[compact ? -2.4 : -0.9, compact ? 2.4 : 3.7, -1.2]} phase={0} reduce={reduce} onFlip={() => onToy('coin')} />
      <Coin position={[compact ? 0.4 : 1.1, compact ? 3.2 : 4.05, -1.0]} phase={1.7} reduce={reduce} onFlip={() => onToy('coin')} />
      <Coin position={[compact ? 2.6 : 3.0, compact ? 2.7 : 3.45, -0.8]} phase={3.4} reduce={reduce} onFlip={() => onToy('coin')} />
      <Cat onPet={() => onToy('cat')} dark={dark} reduce={reduce} targetX={(() => { const k = active?.key ?? lookAt; return k ? layout.find((l) => l.bar.key === k)?.x ?? null : null; })()} />
    </group>
  );
}

export default function KlineScene({ bars, visible, reduce, active, onHover, onToy, lookAt = null, unit = '' }: { unit?: string; bars: Bar[]; visible: boolean; reduce: boolean; active: Bar | null; onHover: (b: Bar | null) => void; onToy: (what: 'coin' | 'cat') => void; lookAt?: string | null }) {
  const dark = useDark();
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.75]}
      frameloop={visible ? 'always' : 'never'}
      camera={{ position: [7.9, 6.6, 12.4], fov: 27 }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0.35, 1.1, 0);
        // tell the static clay picture underneath to fade out now that the canvas is live
        gl.domElement.closest('[data-kline]')?.setAttribute('data-live', '');
      }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
    >
      <hemisphereLight args={['#ffffff', '#b9c6d8', 1.6]} />
      <directionalLight
        position={[5, 9, 6]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-radius={6}
        shadow-bias={-0.0005}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <Lens />
      <World bars={bars} reduce={reduce} onHover={onHover} active={active} dark={dark} onToy={onToy} lookAt={lookAt} unit={unit} />
    </Canvas>
  );
}
