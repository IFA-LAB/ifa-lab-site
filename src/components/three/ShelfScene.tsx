import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, Color, SRGBColorSpace, type Group, type MeshStandardMaterial } from 'three';
import { CLAY, RoundedBox } from './util';
import { Accessory, BODY_Y, Face, MatchaLatte, R, type Accessory as AccessoryKind, type Model } from './figure';

export type ShelfMember = { id: string; name: string; sub: string; clay: string; accessory: AccessoryKind; model?: Model; href: string };
export type ShelfRow = { label: string; members: ShelfMember[] };

const GAP = 2.5; // shelf height
const W = 7.6; // inner width
const DEPTH = 1.9;
const SPACING = 2.2;
const SCALE = 0.62;
// warm clay wood, so the cabinet reads as a toy object rather than a grey box
const WOOD = '#ecdcc2';
const BACK = '#f7efe1';
const INK = '#1d2633';
const GLOW = new Color('#4f7fc4');

const FONT = 'Huninn, Fredoka, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif';
/** Text on a transparent canvas, sized to the text; returns the texture and its aspect ratio. */
function useTextTexture(text: string, px: number, pill: boolean) {
  const out = useMemo(() => {
    const c = document.createElement('canvas');
    const g = c.getContext('2d')!;
    g.font = `600 ${px}px ${FONT}`;
    const w = Math.ceil(g.measureText(text).width) + px * (pill ? 1.4 : 0.6);
    const h = Math.ceil(px * 1.7);
    c.width = w; c.height = h;
    if (pill) {
      g.fillStyle = '#ffffff';
      g.beginPath(); g.roundRect(3, 3, w - 6, h - 6, (h - 6) / 2); g.fill();
      g.lineWidth = 6; g.strokeStyle = '#4f7fc4'; g.stroke();
    }
    g.font = `600 ${px}px ${FONT}`;
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + px * 0.06);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace; t.anisotropy = 8;
    return { t, aspect: w / h };
  }, [text, px, pill]);
  useEffect(() => () => out.t.dispose(), [out]);
  return out;
}

/** The cohort's name plate, fixed to the plank's front edge on the left. */
function PlankLabel({ text, y }: { text: string; y: number }) {
  const { t, aspect } = useTextTexture(text, 88, false);
  const h = 0.54, w = h * aspect;
  return (
    <group position={[-W / 2 + 0.3 + (w + 0.34) / 2, y - 0.23, DEPTH / 2 + 0.03]}>
      <RoundedBox args={[w + 0.34, 0.72, 0.1]} radius={0.07} smoothness={3}>
        <meshStandardMaterial color="#fffaf1" roughness={0.9} />
      </RoundedBox>
      <mesh position={[0, 0, 0.052]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={t} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Name tag floating over the picked figure's head. */
function NameTag({ name, x, y }: { name: string; x: number; y: number }) {
  const { t, aspect } = useTextTexture(name, 72, true);
  const h = 0.62;
  return (
    <sprite position={[x, y, 0.9]} scale={[h * aspect, h, 1]} renderOrder={10}>
      <spriteMaterial map={t} transparent depthTest={false} toneMapped={false} />
    </sprite>
  );
}

/** One plank; it glows faintly in the accent colour while one of its figures is picked. */
function Plank({ y, lit }: { y: number; lit: boolean }) {
  const mat = useRef<MeshStandardMaterial>(null);
  useFrame(() => {
    if (!mat.current) return;
    const k = mat.current.emissiveIntensity;
    mat.current.emissiveIntensity = k + ((lit ? 0.22 : 0) - k) * 0.12;
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
    if (reduce) { o.position.y = y; o.scale.setScalar(SCALE * (hot ? 1.14 : 1)); return; }
    const t = clock.getElapsedTime() + phase;
    // picked: hops in place; otherwise breathes and turns a little toward the pointer
    const lift = hot ? Math.abs(Math.sin(t * 6)) * 0.32 : 0;
    o.position.y += (y + lift - o.position.y) * (hot ? 0.5 : 0.15);
    const sy = 1 + Math.sin(t * 2) * 0.015;
    const k = (o.userData.k ?? 1) + ((hot ? 1.14 : 1) - (o.userData.k ?? 1)) * 0.2; o.userData.k = k;
    o.scale.set((SCALE * k) / Math.sqrt(sy), SCALE * k * sy, (SCALE * k) / Math.sqrt(sy));
    const ty = hot ? Math.sin(t * 3) * 0.25 : pointer.x * 0.5 - x * 0.06;
    o.rotation.y += (ty - o.rotation.y) * 0.08;
  });
  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(m); };
  return (
    <group ref={g} position={[x, y, 0.15]} scale={SCALE}>
      {m.model ? <MatchaLatte reduce={reduce} phones={m.accessory === 'phones'} /> : <>
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
      </>}
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
      camera={{ position: [0, H * 0.64, 21.5], fov: 32 }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0, H * 0.47, 0);
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
      <mesh position={[0, H / 2, -DEPTH / 2 + 0.05]}>
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
            {r.members.map((m, j) => {
              const x = (j - (r.members.length - 1) / 2) * SPACING, hot = active?.id === m.id;
              return (
                <group key={m.id}>
                  <Figure m={m} x={x} y={y} phase={i * 1.3 + j * 0.7} hot={hot} reduce={reduce} onHover={onHover} onPick={onPick} />
                  {/* picked: a soft pool of accent light on the plank, and the name over the head */}
                  {hot && <mesh position={[x, y + 0.012, 0.15]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.95, 40]} /><meshBasicMaterial color={GLOW} transparent opacity={0.28} depthWrite={false} /></mesh>}
                  {hot && <NameTag name={m.name} x={x} y={y + 1.95} />}
                </group>
              );
            })}
          </group>
        );
      })}
    </Canvas>
  );
}
