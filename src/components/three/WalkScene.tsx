import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Vector3, type DirectionalLight, type Group, type Mesh, type PerspectiveCamera } from 'three';
import { CLAY, RoundedBox, TagSprite, useTextTexture } from './util';
import { Accessory, BODY_Y, Face, MatchaLatte, R, type Accessory as AccessoryKind, type Model } from './figure';

export type WalkBar = { key: string; label: string; count: number; clay: string; href: string };
export type WalkBrick = { title: string; clay: string; kind: string; href: string };
export type WalkCol = { label: string; bricks: WalkBrick[] };
export type WalkMember = { id: string; name: string; clay: string; accessory: AccessoryKind; model?: Model; href: string };
export type WalkRow = { label: string; members: WalkMember[] };
export type Pick = { text: string; href: string; at: [number, number, number] } | null;

/** Stations sit along x; the camera flies from one to the next as the page scrolls. */
export const STATIONS = 4;
const SX = 18;
const WOOD = '#ecdcc2';
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x: number) => x * x * (3 - 2 * x);
/** How far the walk has reached station i: 0 before, 1 once the camera has settled there. */
const arrive = (p: number, i: number) => clamp((p * (STATIONS - 1) - (i - 1)) / 0.8);

type Ctx = { p: MutableRefObject<number>; reduce: boolean; pick: (x: Pick) => void; open: (href: string) => void };

function Label({ text, position, h = 0.42 }: { text: string; position: [number, number, number]; h?: number }) {
  const { t, aspect } = useTextTexture(text, 72, false);
  return (
    <mesh position={position}>
      <planeGeometry args={[h * aspect, h]} />
      <meshBasicMaterial map={t} transparent toneMapped={false} />
    </mesh>
  );
}

/** Station 1: one clay candle per research area, height by the number of works; they grow on arrival. */
function Board({ bars, c }: { bars: WalkBar[]; c: Ctx }) {
  const max = Math.max(...bars.map((b) => b.count), 1);
  const refs = useRef<(Group | null)[]>([]);
  const t0 = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.getElapsedTime();
    const k = c.reduce ? 1 : clamp((clock.getElapsedTime() - t0.current) / 1.4);
    refs.current.forEach((g, i) => { if (g) g.scale.y = 0.02 + 0.98 * ease(clamp(k * 1.6 - i * 0.1)); });
  });
  const gap = 1.7, x0 = -((bars.length - 1) * gap) / 2;
  return (
    <group>
      <RoundedBox args={[bars.length * gap + 1.4, 0.4, 3]} radius={0.15} position={[0, -0.2, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={WOOD} roughness={0.92} />
      </RoundedBox>
      {bars.map((b, i) => {
        const h = 0.6 + (b.count / max) * 4.2, x = x0 + i * gap;
        const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); c.pick({ text: `${b.label} · ${b.count}`, href: b.href, at: [x, h + 1.1, 0.6] }); };
        return (
          <group key={b.key} position={[x, 0, 0]}>
            <group ref={(g) => { refs.current[i] = g; }}>
              <mesh position={[0, h / 2, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.05, h + 0.9, 10]} />
                <meshStandardMaterial color="#4a5566" roughness={0.6} />
              </mesh>
              <RoundedBox args={[0.9, h, 0.9]} radius={0.2} position={[0, h / 2, 0]} castShadow>
                <meshStandardMaterial color={CLAY[b.clay] ?? CLAY.grey} roughness={0.85} />
              </RoundedBox>
            </group>
            <Label text={b.label} position={[0, -0.05, 1.52]} h={0.34} />
            <mesh position={[0, h / 2, 0]} onPointerOver={over} onPointerMove={over} onPointerOut={() => c.pick(null)} onClick={(e) => { e.stopPropagation(); c.open(b.href); }}>
              <boxGeometry args={[1.4, h + 1.2, 1.4]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Station 2: every work is a brick, piled by year; they drop into place as the camera arrives. */
function Wall({ cols, c, x }: { cols: WalkCol[]; c: Ctx; x: number }) {
  const bw = 0.95, bh = 0.34, gap = 1.12, x0 = -((cols.length - 1) * gap) / 2;
  const flat = useMemo(() => cols.flatMap((col, i) => col.bricks.map((b, j) => ({ b, i, j, n: 0 }))).map((o, n) => ({ ...o, n })), [cols]);
  const refs = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    const a = c.reduce ? 1 : arrive(c.p.current, 1);
    flat.forEach((o) => {
      const m = refs.current[o.n]; if (!m) return;
      const k = ease(clamp(a * 1.8 - o.n / flat.length));
      const y = 0.2 + bh / 2 + o.j * (bh + 0.05);
      m.position.y = y + (1 - k) * 7;
      m.rotation.z = (1 - k) * (o.n % 2 ? 0.5 : -0.5);
    });
  });
  return (
    <group position={[x, 0, 0]}>
      <RoundedBox args={[cols.length * gap + 1, 0.4, 2]} radius={0.15} position={[0, 0, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={WOOD} roughness={0.92} />
      </RoundedBox>
      {cols.map((col, i) => <Label key={i} text={col.label} position={[x0 + i * gap, -0.05, 1.04]} h={0.3} />)}
      {flat.map((o) => {
        const bx = x0 + o.i * gap, by = 0.2 + bh / 2 + o.j * (bh + 0.05);
        const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); c.pick({ text: o.b.title.length > 46 ? o.b.title.slice(0, 44) + '…' : o.b.title, href: o.b.href, at: [x + bx, by + 0.9, 0.8] }); };
        return (
          <mesh key={o.n} ref={(m) => { refs.current[o.n] = m; }} position={[bx, by + 7, 0]} castShadow
            onPointerOver={over} onPointerMove={over} onPointerOut={() => c.pick(null)} onClick={(e) => { e.stopPropagation(); c.open(o.b.href); }}>
            <boxGeometry args={[bw, bh, 0.62]} />
            <meshStandardMaterial color={CLAY[o.b.clay] ?? CLAY.grey} roughness={0.8} transparent={o.b.kind === 'working'} opacity={o.b.kind === 'working' ? 0.55 : 1} />
          </mesh>
        );
      })}
    </group>
  );
}

function Figure({ m, c, at }: { m: WalkMember; c: Ctx; at: [number, number, number] }) {
  const g = useRef<Group>(null);
  const body = CLAY[m.clay] ?? CLAY.grey;
  const phase = useMemo(() => Math.random() * 6, []);
  useFrame(({ clock }) => {
    if (!g.current || c.reduce) return;
    const a = arrive(c.p.current, 2);
    // they hop up once as you arrive, then breathe
    g.current.position.y = Math.abs(Math.sin(clamp(a * 1.4 - phase / 20) * Math.PI)) * 0.5 + Math.sin(clock.getElapsedTime() * 2 + phase) * 0.02;
  });
  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); c.pick({ text: m.name, href: m.href, at: [at[0], at[1] + 1.7, at[2] + 0.6] }); };
  return (
    <group position={at}>
      <group ref={g} scale={0.55}>
        {m.model ? <MatchaLatte reduce={c.reduce} phones={m.accessory === 'phones'} /> : <>
          <mesh position={[0, BODY_Y, 0]} scale={R} castShadow>
            <sphereGeometry args={[1, 32, 24]} />
            <meshStandardMaterial color={body} roughness={0.88} />
          </mesh>
          <Face placeholder={false} reduce={c.reduce} />
          <Accessory kind={m.accessory} body={body} />
        </>}
      </group>
      <mesh position={[0, 0.7, 0]} onPointerOver={over} onPointerMove={over} onPointerOut={() => c.pick(null)} onClick={(e) => { e.stopPropagation(); c.open(m.href); }}>
        <boxGeometry args={[1.3, 1.6, 1.2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Station 3: the members cabinet, one plank per cohort, first cohort at the bottom. */
function Cabinet({ rows, c, x }: { rows: WalkRow[]; c: Ctx; x: number }) {
  const GAP = 1.75, W = 7.2, H = rows.length * GAP;
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, H / 2, -0.75]} receiveShadow>
        <boxGeometry args={[W + 0.5, H + 0.4, 0.1]} />
        <meshStandardMaterial color="#f7efe1" roughness={0.95} />
      </mesh>
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.36, H + 0.7, 1.6]} radius={0.12} position={[s * (W / 2 + 0.25), H / 2 - 0.1, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={WOOD} roughness={0.92} />
        </RoundedBox>
      ))}
      <RoundedBox args={[W + 0.9, 0.36, 1.6]} radius={0.12} position={[0, H + 0.2, 0]} castShadow>
        <meshStandardMaterial color={WOOD} roughness={0.92} />
      </RoundedBox>
      {rows.map((r, i) => {
        const y = i * GAP, sp = Math.min(1.5, (W - 2.2) / Math.max(1, r.members.length - 1));
        return (
          <group key={r.label}>
            <RoundedBox args={[W + 0.5, 0.32, 1.6]} radius={0.1} position={[0, y - 0.16, 0]} castShadow receiveShadow>
              <meshStandardMaterial color={WOOD} roughness={0.92} />
            </RoundedBox>
            <Label text={r.label} position={[-W / 2 + 0.9, y - 0.16, 0.82]} h={0.26} />
            {r.members.map((m, j) => <Figure key={m.id} m={m} c={c} at={[(j - (r.members.length - 1) / 2) * sp + 0.6, y, 0.1]} />)}
          </group>
        );
      })}
    </group>
  );
}

/** Station 4: a clay mailbox; the letter slides in and the flag goes up as you arrive. */
function Mailbox({ c, x, href, label }: { c: Ctx; x: number; href: string; label: string }) {
  const letter = useRef<Group>(null), flag = useRef<Group>(null);
  useFrame(({ clock }) => {
    const a = c.reduce ? 1 : ease(arrive(c.p.current, 3));
    if (letter.current) { letter.current.position.set(-2.6 * (1 - a), 2.75 + (1 - a) * 1.4 - a * 0.25, 0.2); letter.current.rotation.z = (1 - a) * 0.6 + (c.reduce ? 0 : Math.sin(clock.getElapsedTime() * 2) * 0.03 * (1 - a)); }
    if (flag.current) flag.current.rotation.z = -Math.PI / 2 * (1 - clamp(a * 1.5 - 0.5));
  });
  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); c.pick({ text: label, href, at: [x, 4.6, 0.8] }); };
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 2, 16]} />
        <meshStandardMaterial color={WOOD} roughness={0.9} />
      </mesh>
      <group position={[0, 2.6, 0]}>
        <RoundedBox args={[1.5, 1.1, 2]} radius={0.3} castShadow>
          <meshStandardMaterial color={CLAY.blue} roughness={0.85} />
        </RoundedBox>
        <mesh position={[0, 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.75, 0.75, 2, 32, 1, false, -Math.PI / 2, Math.PI]} />
          <meshStandardMaterial color={CLAY.blue} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.35, 1.01]}>
          <boxGeometry args={[0.9, 0.12, 0.02]} />
          <meshStandardMaterial color="#2b3443" roughness={0.6} />
        </mesh>
        <group ref={flag} position={[0.78, 0.1, -0.4]}>
          <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.06, 1, 0.06]} /><meshStandardMaterial color="#2b3443" /></mesh>
          <mesh position={[0, 0.9, 0.22]}><boxGeometry args={[0.05, 0.3, 0.4]} /><meshStandardMaterial color={CLAY.up} roughness={0.8} /></mesh>
        </group>
      </group>
      <group ref={letter}>
        <RoundedBox args={[1.1, 0.7, 0.06]} radius={0.03} castShadow>
          <meshStandardMaterial color="#fffaf1" roughness={0.9} />
        </RoundedBox>
        <mesh position={[0, 0.08, 0.035]} rotation={[0, 0, Math.PI / 4]} scale={[1, 1, 0.1]}>
          <boxGeometry args={[0.5, 0.5, 0.1]} />
          <meshStandardMaterial color={CLAY.sun} roughness={0.85} />
        </mesh>
      </group>
      <mesh position={[0, 2.8, 0]} onPointerOver={over} onPointerMove={over} onPointerOut={() => c.pick(null)} onClick={(e) => { e.stopPropagation(); c.open(href); }}>
        <boxGeometry args={[2, 2.4, 2.4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Camera rig: holds at each station, then flies to the next on an arc. Distance is fitted to each station's size;
    wide screens keep the subject right of the text column, tall screens keep it in the upper half above the card. */
function Rig({ p, boxes }: { p: MutableRefObject<number>; boxes: { w: number; h: number }[] }) {
  const { camera, size } = useThree();
  const look = useMemo(() => new Vector3(), []);
  const cur = useRef<number | null>(null);
  useFrame((_, dt) => {
    const target = p.current * (STATIONS - 1);
    // frame-rate independent catch-up, so a slow device lags by time, not by frames
    cur.current = cur.current === null ? target : cur.current + (target - cur.current) * (1 - Math.exp(-Math.min(dt, 0.1) * 7));
    const s = cur.current, i = Math.min(STATIONS - 2, Math.floor(s)), f = s - i;
    const m = ease(clamp((f - 0.25) / 0.5)), arc = Math.sin(m * Math.PI);
    const c = camera as PerspectiveCamera;
    const aspect = size.width / size.height, wide = aspect > 1.15, tan = Math.tan((c.fov * Math.PI) / 360);
    const fit = (b: { w: number; h: number }) => wide
      ? Math.max(b.w / (0.52 * 2 * tan * aspect), b.h / (0.72 * 2 * tan))
      : Math.max(b.w / (0.9 * 2 * tan * aspect), b.h / (0.46 * 2 * tan));
    const A = boxes[i], B = boxes[i + 1];
    const d = fit(A) + (fit(B) - fit(A)) * m + arc * 6;
    const h = A.h + (B.h - A.h) * m;
    const visW = 2 * d * tan * aspect, visH = 2 * d * tan;
    const x = (i + m) * SX - (wide ? visW * 0.17 : 0);
    const cy = h / 2 - (wide ? 0 : visH * 0.2);
    c.position.set(x, cy + d * 0.12 + arc * 2, d);
    look.set(x, cy, 0);
    c.lookAt(look);
  });
  return null;
}

/** The key light travels with the camera, so its shadow box only has to cover the station in view. */
function Sun({ small }: { small: boolean }) {
  const l = useRef<DirectionalLight>(null);
  const { camera, scene } = useThree();
  useEffect(() => { if (l.current) scene.add(l.current.target); }, [scene]);
  useFrame(() => {
    const o = l.current; if (!o) return;
    o.position.set(camera.position.x + 6, 14, 10);
    o.target.position.set(camera.position.x, 2, 0);
  });
  return <directionalLight ref={l} intensity={2.2} castShadow={!small} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005}
    shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={12} shadow-camera-bottom={-6} shadow-camera-far={40} />;
}

export default function WalkScene({ p, bars, cols, rows, mail, mailLabel, reduce, visible, small, onPick }: {
  p: MutableRefObject<number>; bars: WalkBar[]; cols: WalkCol[]; rows: WalkRow[]; mail: string; mailLabel: string;
  reduce: boolean; visible: boolean; small: boolean; onPick: (x: Pick) => void;
}) {
  const [picked, setPicked] = useState<Pick>(null);
  const pick = (x: Pick) => { setPicked(x); onPick(x); };
  const c: Ctx = { p, reduce, pick, open: (href) => window.location.assign(href) };
  const tallest = Math.max(...cols.map((x) => x.bricks.length), 1) * 0.39 + 0.6;
  // what each station must fit on screen (width, height), in scene units
  const boxes = [{ w: bars.length * 1.7 + 1.6, h: 6.4 }, { w: cols.length * 1.12 + 1.2, h: Math.max(3.4, tallest + 1) }, { w: 8.4, h: rows.length * 1.75 + 0.8 }, { w: 7, h: 5.4 }];
  return (
    <Canvas
      shadows={small ? false : 'percentage'}
      dpr={small ? [1, 1.5] : [1, 2]}
      frameloop={visible ? 'always' : 'never'}
      camera={{ position: [0, 4, 12], fov: 34 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => gl.domElement.closest('[data-walk]')?.setAttribute('data-live', '')}
      onPointerMissed={() => pick(null)}
      style={{ cursor: picked ? 'pointer' : 'auto' }}
    >
      <Rig p={p} boxes={boxes} />
      <hemisphereLight args={['#ffffff', '#c9d4e3', 2]} />
      <Sun small={small} />
      {/* one long clay table the whole walk stands on */}
      <mesh position={[((STATIONS - 1) * SX) / 2, -0.42, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[(STATIONS - 1) * SX + 40, 30]} />
        <shadowMaterial opacity={0.12} />
      </mesh>
      <Board bars={bars} c={c} />
      <Wall cols={cols} c={c} x={SX} />
      <Cabinet rows={rows} c={c} x={SX * 2} />
      <Mailbox c={c} x={SX * 3} href={mail} label={mailLabel} />
      {picked && <TagSprite text={picked.text} position={picked.at} height={0.5} />}
    </Canvas>
  );
}
