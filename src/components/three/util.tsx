import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { useMedia } from './env';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
export * from './env';

/** Minimal stand-in for drei's RoundedBox, so the bundle does not pull all of drei. */
export function RoundedBox({ args, radius, smoothness = 4, children, ...rest }: { args: [number, number, number]; radius: number; smoothness?: number; children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number]; castShadow?: boolean; receiveShadow?: boolean }) {
  const geo = useMemo(() => new RoundedBoxGeometry(args[0], args[1], args[2], smoothness, radius), [args[0], args[1], args[2], radius, smoothness]);
  return <mesh geometry={geo} {...rest}>{children}</mesh>;
}

const FONT = 'Huninn, Fredoka, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif';
/** Text drawn on a canvas sized to it (optionally inside a white pill with an accent rim); returns the texture and its aspect. */
export function useTextTexture(text: string, px: number, pill: boolean, dark = false) {
  const out = useMemo(() => {
    const c = document.createElement('canvas');
    const g = c.getContext('2d')!;
    g.font = `600 ${px}px ${FONT}`;
    const w = Math.ceil(g.measureText(text).width) + px * (pill ? 1.4 : 0.6);
    const h = Math.ceil(px * 1.7);
    c.width = w; c.height = h;
    if (pill) {
      g.fillStyle = dark ? '#253041' : '#ffffff';
      g.beginPath(); g.roundRect(3, 3, w - 6, h - 6, (h - 6) / 2); g.fill();
      g.lineWidth = 6; g.strokeStyle = dark ? '#7fa6e0' : '#4f7fc4'; g.stroke();
    }
    g.font = `600 ${px}px ${FONT}`;
    g.fillStyle = pill && dark ? '#e6ecf4' : '#1d2633'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + px * 0.06);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace; t.anisotropy = 8;
    return { t, aspect: w / h };
  }, [text, px, pill, dark]);
  useEffect(() => () => out.t.dispose(), [out]);
  return out;
}

/** A name tag that always faces the camera and draws over the scene (for the picked object). */
export function TagSprite({ text, position, height = 0.62 }: { text: string; position: [number, number, number]; height?: number }) {
  const dark = useDark();
  const { t, aspect } = useTextTexture(text, 72, true, dark);
  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={t} transparent depthTest={false} toneMapped={false} />
    </sprite>
  );
}

/** Follows the site's theme toggle (data-theme on <html>) and the OS setting. */
export function useDark() {
  const os = useMedia('(prefers-color-scheme: dark)');
  const [attr, setAttr] = useState<string | undefined>(undefined);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setAttr(el.dataset.theme);
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return attr ? attr === 'dark' : os;
}
/** K 喵's fur on a dark page: the light-theme near-black vanished into the navy background. */
export const FUR_DARK = '#5d667a';
