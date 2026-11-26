import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { BoxGeometry, EdgesGeometry, Vector3, type DirectionalLight, type Group, type LineSegments, type Mesh, type PerspectiveCamera } from 'three';
import { CLAY, TagSprite } from './util';
import { Accessory, BODY_Y, Face, MatchaLatte, R, type Accessory as AccessoryKind, type Model } from './figure';

export type WalkBrick = { title: string; clay: string; kind: string; href: string };
export type WalkStep = { label: string; caption: string; sub: string; soon: boolean; bricks: WalkBrick[]; joins: string[] };
export type WalkMember = { id: string; name: string; clay: string; accessory: AccessoryKind; model?: Model; href: string };
export type Pick = { text: string; href: string; at: [number, number, number] } | null;

// The chart: one candle a year. Open = works so far, close = works after the year; the body is that year's bricks.
const GX = 2.1; // candle spacing
const BW = 1.35, BH = 0.5, BD = 1.0, GAPY = 0.04;
const FUR = '#3a4252';
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x: number) => x * x * (3 - 2 * x);

type Layout = { x: number; open: number; close: number }[];
export function layoutOf(steps: WalkStep[]): Layout {
  let cum = 0;
  return steps.map((s, i) => { const open = cum * (BH + GAPY); cum += s.bricks.length; return { x: i * GX, open, close: cum * (BH + GAPY) }; });
}

/** Where a climber stands at time T: walks across a candle's top, then hops to the next one. */
function pathAt(L: Layout, T: number, out: Vector3) {
  const last = L.length - 1;
  const t = clamp(T, 0, last);
  const i = Math.min(last, Math.floor(t)), f = t - i;
  const a = L[i];
  if (i === last || f < 0.6) {
    const w = i === last ? 0.6 : f;
    return out.set(a.x - 0.4 + (w / 0.6) * 0.8, a.close, 0);
  }
  const b = L[i + 1], u = (f - 0.6) / 0.4;
  return out.set(a.x + 0.4 + (b.x - a.x - 0.8) * u, a.close + (b.close - a.close) * u + Math.sin(u * Math.PI) * (0.8 + Math.max(0, b.close - a.close) * 0.4), 0);
}

type Ctx = { T: RefObject<number>; reduce: boolean; pick: (x: Pick) => void; open: (href: string) => void };
const now = (c: Ctx, L: Layout) => (c.reduce ? L.length - 1 : c.T.current ?? 0);

function Candle({ i, s, L, c }: { i: number; s: WalkStep; L: Layout; c: Ctx }) {
  const { x, open, close } = L[i];
  const refs = useRef<(Group | null)[]>([]);
  const wick = useRef<Group>(null);
  useFrame(() => {
    // candle i is built while the climber stands on candle i-1, so it is finished before the hop
    const b = i === 0 ? 1 : clamp((now(c, L) - (i - 1) - 0.02) / 0.5);
    const n = Math.max(1, s.bricks.length);
    refs.current.forEach((g, j) => {
      if (!g) return;
      const k = ease(clamp((b - (j / n) * 0.55) / 0.45));
      g.position.y = open + j * (BH + GAPY) + BH / 2 + (1 - k) * 6;
      g.rotation.z = (1 - k) * (j % 2 ? 0.6 : -0.6);
      g.visible = k > 0.001;
    });
    if (wick.current) { const k = ease(clamp(b * 1.4 - 0.4)); wick.current.scale.set(1, Math.max(0.001, k), 1); wick.current.visible = k > 0.001; }
  });
  const top = close + 0.32, bottom = open - 0.32;
  return (
    <group position={[x, 0, 0]}>
      <group ref={wick} position={[0, bottom, 0]}>
        <mesh position={[0, (top - bottom) / 2, 0]}>
          <cylinderGeometry args={[0.05, 0.05, top - bottom, 10]} />
          <meshStandardMaterial color="#4a5566" roughness={0.6} />
        </mesh>
        {/* a year without new work is a doji: a flat line where open meets close */}
        {s.bricks.length === 0 && (
          <mesh position={[0, open - bottom, 0]} castShadow>
            <boxGeometry args={[BW, 0.08, BD * 0.6]} />
            <meshStandardMaterial color="#8a95a6" roughness={0.8} />
          </mesh>
        )}
      </group>
      {s.bricks.map((b, j) => {
        const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); c.pick({ text: b.title.length > 48 ? b.title.slice(0, 46) + '…' : b.title, href: b.href, at: [x, open + j * (BH + GAPY) + 1.2, 0.9] }); };
        return (
          <group key={j} ref={(g) => { refs.current[j] = g; }} position={[0, open + j * (BH + GAPY) + BH / 2 + 6, 0]} visible={false}>
            <mesh castShadow receiveShadow onPointerOver={over} onPointerMove={over} onPointerOut={() => c.pick(null)} onClick={(e) => { e.stopPropagation(); c.open(b.href); }}>
              <boxGeometry args={[BW, BH, BD]} />
              <meshStandardMaterial color={CLAY[b.clay] ?? CLAY.grey} roughness={0.82} transparent={s.soon || b.kind === 'working'} opacity={s.soon ? 0.6 : b.kind === 'working' ? 0.72 : 1} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** The next candle, drawn in dashes: where the visitor's work would go. */
function Ghost({ x, y, c, L }: { x: number; y: number; c: Ctx; L: Layout }) {
  const g = useRef<Group>(null);
  const line = useRef<LineSegments>(null);
  const h = BH * 3 + GAPY * 2;
  const edges = useMemo(() => new EdgesGeometry(new BoxGeometry(BW, h, BD)), [h]);
  useEffect(() => { line.current?.computeLineDistances(); }, []);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const a = clamp((now(c, L) - (L.length - 1.7)) / 0.6);
    g.current.scale.setScalar(Math.max(0.001, ease(a)));
    g.current.position.y = y + h / 2 + (c.reduce ? 0 : Math.sin(clock.getElapsedTime() * 1.6) * 0.08);
  });
  return (
    <group ref={g} position={[x, y, 0]}>
      <lineSegments ref={line} geometry={edges}>
        <lineDashedMaterial color="#4f7fc4" dashSize={0.12} gapSize={0.08} />
      </lineSegments>
      <mesh><boxGeometry args={[BW, h, BD]} /><meshBasicMaterial color="#4f7fc4" transparent opacity={0.12} depthWrite={false} /></mesh>
    </group>
  );
}

/** A three-year moving average of the closes, as clay beads, drawn up to where the climber is. */
function Beads({ L, c }: { L: Layout; c: Ctx }) {
  const pts = useMemo(() => {
    const ma = L.map((_, i) => { const w = L.slice(Math.max(0, i - 2), i + 1); return w.reduce((s, p) => s + p.close, 0) / w.length; });
    const out: { p: [number, number, number]; at: number; col: string }[] = [];
    for (let i = 0; i < L.length - 1; i++) for (let k = 0; k < 6; k++) {
      const u = k / 6;
      out.push({ p: [L[i].x + (L[i + 1].x - L[i].x) * u, ma[i] + (ma[i + 1] - ma[i]) * u - 0.15, -1.1], at: i + u, col: (i * 6 + k) % 2 ? CLAY.violet : CLAY.blue });
    }
    return out;
  }, [L]);
  const refs = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    const T = now(c, L);
    pts.forEach((b, i) => { const m = refs.current[i]; if (m) m.scale.setScalar(Math.max(0.001, ease(clamp((T - b.at) * 3)))); });
  });
  return <>{pts.map((b, i) => (
    <mesh key={i} ref={(m) => { refs.current[i] = m; }} position={b.p} scale={0.001}><sphereGeometry args={[0.09, 12, 8]} /><meshStandardMaterial color={b.col} roughness={0.7} /></mesh>
  ))}</>;
}

function CatBody({ reduce }: { reduce: boolean }) {
  const tail = useRef<Mesh>(null);
  useFrame(({ clock }) => { if (tail.current && !reduce) tail.current.rotation.z = 0.6 + Math.sin(clock.getElapsedTime() * 2.2) * 0.25; });
  const fur = <meshStandardMaterial color={FUR} roughness={0.9} />;
  return (
    <group scale={0.55}>
      <mesh position={[0, 0.5, 0]} scale={[1.15, 0.85, 0.9]} castShadow><sphereGeometry args={[0.62, 32, 24]} />{fur}</mesh>
      <mesh position={[0.55, 1.15, 0]} castShadow><sphereGeometry args={[0.46, 32, 24]} />{fur}</mesh>
      <mesh position={[0.48, 1.6, 0.22]} rotation={[0, 0, 0.15]} castShadow><coneGeometry args={[0.16, 0.32, 16]} />{fur}</mesh>
      <mesh position={[0.48, 1.6, -0.22]} rotation={[0, 0, 0.15]} castShadow><coneGeometry args={[0.16, 0.32, 16]} />{fur}</mesh>
      <mesh position={[0.98, 1.1, 0]}><sphereGeometry args={[0.06, 12, 8]} /><meshStandardMaterial color="#f2a3b3" roughness={0.8} /></mesh>
      <mesh position={[0.9, 1.25, 0.17]}><sphereGeometry args={[0.07, 12, 8]} /><meshStandardMaterial color="#ffffff" roughness={0.6} /></mesh>
      <mesh position={[0.9, 1.25, -0.17]}><sphereGeometry args={[0.07, 12, 8]} /><meshStandardMaterial color="#ffffff" roughness={0.6} /></mesh>
      <mesh ref={tail} position={[-0.75, 0.85, 0]} rotation={[0, 0, 0.6]} castShadow><capsuleGeometry args={[0.1, 0.8, 4, 12]} />{fur}</mesh>
    </group>
  );
}

/** K 喵 leads the climb, turned a little toward the camera so its face reads. */
function Climber({ L, c, at }: { L: Layout; c: Ctx; at: RefObject<Vector3> }) {
  const g = useRef<Group>(null);
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const T = now(c, L);
    pathAt(L, T, v);
    const walking = !c.reduce && T % 1 < 0.6 && T < L.length - 1;
    g.current.position.set(v.x, v.y + (walking ? Math.abs(Math.sin(clock.getElapsedTime() * 12)) * 0.05 : 0), 0.1);
    at.current!.copy(v);
  });
  return <group ref={g} rotation={[0, -0.45, 0]}><CatBody reduce={c.reduce} /></group>;
}

/** A member joins in the year their cohort arrived and stands on a candle top behind the cat, three to a candle;
    when the cat moves on, everyone hops forward to their new spot. */
function Follower({ m, join, rank, L, c, crewJoin }: { m: WalkMember; join: number; rank: number; L: Layout; c: Ctx; crewJoin: number[] }) {
  const g = useRef<Group>(null), inner = useRef<Group>(null);
  const cur = useRef<Vector3 | null>(null);
  const tgt = useMemo(() => new Vector3(), []);
  const body = CLAY[m.clay] ?? CLAY.grey;
  useFrame(({ clock }, dt) => {
    const o = g.current; if (!o) return;
    const T = now(c, L);
    const shown = clamp((T - join + 0.2) / 0.3);
    o.visible = shown > 0.001;
    if (!o.visible) { cur.current = null; return; }
    // place in line: the newest members stand nearest the cat
    let place = 0;
    crewJoin.forEach((j, k) => { if (k !== rank && T >= j - 0.2 && (j > join || (j === join && k > rank))) place++; });
    const cat = Math.min(L.length - 1, Math.floor(Math.max(0, T) + 0.4));
    // the first three share the cat's own candle, in the back row; the rest fill the candles behind it
    const ci = Math.max(0, cat - Math.floor(place / 3)), slot = place % 3;
    const top = L[ci];
    tgt.set(top.x + (slot - 1) * 0.4, top.close, -0.38);
    if (!cur.current) cur.current = tgt.clone();
    const before = cur.current.distanceTo(tgt);
    cur.current.lerp(tgt, 1 - Math.exp(-Math.min(dt, 0.1) * (c.reduce ? 60 : 7)));
    const hop = c.reduce ? 0 : Math.min(1, before) * 0.5;
    o.position.set(cur.current.x, cur.current.y + hop, cur.current.z);
    if (inner.current) {
      inner.current.scale.setScalar(Math.max(0.001, 0.3 * ease(shown)));
      inner.current.position.y = c.reduce ? 0 : Math.abs(Math.sin(clock.getElapsedTime() * 3 + rank)) * 0.04;
    }
  });
  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); const p = g.current!.position; c.pick({ text: m.name, href: m.href, at: [p.x, p.y + 1.1, 0.8] }); };
  return (
    <group ref={g} visible={false} rotation={[0, -0.3, 0]}>
      <group ref={inner} scale={0.001}>
        {m.model ? <MatchaLatte reduce={c.reduce} phones={m.accessory === 'phones'} /> : <>
          <mesh position={[0, BODY_Y, 0]} scale={R} castShadow><sphereGeometry args={[1, 32, 24]} /><meshStandardMaterial color={body} roughness={0.88} /></mesh>
          <Face placeholder={false} reduce={c.reduce} />
          <Accessory kind={m.accessory} body={body} />
        </>}
      </group>
      <mesh position={[0, 0.4, 0]} onPointerOver={over} onPointerMove={over} onPointerOut={() => c.pick(null)} onClick={(e) => { e.stopPropagation(); c.open(m.href); }}>
        <boxGeometry args={[0.5, 0.8, 0.5]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Camera: follows the cat up the chart. Wide screens keep it right of the text; tall screens keep it in the upper half. */
function Rig({ at }: { at: RefObject<Vector3> }) {
  const { camera, size } = useThree();
  const cur = useRef<Vector3 | null>(null);
  const look = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    const a = at.current!;
    if (!cur.current) cur.current = a.clone();
    cur.current.lerp(a, 1 - Math.exp(-Math.min(dt, 0.1) * 4));
    const c = camera as PerspectiveCamera;
    const aspect = size.width / size.height, wide = aspect > 1.15;
    const tan = Math.tan((c.fov * Math.PI) / 360);
    // enough of the chart to read the climb: about 5 candles across on desktop, 3 on phones
    const d = wide ? (GX * 5.2) / (2 * tan * aspect) : (GX * 3) / (2 * tan * aspect);
    const visW = 2 * d * tan * aspect, visH = 2 * d * tan;
    const x = cur.current.x - (wide ? visW * 0.1 : GX * 0.35);
    const y = cur.current.y + 0.4 - (wide ? 0 : visH * 0.1);
    c.position.set(x - 1.4, y + d * 0.18, d);
    look.set(x, y, 0);
    c.lookAt(look);
  });
  return null;
}

/** The key light follows the camera, so its shadow box only covers what is in view. */
function Sun({ small }: { small: boolean }) {
  const l = useRef<DirectionalLight>(null);
  const { camera, scene } = useThree();
  useEffect(() => { const o = l.current; if (o) { scene.add(o.target); return () => { scene.remove(o.target); }; } }, [scene]);
  useFrame(() => {
    const o = l.current; if (!o) return;
    o.position.set(camera.position.x + 5, camera.position.y + 10, 8);
    o.target.position.set(camera.position.x + 1, camera.position.y - 3, 0);
  });
  return <directionalLight ref={l} intensity={2.2} castShadow={!small} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005}
    shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-camera-far={50} />;
}

export default function WalkScene({ T, steps, crew, joinOf, reduce, visible, small, onPick }: {
  T: RefObject<number>; steps: WalkStep[]; crew: WalkMember[]; joinOf: Record<string, number>;
  reduce: boolean; visible: boolean; small: boolean; onPick: (x: Pick) => void;
}) {
  const [picked, setPicked] = useState<Pick>(null);
  const pick = (x: Pick) => { setPicked(x); onPick(x); };
  const c: Ctx = { T, reduce, pick, open: (href) => window.location.assign(href) };
  const L = useMemo(() => layoutOf(steps), [steps]);
  const at = useRef(new Vector3());
  const crewJoin = crew.map((m) => joinOf[m.id] ?? 0);
  const end = L[L.length - 1];
  return (
    <Canvas
      shadows={small ? false : 'percentage'}
      dpr={small ? [1, 1.5] : [1, 2]}
      frameloop={visible ? 'always' : 'never'}
      camera={{ position: [0, 3, 14], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => gl.domElement.closest('[data-walk]')?.setAttribute('data-live', '')}
      onPointerMissed={() => pick(null)}
      style={{ cursor: picked ? 'pointer' : 'auto' }}
    >
      <Rig at={at} />
      <hemisphereLight args={['#ffffff', '#c9d4e3', 2]} />
      <Sun small={small} />
      <mesh position={[end.x / 2, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[end.x + 60, 30]} />
        <shadowMaterial opacity={0.1} />
      </mesh>
      {steps.map((s, i) => <Candle key={i} i={i} s={s} L={L} c={c} />)}
      <Beads L={L} c={c} />
      <Ghost x={end.x + GX} y={end.close + 0.15} c={c} L={L} />
      <Climber L={L} c={c} at={at} />
      {crew.map((m, k) => <Follower key={m.id} m={m} rank={k} join={joinOf[m.id] ?? 0} L={L} c={c} crewJoin={crewJoin} />)}
      {picked && <TagSprite text={picked.text} position={picked.at} height={0.45} />}
    </Canvas>
  );
}
