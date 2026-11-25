import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group, Mesh } from 'three';
import { RoundedBox, canRun3D, usePrefersReducedMotion, useMedia, CLAY } from './util';

export type Bar = { key: string; label: string; count: number; href: string };

type Props = {
  bars: Bar[];
  /** Short hint shown under the scene, e.g. "drag to look around". */
  hint: string;
  /** Same hint for touch screens, where there is no hover. */
  hintTouch: string;
  unit: string;
};

/** Clay palette (light values; the scene keeps one look in both themes, like a physical toy). */
const UP = CLAY.up;
const DOWN = CLAY.down;
const PLATE = '#f3f5f8';
const SUN = '#f2b544';
const FUR = '#3a4252';

/** One candle = one research area. Body height grows with the number of works in that area. */
function Candle({ bar, x, base, up, reduce, onHover }: { bar: Bar; x: number; base: number; up: boolean; reduce: boolean; onHover: (b: Bar | null) => void }) {
  const g = useRef<Group>(null);
  const squish = useRef({ v: 0, x: 0 }); // spring state for the press-and-bounce
  const bodyH = 0.45 + bar.count * 0.16;
  const color = up ? UP : DOWN;

  useFrame((_, dt) => {
    const s = squish.current;
    // critically-damped-ish spring back to 0
    const k = 180, d = 14;
    s.v += (-k * s.x - d * s.v) * Math.min(dt, 1 / 30);
    s.x += s.v * Math.min(dt, 1 / 30);
    if (g.current) {
      g.current.scale.set(1 - s.x * 0.5, 1 + s.x, 1 - s.x * 0.5);
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
function Cat({ reduce }: { reduce: boolean }) {
  const tail = useRef<Mesh>(null);
  const head = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (reduce) return;
    const t = clock.getElapsedTime();
    if (tail.current) tail.current.rotation.z = 0.6 + Math.sin(t * 2.2) * 0.25;
    if (head.current) head.current.rotation.z = Math.sin(t * 0.9) * 0.06;
  });
  const fur = <meshStandardMaterial color={FUR} roughness={0.9} />;
  return (
    <group position={[3.25, 0, 1.2]} rotation={[0, -0.5, 0]} scale={0.8}>
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

function World({ bars, reduce, onHover }: { bars: Bar[]; reduce: boolean; onHover: (b: Bar | null) => void }) {
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
        <meshStandardMaterial color={PLATE} roughness={0.9} />
      </RoundedBox>
      {layout.map((l) => <Candle key={l.bar.key} {...l} reduce={reduce} onHover={onHover} />)}
      <Coin position={[-2.4, 3.9, -1.2]} phase={0} reduce={reduce} />
      <Coin position={[0.4, 4.4, -1.0]} phase={1.7} reduce={reduce} />
      <Coin position={[2.6, 3.7, -0.8]} phase={3.4} reduce={reduce} />
      <Cat reduce={reduce} />
    </group>
  );
}

export default function ClayKline({ bars, hint, hintTouch, unit }: Props) {
  const touch = useMedia('(hover: none)');
  const [ok, setOk] = useState(false);
  const [visible, setVisible] = useState(true);
  const host = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const [active, setActive] = useState<Bar | null>(null);

  useEffect(() => setOk(canRun3D()), []);
  useEffect(() => {
    if (!host.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(host.current);
    return () => io.disconnect();
  }, [ok]);
  // Tell the static fallback underneath to fade out once the canvas is live.
  useEffect(() => {
    if (ok) host.current?.closest('[data-kline]')?.setAttribute('data-live', '');
  }, [ok]);

  // Always render the host div: client:visible needs an element to observe, or it never hydrates.
  if (!ok) return <div ref={host} className="kline-canvas" aria-hidden="true" />;
  return (
    <div ref={host} className="kline-canvas" aria-hidden="true">
      <Canvas
        shadows="percentage"
        dpr={[1, 1.75]}
        frameloop={visible ? 'always' : 'never'}
        camera={{ position: [7.9, 6.6, 12.4], fov: 30 }}
        onCreated={({ camera }) => camera.lookAt(0.35, 1.1, 0)}
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
        <World bars={bars} reduce={reduce} onHover={setActive} />
      </Canvas>
      <span className="kline-hint">{active ? <><b>{active.label}</b> · {active.count} {unit}</> : touch ? hintTouch : hint}</span>
    </div>
  );
}
