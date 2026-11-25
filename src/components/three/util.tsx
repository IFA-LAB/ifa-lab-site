import { useMemo, type ReactNode } from 'react';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
export * from './env';

/** Minimal stand-in for drei's RoundedBox, so the bundle does not pull all of drei. */
export function RoundedBox({ args, radius, smoothness = 4, children, ...rest }: { args: [number, number, number]; radius: number; smoothness?: number; children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number]; castShadow?: boolean; receiveShadow?: boolean }) {
  const geo = useMemo(() => new RoundedBoxGeometry(args[0], args[1], args[2], smoothness, radius), [args[0], args[1], args[2], radius, smoothness]);
  return <mesh geometry={geo} {...rest}>{children}</mesh>;
}
