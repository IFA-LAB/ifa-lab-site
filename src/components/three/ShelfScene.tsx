import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, Color, SRGBColorSpace, type Group, type MeshStandardMaterial } from 'three';
import { CLAY, RoundedBox } from './util';
import { Accessory, BODY_Y, Face, R, type Accessory as AccessoryKind } from './figure';

export type ShelfMember = { id: string; name: string; sub: string; clay: string; accessory: AccessoryKind; href: string };
export type ShelfRow = { label: string; members: ShelfMember[] };

const GAP = 2.5; // shelf height
const W = 7.6; // inner width
const DEPTH = 1.9;
const SPACING = 2.2;
const SCALE = 0.62;
const WOOD = '#f3f5f8';
const BACK = '#eef2f7';
const GLOW = new Color('#4f7fc4');

/** The cohort name painted on the plank's front edge. */
function PlankLabel({ text, y }: { text: string; y: number }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#5b6779';
    g.font = '600 76px Huninn, Fredoka, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif';
    g.textBaseline = 'middle';
    g.fillText(text, 24, 68, 980);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace; t.anisotropy = 8;
    return t;
  }, [text]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[-W / 2 + 0.2 + 2.1, y - 0.23, DEPTH / 2 + 0.005]}>
      <planeGeometry args={[4.2, 0.525]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
}

/** One plank; it glows faintly in the accent colour while one of its figures is picked. */
function Plank({ y, lit }: { y: number; lit: boolean }) {
  const mat = useRef<MeshStandardMaterial>(null);
  useFrame(() => {
    if (!mat.current) return;
    const k = mat.current.emissiveIntensity;
    mat.current.emissiveIntensity = k + ((lit ? 0.28 : 0) - k) * 0.12;
  });
  return (
    <RoundedBox args={[W + 0.6, 0.46, DEPTH]} radius={0.12} smoothness={3} position={[0, y - 0.23, 0]} castShadow receiveShadow>
      <meshStandardMaterial ref={mat} color={WOOD} emissive={GLOW} emissiveIntensity={0} roughness={0.92} />
    </RoundedBox>
  );
}

function Figure({ m, x, y, hot, reduce, onHover, onPick, phase }: {
  m: ShelfMember; x: number; y: number; hot: boolean; reduce: boolean; phase: number;
  onHover: (m: ShelfMember | null) => void; onPick: (m: ShelfMember) => void;
}) {
  const g = useRef<Group>(null);
  const body = CLAY[m.clay] ?? CLAY.grey;
  useFrame(({ clock, pointer }) => {
    const o = g.current; if (!o) return;
    if (reduce) { o.position.y = y; return; }
    const t = clock.getElapsedTime() + phase;
    // picked: hops in place; otherwise breathes and turns a little toward the pointer
    const lift = hot ? Math.abs(Math.sin(t * 6)) * 0.32 : 0;
    o.position.y += (y + lift - o.position.y) * (hot ? 0.5 : 0.15);
    const sy = 1 + Math.sin(t * 2) * 0.015;
    o.scale.set(SCALE / Math.sqrt(sy), SCALE * sy, SCALE / Math.sqrt(sy));
    const ty = hot ? Math.sin(t * 3) * 0.25 : pointer.x * 0.5 - x * 0.06;
    o.rotation.y += (ty - o.rotation.y) * 0.08;
  });
  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(m); };
  return (
    <group ref={g} position={[x, y, 0.15]} scale={SCALE}>
      <mesh position={[0, BODY_Y, 0]} scale={R} castShadow>
        <sphereGeometry args={[1, 40, 30]} />
        <meshStandardMaterial color={body} roughness={0.88} />
      </mesh>
      <Face placeholder={false} reduce={reduce} />
      <Accessory kind={m.accessory} body={body} />
      {[-0.42, 0.42].map((fx) => (
        <mesh key={fx} position={[fx, 0.1, 0.2]} scale={[1, 0.55, 1.2]} castShadow>
          <sphereGeometry args={[0.24, 16, 12]} />
          <meshStandardMaterial color={body} roughness={0.88} />
        </mesh>
      ))}
      {/* a generous invisible target, so the small figure is easy to hit */}
      <mesh position={[0, 1.2, 0]} onPointerOver={over} onPointerMove={over} onPointerOut={() => onHover(null)} onClick={(e) => { e.stopPropagation(); onPick(m); }}>
        <boxGeometry args={[2.6, 2.9, 2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** The members cabinet: one plank per cohort, first cohort at the bottom, each member's clay figure standing on it. */
export default function ShelfScene({ rows, visible, reduce, active, onHover, onPick }: {
  rows: ShelfRow[]; visible: boolean; reduce: boolean; active: ShelfMember | null;
  onHover: (m: ShelfMember | null) => void; onPick: (m: ShelfMember) => void;
}) {
  const H = rows.length * GAP;
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      frameloop={visible ? 'always' : 'never'}
      camera={{ position: [0, H * 0.62, 19.5], fov: 32 }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0, H * 0.43, 0);
        gl.domElement.closest('[data-shelf]')?.setAttribute('data-live', '');
      }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      onPointerMissed={() => onHover(null)}
      style={{ cursor: active ? 'pointer' : 'auto' }}
    >
      <hemisphereLight args={['#ffffff', '#c9d4e3', 2]} />
      <directionalLight position={[4, H + 4, 9]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005}
        shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={H + 2} shadow-camera-bottom={-2} />
      {/* the cabinet: back, sides, top */}
      <mesh position={[0, H / 2, -DEPTH / 2 + 0.05]} receiveShadow>
        <boxGeometry args={[W + 0.6, H + 0.46, 0.1]} />
        <meshStandardMaterial color={BACK} roughness={0.95} />
      </mesh>
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.4, H + 0.9, DEPTH]} radius={0.12} smoothness={3} position={[s * (W / 2 + 0.3), H / 2 - 0.23, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={WOOD} roughness={0.92} />
        </RoundedBox>
      ))}
      <RoundedBox args={[W + 1, 0.4, DEPTH]} radius={0.12} smoothness={3} position={[0, H + 0.2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD} roughness={0.92} />
      </RoundedBox>
      {rows.map((r, i) => {
        const y = i * GAP;
        const lit = !!active && r.members.some((m) => m.id === active.id);
        return (
          <group key={r.label}>
            <Plank y={y} lit={lit} />
            <PlankLabel text={r.label} y={y} />
            {r.members.map((m, j) => (
              <Figure key={m.id} m={m} x={(j - (r.members.length - 1) / 2) * SPACING} y={y} phase={i * 1.3 + j * 0.7}
                hot={active?.id === m.id} reduce={reduce} onHover={onHover} onPick={onPick} />
            ))}
          </group>
        );
      })}
    </Canvas>
  );
}
