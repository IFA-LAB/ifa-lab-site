import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { BoxGeometry, EdgesGeometry, Vector3, type DirectionalLight, type Group, type LineSegments, type Mesh, type PerspectiveCamera } from 'three';
import { CLAY, FUR_DARK, TagSprite, useDark } from './util';
import { Accessory, BODY_Y, Face, MatchaLatte, Professor, R, type Accessory as AccessoryKind, type Model } from './figure';

export type WalkBrick = { title: string; clay: string; kind: string; href: string };
export type WalkStep = { label: string; caption: string; sub: string; soon: boolean; bricks: WalkBrick[]; joins: string[]; anchor: string };
export type WalkMember = { id: string; name: string; clay: string; accessory: AccessoryKind; model?: Model; href: string };
/** What the pointer is over, with the pointer's position in the viewport (the page draws the label). */
export type Pick = { text: string; href: string; x: number; y: number } | null;

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
  const top = close + (s.joins.length ? 0 : 0.32), bottom = open - 0.32;
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
            <boxGeometry args={[BW, 0.08, BD]} />
            <meshStandardMaterial color="#8a95a6" roughness={0.8} />
          </mesh>
        )}
      </group>
      {s.bricks.map((b, j) => {
        const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); c.pick({ text: b.title, href: b.href, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }); };
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

/** The year under each candle, shown once the climb reaches it. */
function YearTag({ i, s, L, c, reveal }: { i: number; s: WalkStep; L: Layout; c: Ctx; reveal: RefObject<number> }) {
  const g = useRef<Group>(null);
  const { size } = useThree();
  // the ending pulls far back and a 0.3-unit tag shrank to about 8 px; it grows as the camera leaves, and drops a little
  // so the bigger tag stays under its candle
  const grow = size.width / size.height > 1.15 ? 1.6 : 2.2;
  // after a flat year two tags sit at the same height and, grown, run into each other: this one steps down a tag's height
  const stagger = i > 0 && L[i].open - L[i - 1].open < 0.5 ? 0.3 * (1 + grow) : 0;
  useFrame(() => {
    const o = g.current; if (!o) return;
    const k = ease(clamp((now(c, L) - (i - 0.35)) / 0.3)), r = ease(clamp(reveal.current ?? 0));
    o.visible = k > 0.001 || i === 0;
    o.scale.setScalar((i === 0 ? 1 : Math.max(0.001, k)) * (1 + grow * r));
    o.position.y = L[i].open - 0.55 - r * (grow * 0.18 + stagger);
  });
  return <group ref={g} position={[L[i].x, L[i].open - 0.55, 0.55]}><TagSprite text={s.label} position={[0, 0, 0]} height={0.3} /></group>;
}

/** The next candle, drawn in dashes: where the visitor's work would go. */
function Ghost({ x, y, c, L }: { x: number; y: number; c: Ctx; L: Layout }) {
  const g = useRef<Group>(null);
  const line = useRef<LineSegments>(null);
  const h = BH * 4 + GAPY * 3;
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
  const dark = useDark();
  const fur = <meshStandardMaterial color={dark ? FUR_DARK : FUR} roughness={0.9} />;
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
    // right of centre and toward the back: the members stand in front, so the cat (taller) never hides them
    g.current.position.set(v.x + 0.36, v.y + (walking ? Math.abs(Math.sin(clock.getElapsedTime() * 12)) * 0.05 : 0), -0.3);
    at.current!.copy(v);
  });
  return <group ref={g} rotation={[0, -0.45, 0]}><CatBody reduce={c.reduce} /></group>;
}

/** A member drops onto the candle of the year they joined and stays there, so the finished chart shows who arrived when.
    Up to five stand in a front row; more fill a second row behind it. The cat walks along the back. */
function Follower({ m, join, slot, L, c }: { m: WalkMember; join: number; slot: number; L: Layout; c: Ctx }) {
  const g = useRef<Group>(null), inner = useRef<Group>(null);
  const body = CLAY[m.clay] ?? CLAY.grey;
  const top = L[Math.min(L.length - 1, join)];
  // five to a row, huddled: 2023's five founders all stand in front of the cat instead of one hiding behind
  const row = Math.floor(slot / 5), col = slot % 5;
  // the advisor stands at the front-left corner of the first candle, clear of the cat
  const lead = m.id === 'advisor';
  const x = lead ? top.x - 0.5 : top.x + (col - 2) * 0.29 + row * 0.145, z = lead ? 0.12 : 0.24 - row * 0.3;
  useFrame(({ clock }) => {
    const o = g.current; if (!o) return;
    const T = now(c, L);
    // they land just after the year's bricks, one after another
    const shown = clamp((T - (join - 1) - 0.5 - slot * 0.04) / 0.25);
    o.visible = shown > 0.001;
    if (!o.visible) return;
    const k = ease(shown);
    o.position.set(x, top.close + (1 - k) * 2.5, z);
    if (inner.current) {
      inner.current.scale.setScalar(Math.max(0.001, 0.28 * (0.6 + 0.4 * k)));
      inner.current.position.y = c.reduce ? 0 : Math.abs(Math.sin(clock.getElapsedTime() * 3 + slot)) * 0.03;
    }
  });
  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); c.pick({ text: m.name, href: m.href, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }); };
  return (
    <group ref={g} visible={false} rotation={[0, -0.25, 0]}>
      <group ref={inner} scale={0.001}>
        {m.model === 'prof' ? <Professor reduce={c.reduce} /> : m.model ? <MatchaLatte reduce={c.reduce} phones={m.accessory === 'phones'} /> : <>
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

// A different camera angle for every year, blended as the page scrolls: yaw around the cat, height, distance.
const YAW = [-0.55, 0.45, -0.2, 0.6, -0.4, 0.25];
const LIFT = [0.16, 0.36, 0.1, 0.26, 0.3, 0.18];
const ZOOM = [1.05, 0.85, 1.1, 0.9, 0.95, 1];
const keyAt = (k: number[], T: number) => { const i = Math.floor(Math.max(0, T)), f = ease(clamp(T - i)); const a = k[i % k.length], b = k[(i + 1) % k.length]; return a + (b - a) * f; };

/** Camera: orbits K 喵 as it climbs, a new angle each year; at the end it pulls back to show the whole chart.
    The projection is shifted so the subject sits right of the text card on wide screens and above it on tall ones. */
function Rig({ at, L, c, reveal, focus }: { at: RefObject<Vector3>; L: Layout; c: Ctx; reveal: RefObject<number>; focus: RefObject<Vector3> }) {
  const { camera, size } = useThree();
  const pos = useRef<Vector3 | null>(null), look = useRef<Vector3 | null>(null);
  const want = useMemo(() => new Vector3(), []), wantLook = useMemo(() => new Vector3(), []), tmp = useMemo(() => new Vector3(), []);
  const wide = size.width / size.height > 1.15;
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    cam.setViewOffset(size.width, size.height, wide ? -size.width * 0.15 : 0, wide ? 0 : size.height * 0.24, size.width, size.height);
    cam.updateProjectionMatrix();
    return () => { cam.clearViewOffset(); cam.updateProjectionMatrix(); };
  }, [camera, size.width, size.height, wide]);
  useFrame((_, dt) => {
    const cam = camera as PerspectiveCamera;
    const T = now(c, L), a = at.current!;
    const aspect = size.width / size.height, tan = Math.tan((cam.fov * Math.PI) / 360);
    // about 5 candles across on desktop, 2.6 on phones; on wide screens also far enough back that this year's whole candle
    // fits in height (a tall year was cut off at the top, leaving most of the frame empty), then each year's own zoom
    const yr = L[clamp(Math.round(T), 0, L.length - 1)], h = yr.close - yr.open;
    const dH = (wide ? GX * 5 : GX * 2.6) / (2 * tan * aspect), dV = wide ? (h + 3.2) / (2 * tan) : 0;
    const d = Math.max(dH, dV) * keyAt(ZOOM, T);
    const yaw = keyAt(YAW, T), lift = keyAt(LIFT, T);
    // wide screens aim between the cat and the candle's foot, so the year's bricks and the cat share the frame
    const lookY = a.y + 0.6 - (wide ? h * 0.42 : 0);
    want.set(a.x + Math.sin(yaw) * d, lookY + lift * d, Math.cos(yaw) * d);
    wantLook.set(a.x + 0.2, lookY, 0);
    // the ending: the whole chart from a high three-quarter view, the dashed next candle included
    const r = ease(clamp(reveal.current ?? 0));
    if (r > 0) {
      const last = L[L.length - 1], cx = (last.x + GX) / 2, cy = (last.close + BH * 3) / 2 + (wide ? 0.5 : aspect < 0.6 ? 2.6 : 1.8); // a little high, so the dashed next candle clears the header
      const D = 1.1 * Math.max((last.x + GX * (wide ? 3 : 2.2)) / (2 * tan * aspect * (wide ? 0.7 : 1)), (last.close + 3) / (2 * tan * (wide ? 0.85 : 0.74)));
      want.lerp(tmp.set(cx + Math.sin(-0.5) * D, cy + D * 0.16, Math.cos(-0.5) * D), r);
      wantLook.lerp(tmp.set(cx, cy, 0), r);
    }
    if (!pos.current || !look.current) { pos.current = want.clone(); look.current = wantLook.clone(); }
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 4.5);
    pos.current.lerp(want, k); look.current.lerp(wantLook, k);
    cam.position.copy(pos.current); cam.lookAt(look.current);
    focus.current!.copy(look.current);
  });
  return null;
}

/** The key light follows what the camera looks at, so its shadow box only covers what is in view. */
function Sun({ small, focus }: { small: boolean; focus: RefObject<Vector3> }) {
  const l = useRef<DirectionalLight>(null);
  const { scene } = useThree();
  useEffect(() => { const o = l.current; if (o) { scene.add(o.target); return () => { scene.remove(o.target); }; } }, [scene]);
  useFrame(() => {
    const o = l.current, f = focus.current; if (!o || !f) return;
    o.position.set(f.x + 5, f.y + 10, 8);
    o.target.position.set(f.x + 1, f.y - 2, 0);
  });
  return <directionalLight ref={l} intensity={2.2} castShadow={!small} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005}
    shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-camera-far={60} />;
}

export default function WalkScene({ T, reveal, steps, crew, joinOf, reduce, visible, small, onPick }: {
  T: RefObject<number>; reveal: RefObject<number>; steps: WalkStep[]; crew: WalkMember[]; joinOf: Record<string, number>;
  reduce: boolean; visible: boolean; small: boolean; onPick: (x: Pick) => void;
}) {
  const [picked, setPicked] = useState<Pick>(null);
  const pick = (x: Pick) => { setPicked(x); onPick(x); };
  const c: Ctx = { T, reduce, pick, open: (href) => window.location.assign(href) };
  const L = useMemo(() => layoutOf(steps), [steps]);
  const at = useRef(new Vector3());
  const focus = useRef(new Vector3());
  const crewJoin = useMemo(() => crew.map((m) => joinOf[m.id] ?? 0), [crew, joinOf]);
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
      <Rig at={at} L={L} c={c} reveal={reveal} focus={focus} />
      <hemisphereLight args={['#ffffff', '#c9d4e3', 2]} />
      <Sun small={small} focus={focus} />
      <mesh position={[end.x / 2, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[end.x + 60, 30]} />
        <shadowMaterial opacity={0.1} />
      </mesh>
      {steps.map((s, i) => <Candle key={i} i={i} s={s} L={L} c={c} />)}
      {steps.map((s, i) => <YearTag key={'y' + i} i={i} s={s} L={L} c={c} reveal={reveal} />)}
      <Beads L={L} c={c} />
      <Ghost x={end.x + GX} y={end.close + 0.15} c={c} L={L} />
      <Climber L={L} c={c} at={at} />
      {crew.map((m, k) => <Follower key={m.id} m={m} join={joinOf[m.id] ?? 0} slot={crewJoin.slice(0, k).filter((j) => j === crewJoin[k]).length} L={L} c={c} />)}
    </Canvas>
  );
}
