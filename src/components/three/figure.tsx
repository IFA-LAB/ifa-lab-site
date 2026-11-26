import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector2, type Group } from 'three';
import { DARK, INK } from './env';

/** The clay member figure's parts, shared by the single figure (ClayBuddy) and the members shelf (ShelfScene). */
export type Accessory = 'none' | 'cat' | 'phones' | 'glasses' | 'guitar';

// Body: a gumdrop (squashed sphere). Face sits on its front surface.
export const BODY_Y = 1.05;
export const R: [number, number, number] = [1, 1.15, 0.92];
/** z on the body's front surface for a given x, y, nudged out a little so decals do not sink in. */
export const surfaceZ = (x: number, y: number) => R[2] * Math.sqrt(Math.max(0, 1 - (x / R[0]) ** 2 - ((y - BODY_Y) / R[1]) ** 2)) - 0.02;

export function Face({ placeholder, reduce }: { placeholder: boolean; reduce: boolean }) {
  const eyes = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!eyes.current || placeholder || reduce) return;
    // blink for ~130ms every 3.6s
    const t = clock.getElapsedTime() % 3.6;
    eyes.current.scale.y = t < 0.13 ? 0.15 : 1;
  });
  const eyeY = 1.27;
  return (
    <group>
      <group ref={eyes} position={[0, eyeY, 0]}>
        {[-0.32, 0.32].map((x) => (
          <mesh key={x} position={[x, 0, surfaceZ(x, eyeY)]} scale={placeholder ? [1.3, 0.25, 0.5] : [1, 1.25, 0.55]}>
            <sphereGeometry args={[0.1, 20, 14]} />
            <meshStandardMaterial color={INK} roughness={0.45} />
          </mesh>
        ))}
      </group>
      {!placeholder && [-0.56, 0.56].map((x) => (
        <mesh key={x} position={[x, 1.02, surfaceZ(x, 1.02)]} rotation={[0, x * 0.9, 0]} scale={[1, 0.6, 0.35]}>
          <sphereGeometry args={[0.13, 20, 14]} />
          <meshStandardMaterial color="#ff8ea0" roughness={0.9} transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  );
}

export function Accessory({ kind, body }: { kind: Accessory; body: string }) {
  const dark = <meshStandardMaterial color={DARK} roughness={0.7} />;
  if (kind === 'cat') {
    return (
      <>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.5, 2.08, 0]} rotation={[0, 0, -s * 0.35]} castShadow>
            <coneGeometry args={[0.28, 0.5, 24]} />
            <meshStandardMaterial color={body} roughness={0.85} />
          </mesh>
        ))}
      </>
    );
  }
  if (kind === 'phones') {
    return (
      <>
        <mesh position={[0, BODY_Y + 0.12, 0]} castShadow>
          <torusGeometry args={[1.08, 0.08, 12, 40, Math.PI]} />
          {dark}
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.02, BODY_Y + 0.05, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.22, 28]} />
            {dark}
          </mesh>
        ))}
      </>
    );
  }
  if (kind === 'glasses') {
    const y = 1.27;
    return (
      <group>
        {[-0.32, 0.32].map((x) => (
          <mesh key={x} position={[x, y, surfaceZ(x, y) + 0.07]}>
            <torusGeometry args={[0.2, 0.035, 10, 32]} />
            {dark}
          </mesh>
        ))}
        <mesh position={[0, y + 0.02, surfaceZ(0, y) + 0.08]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.025, 0.18, 4, 8]} />
          {dark}
        </mesh>
      </group>
    );
  }
  if (kind === 'guitar') {
    const wood = <meshStandardMaterial color="#c2552d" roughness={0.6} />;
    return (
      <group position={[0.95, 0.55, 0.55]} rotation={[0.2, -0.5, -0.55]}>
        <mesh scale={[1, 1, 0.45]} castShadow><sphereGeometry args={[0.34, 28, 20]} />{wood}</mesh>
        <mesh position={[0, 0.38, 0]} scale={[1, 1, 0.45]} castShadow><sphereGeometry args={[0.25, 28, 20]} />{wood}</mesh>
        <mesh position={[0, 0.05, 0.16]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.09, 0.09, 0.02, 24]} /><meshStandardMaterial color="#3b2014" /></mesh>
        <mesh position={[0, 1.0, 0]} castShadow><boxGeometry args={[0.1, 0.9, 0.07]} /><meshStandardMaterial color="#6b3a1f" roughness={0.7} /></mesh>
      </group>
    );
  }
  return null;
}


export type Model = 'matcha-latte';

/** Matcha latte (黃鉅燊 / OG_Matcha): a clay cup on a saucer, cream foam with a latte-art heart, the face on the cup.
    Stands on y = 0 like the gumdrop and is about as tall, so it drops into the same scenes. */
const MATCHA = '#8cb356';
const CREAM = '#f6efe0';
// cup wall profile (radius, height), turned on a lathe
const CUP: [number, number][] = [[0, 0.16], [0.62, 0.16], [0.78, 0.24], [0.88, 0.55], [0.95, 1.05], [1.0, 1.62]];
const cupR = (y: number) => {
  for (let i = 1; i < CUP.length; i++) {
    const [r0, y0] = CUP[i - 1], [r1, y1] = CUP[i];
    if (y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
  }
  return CUP[CUP.length - 1][0];
};
export function MatchaLatte({ reduce, phones = true }: { reduce: boolean; phones?: boolean }) {
  const eyes = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!eyes.current || reduce) return;
    const t = clock.getElapsedTime() % 3.9;
    eyes.current.scale.y = t < 0.13 ? 0.15 : 1;
  });
  const lathe = useMemo(() => CUP.map(([r, y]) => new Vector2(r, y)), []);
  const clay = (c: string) => <meshStandardMaterial color={c} roughness={0.88} />;
  const eyeY = 1.08, cheekY = 0.82;
  const onCup = (x: number, y: number) => Math.sqrt(Math.max(0, cupR(y) ** 2 - x * x)) - 0.01;
  return (
    <group>
      {/* saucer */}
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow><cylinderGeometry args={[1.32, 1.12, 0.16, 48]} />{clay(CREAM)}</mesh>
      {/* cup */}
      <mesh castShadow><latheGeometry args={[lathe, 48]} />{clay(MATCHA)}</mesh>
      <mesh position={[0, 1.62, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><torusGeometry args={[0.98, 0.07, 12, 48]} />{clay(MATCHA)}</mesh>
      {/* foam and the heart */}
      <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.95, 0.95, 0.06, 48]} />{clay(CREAM)}</mesh>
      <group position={[0, 1.64, 0.12]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, 0.3]}>
        {[-1, 1].map((s) => <mesh key={s} position={[s * 0.13, 0.08, 0]}><sphereGeometry args={[0.16, 20, 14]} />{clay(MATCHA)}</mesh>)}
        <mesh position={[0, -0.1, 0]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[0.27, 0.27, 0.3]} />{clay(MATCHA)}</mesh>
      </group>
      {/* handle */}
      <mesh position={[0.97, 0.95, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow><torusGeometry args={[0.32, 0.09, 14, 28, Math.PI]} />{clay(MATCHA)}</mesh>
      {/* face */}
      <group ref={eyes} position={[0, eyeY, 0]}>
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} position={[x, 0, onCup(x, eyeY)]} scale={[1, 1.25, 0.55]}><sphereGeometry args={[0.1, 20, 14]} /><meshStandardMaterial color={INK} roughness={0.45} /></mesh>
        ))}
      </group>
      {[-0.52, 0.52].map((x) => (
        <mesh key={x} position={[x, cheekY, onCup(x, cheekY)]} rotation={[0, x * 1.1, 0]} scale={[1, 0.6, 0.35]}>
          <sphereGeometry args={[0.12, 20, 14]} /><meshStandardMaterial color="#ff8ea0" roughness={0.9} transparent opacity={0.75} />
        </mesh>
      ))}
      <mesh position={[0, 0.93, onCup(0, 0.93) + 0.01]} rotation={[0, 0, Math.PI]}><torusGeometry args={[0.07, 0.022, 8, 16, Math.PI]} /><meshStandardMaterial color={INK} roughness={0.5} /></mesh>
      {/* headphones: anime, games, VTubers */}
      {phones && (
        <>
          <mesh position={[0, 1.55, 0]} castShadow><torusGeometry args={[1.12, 0.07, 12, 40, Math.PI]} /><meshStandardMaterial color={DARK} roughness={0.7} /></mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 1.1, 1.42, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.27, 0.27, 0.2, 28]} /><meshStandardMaterial color={DARK} roughness={0.7} /></mesh>
          ))}
        </>
      )}
    </group>
  );
}
