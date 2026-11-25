import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CanvasTexture, SRGBColorSpace, type Group, type Mesh, type PerspectiveCamera } from 'three';
import { RoundedBox, useMedia, CLAY } from './util';
import type { Bar } from './ClayKline';

/** Clay palette (light values; the scene keeps one look in both themes, like a physical toy). */
const UP = CLAY.up;
const DOWN = CLAY.down;
const PLATE = '#f3f5f8';
const PLATE_DARK = '#3a4556';
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

/** Area name painted on the board in front of its candle. */
function Label({ text, x, dark }: { text: string; x: number; dark: boolean }) {
  // redraw once the web font for these glyphs has arrived
  const [fontReady, setFontReady] = useState(0);
  useEffect(() => {
    document.fonts?.load(`118px Huninn`, text).then(() => setFontReady(1), () => {});
  }, [text]);
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 176;
    const g = c.getContext('2d')!;
    g.fillStyle = dark ? '#f1f5fa' : '#1d2633';
    g.font = '400 118px Huninn, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 92, 504);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
    return t;
  }, [text, dark, fontReady]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[x, 0.011, 1.88]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1.2, 0.41]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
}

/** One candle = one research area. Body height grows with the number of works in that area. */
function Candle({ bar, x, base, up, reduce, onHover, delay }: { bar: Bar; x: number; base: number; up: boolean; reduce: boolean; onHover: (b: Bar | null) => void; delay: number }) {
  const g = useRef<Group>(null);
  const squish = useRef({ v: 0, x: 0 }); // spring state for the press-and-bounce
  const grow = useRef({ t: reduce ? 1 : 0, age: 0 }); // 0→1 rise on load, staggered
  const bodyH = 0.45 + bar.count * 0.16;
  const color = up ? UP : DOWN;

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
    if (g.current) {
      g.current.scale.set(1 - s.x * 0.5, Math.max(0.001, e) * (1 + s.x), 1 - s.x * 0.5);
    }
  });

  const poke = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!reduce) squish.current.v -= 4.5;
  };

  return (
    <group position={[x, base, 0]}>
      <group
        ref={g}
        onPointerOver={(e) => { e.stopPropagation(); onHover(bar); document.body.style.cursor = 'pointer'; poke(e); }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = ''; }}
        onClick={(e) => { e.stopPropagation(); window.location.href = bar.href; }}
      >
        <mesh position={[0, bodyH / 2 + 0.35, 0]} castShadow>
          <capsuleGeometry args={[0.07, bodyH + 0.55, 4, 12]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
        <RoundedBox args={[0.7, bodyH, 0.7]} radius={0.2} smoothness={5} position={[0, bodyH / 2 + 0.35, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={color} roughness={0.85} />
        </RoundedBox>
      </group>
    </group>
  );
}

function Coin({ position, phase, reduce }: { position: [number, number, number]; phase: number; reduce: boolean }) {
  const m = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!m.current || reduce) return;
    const t = clock.getElapsedTime();
    m.current.position.y = position[1] + Math.sin(t * 1.1 + phase) * 0.12;
    m.current.rotation.z = t * 0.6 + phase;
  });
  return (
    <mesh ref={m} position={position} rotation={[Math.PI / 2.4, 0, 0]} castShadow>
      <cylinderGeometry args={[0.38, 0.38, 0.14, 40]} />
      <meshStandardMaterial color={SUN} roughness={0.75} />
    </mesh>
  );
}

/** The advisor's cat, because of course. */
function Cat({ reduce, targetX }: { reduce: boolean; targetX: number | null }) {
  const tail = useRef<Mesh>(null);
  const head = useRef<Mesh>(null);
  const body = useRef<Group>(null);
  const home = 3.95;
  useFrame(({ clock }, dt) => {
    if (reduce) return;
    const t = clock.getElapsedTime();
    const b = body.current;
    if (b) {
      // trot along the front edge toward the hovered candle, then sit and face the viewer
      const goal = targetX === null ? home : Math.min(3.95, Math.max(-3.6, targetX + 0.75));
      const dx = goal - b.position.x;
      const step = Math.sign(dx) * Math.min(Math.abs(dx), dt * 3.2);
      b.position.x += step;
      const moving = Math.abs(dx) > 0.02;
      const face = moving ? (dx > 0 ? 0 : Math.PI) : -0.5;
      b.rotation.y += (face - b.rotation.y) * Math.min(1, dt * 8);
      b.position.y = moving ? Math.abs(Math.sin(t * 14)) * 0.08 : 0;
    }
    if (tail.current) tail.current.rotation.z = 0.6 + Math.sin(t * 2.2) * 0.25;
    if (head.current) head.current.rotation.z = Math.sin(t * 0.9) * 0.06;
  });
  const fur = <meshStandardMaterial color={FUR} roughness={0.9} />;
  return (
    <group ref={body} position={[home, 0, 0.75]} rotation={[0, -0.5, 0]} scale={0.8}>
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

function World({ bars, reduce, onHover, active, dark }: { bars: Bar[]; reduce: boolean; onHover: (b: Bar | null) => void; active: Bar | null; dark: boolean }) {
  const world = useRef<Group>(null);
  const target = useRef({ x: 0, y: 0 });

  // Rising trend: each candle opens near the previous close; colour follows the step direction.
  const layout = useMemo(() => {
    let level = 0;
    return bars.map((b, i) => {
      const up = i % 3 !== 1; // mostly up, a couple of red/green alternations
      const base = level;
      level += up ? 0.32 : -0.12;
      return { bar: b, x: -3.1 + i * 1.25, base: Math.max(base, 0), up };
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
      {layout.map((l, i) => <Candle key={l.bar.key} {...l} delay={0.15 + i * 0.09} reduce={reduce} onHover={onHover} />)}
      {layout.map((l) => <Label key={l.bar.key} text={l.bar.label} x={l.x} dark={dark} />)}
      <Coin position={[-2.4, 3.9, -1.2]} phase={0} reduce={reduce} />
      <Coin position={[0.4, 4.4, -1.0]} phase={1.7} reduce={reduce} />
      <Coin position={[2.6, 3.7, -0.8]} phase={3.4} reduce={reduce} />
      <Cat reduce={reduce} targetX={active ? layout.find((l) => l.bar.key === active.key)?.x ?? null : null} />
    </group>
  );
}

export default function KlineScene({ bars, visible, reduce, active, onHover }: { bars: Bar[]; visible: boolean; reduce: boolean; active: Bar | null; onHover: (b: Bar | null) => void }) {
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
      <World bars={bars} reduce={reduce} onHover={onHover} active={active} dark={dark} />
    </Canvas>
  );
}
