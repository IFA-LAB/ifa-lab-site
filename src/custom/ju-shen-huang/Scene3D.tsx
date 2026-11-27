import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, type Group, type PerspectiveCamera } from 'three';
import { CLAY, INK, RoundedBox, TagSprite } from '@/components/three/util';
import { KINDS, YEARS, type Item, type Kind } from './data';

// one brick per item; each year's candle starts where the year before ended, like a rising K line
const BW = 1.6, BH = 0.3, BD = 1.0, GAP = 0.035, STEP = 2.25;
const ORDER: Kind[] = ['role', 'research', 'work', 'award', 'win'];
const ROW = BH + GAP;

type Brick = { item: Item; year: number; x: number; y: number; k: number };
function layout() {
  const bricks: Brick[] = [];
  const tops: number[] = [], bases: number[] = [];
  let base = 0, k = 0;
  YEARS.forEach((yr, i) => {
    const x = (i - (YEARS.length - 1) / 2) * STEP;
    bases.push(base * ROW);
    [...yr.items].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)).forEach((item, j) => {
      bricks.push({ item, year: i, x, y: (base + j) * ROW + BH / 2, k: k++ });
    });
    base += yr.items.length;
    tops.push(base * ROW);
  });
  return { bricks, tops, bases, height: base * ROW };
}
const L = layout();
// aim a little above the middle: the legend sits over the top-left corner and the tallest candle is on the right
const TARGET: [number, number, number] = [0.3, L.height / 2 + 0.5, 0];

type Props = { sel: number; hot: string | null; visible: boolean; onPick: (i: number) => void; onHover: (id: string | null, x?: number, y?: number) => void };

export default function Scene3D({ sel, hot, visible, onPick, onHover }: Props) {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.75]}
      frameloop={visible ? 'always' : 'never'}
      camera={{ fov: 30, position: [8, 9, 22] }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => onHover(null)}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Fit />
      <hemisphereLight args={['white', CLAY.grey, 1.55]} />
      <directionalLight
        position={[6, 14, 9]}
        intensity={1.7}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-radius={6}
        shadow-bias={-0.0005}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={12}
        shadow-camera-bottom={-4}
      />
      <Chart sel={sel} hot={hot} onPick={onPick} onHover={onHover} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial opacity={0.12} />
      </mesh>
    </Canvas>
  );
}

/** Keep the whole climb in frame at any stage size: back the camera off until both the height and the width fit. */
function Fit() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    const t = Math.tan((cam.fov * Math.PI) / 360);
    // narrow stages wrap the legend onto two lines: leave room over the tallest candle and aim higher
    const aspect = size.width / size.height, narrow = aspect < 1.4;
    const h = L.height + (narrow ? 4.4 : 2.6), w = (YEARS.length - 1) * STEP + BW + 1.4;
    const dist = Math.max(h / 2 / t, w / 2 / (t * aspect)) * 1.02;
    const dir = [0.3, 0.22, 1];
    const n = Math.hypot(...dir);
    const ty = TARGET[1] + (narrow ? 0.9 : 0);
    cam.position.set(TARGET[0] + (dir[0] / n) * dist, ty + (dir[1] / n) * dist, TARGET[2] + (dir[2] / n) * dist);
    cam.lookAt(TARGET[0], ty, TARGET[2]);
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

function Chart({ sel, hot, onPick, onHover }: Omit<Props, 'visible'>) {
  const root = useRef<Group>(null);
  const born = useRef<number | null>(null);
  const { gl } = useThree();
  // a slow sway and a little pointer parallax, so the chart reads as an object on the desk
  useFrame(({ clock, pointer }) => {
    if (born.current === null) born.current = clock.elapsedTime;
    const g = root.current;
    if (!g) return;
    const want = Math.sin(clock.elapsedTime * 0.25) * 0.06 + pointer.x * 0.1;
    g.rotation.y += (want - g.rotation.y) * 0.05;
  });
  const over = (b: Brick) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    gl.domElement.style.cursor = 'pointer';
    onHover(b.item.id, e.nativeEvent.clientX, e.nativeEvent.clientY);
  };
  const out = () => { gl.domElement.style.cursor = ''; onHover(null); };

  return (
    <group ref={root}>
      {L.bricks.map((b) => (
        <ClayBrick key={b.item.id} b={b} on={b.year === sel} hot={hot === b.item.id} born={born}
          onOver={over(b)} onOut={out} onClick={(e) => { e.stopPropagation(); onPick(b.year); }} />
      ))}
      {YEARS.map((yr, i) => {
        const x = (i - (YEARS.length - 1) / 2) * STEP;
        const wins = yr.items.filter((it) => it.kind === 'win');
        const top = L.tops[i], base = L.bases[i];
        return (
          <group key={yr.year}>
            {/* the wick: through the candle, a little past the bottom, and past the top where no cup stands */}
            <mesh position={[x, (base - 0.25 + top + (wins.length ? 0 : 0.3)) / 2, 0]} castShadow>
              <cylinderGeometry args={[0.035, 0.035, top - base + 0.25 + (wins.length ? 0 : 0.3), 10]} />
              <meshStandardMaterial color={INK} roughness={0.6} />
            </mesh>
            {wins.map((w, j) => <Cup key={w.id} position={[x + (j - (wins.length - 1) / 2) * 0.38, top, 0.05]} on={i === sel} />)}
            <group onClick={(e) => { e.stopPropagation(); onPick(i); }}>
              <TagSprite text={yr.year} position={[x, Math.max(0.2, base) - 0.42, BD / 2 + 0.3]} height={i === sel ? 0.5 : 0.4} />
            </group>
          </group>
        );
      })}
    </group>
  );
}

const hsl = { h: 0, s: 0, l: 0 };
function tint(clay: string, on: boolean) {
  const c = new Color(CLAY[clay]);
  if (on) return c;
  // other years keep their hue but lose most of the colour, so red stays a pale red (not pink) and the picked year stands out
  c.getHSL(hsl);
  return c.setHSL(hsl.h, hsl.s * 0.32, Math.min(0.86, hsl.l + 0.14));
}

function ClayBrick({ b, on, hot, born, onOver, onOut, onClick }: {
  b: Brick; on: boolean; hot: boolean; born: { current: number | null };
  onOver: (e: ThreeEvent<PointerEvent>) => void; onOut: () => void; onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const g = useRef<Group>(null);
  const color = useMemo(() => tint(KINDS[b.item.kind].clay, on), [b.item.kind, on]);
  useFrame(({ clock }) => {
    const m = g.current;
    if (!m || born.current === null) return;
    // the chart builds itself once, brick by brick from the bottom, then each brick eases to its rest height
    const t = Math.min(1, Math.max(0, (clock.elapsedTime - born.current - b.k * 0.045) / 0.4));
    const e = 1 - (1 - t) ** 3;
    const rest = b.y + (hot ? 0.12 : 0);
    m.visible = t > 0;
    m.position.y = t < 1 ? rest + (1 - e) * 1.2 : m.position.y + (rest - m.position.y) * 0.2;
    const s = (0.7 + 0.3 * e) * (hot ? 1.06 : 1);
    m.scale.set(s, s, s);
  });
  return (
    <group ref={g} position={[b.x, b.y, 0]} visible={false} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
      <RoundedBox args={[BW, BH, BD]} radius={0.09} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.55} />
      </RoundedBox>
    </group>
  );
}

/** A small clay trophy for each national first prize, standing on top of that year's candle. */
function Cup({ position, on }: { position: [number, number, number]; on: boolean }) {
  const color = useMemo(() => tint('sun', on), [on]);
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]} castShadow><cylinderGeometry args={[0.12, 0.13, 0.06, 20]} /><meshStandardMaterial color={color} roughness={0.5} /></mesh>
      <mesh position={[0, 0.1, 0]} castShadow><cylinderGeometry args={[0.035, 0.05, 0.1, 12]} /><meshStandardMaterial color={color} roughness={0.5} /></mesh>
      <mesh position={[0, 0.27, 0]} castShadow><cylinderGeometry args={[0.16, 0.08, 0.26, 20]} /><meshStandardMaterial color={color} roughness={0.45} /></mesh>
    </group>
  );
}
