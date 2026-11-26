import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
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

