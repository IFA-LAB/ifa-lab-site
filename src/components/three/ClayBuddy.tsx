import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Group } from 'three';
import { CLAY, DARK, INK, canRun3D, usePrefersReducedMotion, useMedia } from './util';

type Accessory = 'none' | 'cat' | 'phones' | 'glasses' | 'guitar';
type Props = {
  clay: string;
  accessory: Accessory;
  placeholder?: boolean;
  hint: string;
  hintTouch: string;
};

/** Shared between DOM handlers and the render loop: drag spin and jump requests. */
type Ctl = { spin: number; vel: number; dragging: boolean; jump: number };

// Body: a gumdrop (squashed sphere). Face sits on its front surface.
const BODY_Y = 1.05;
const R: [number, number, number] = [1, 1.15, 0.92];
/** z on the body's front surface for a given x, y, nudged out a little so decals do not sink in. */
const surfaceZ = (x: number, y: number) => R[2] * Math.sqrt(Math.max(0, 1 - (x / R[0]) ** 2 - ((y - BODY_Y) / R[1]) ** 2)) - 0.02;

function Face({ placeholder, reduce }: { placeholder: boolean; reduce: boolean }) {
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

function Accessory({ kind, body }: { kind: Accessory; body: string }) {
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

function Buddy({ clay, accessory, placeholder, reduce, ctl }: { clay: string; accessory: Accessory; placeholder: boolean; reduce: boolean; ctl: RefObject<Ctl> }) {
  const spin = useRef<Group>(null);
  const lean = useRef<Group>(null);
  const squash = useRef<Group>(null);
  const hop = useRef({ y: 0, vy: 0, s: 0, vs: 0 });
  const body = CLAY[placeholder ? 'grey' : clay] ?? CLAY.grey;

  useFrame(({ pointer, clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const c = ctl.current;
    // drag spin with inertia
    if (!c.dragging) {
      c.vel *= Math.pow(0.04, dt);
      c.spin += c.vel * dt;
    }
    if (spin.current) spin.current.rotation.y = c.spin;
    if (reduce) return;

    // look toward the pointer (idle sway when it is a placeholder: half asleep)
    if (lean.current) {
      const t = clock.getElapsedTime();
      const tx = placeholder ? Math.sin(t * 0.8) * 0.05 : pointer.y * -0.12;
      const ty = placeholder ? 0 : pointer.x * 0.35;
      lean.current.rotation.x += (tx - lean.current.rotation.x) * 0.08;
      lean.current.rotation.y += (ty - lean.current.rotation.y) * 0.08;
      lean.current.rotation.z = placeholder ? Math.sin(t * 0.8) * 0.06 : 0;
    }

    // jump: ballistic hop + squash spring on take-off and landing
    const h = hop.current;
    if (c.jump > 0) {
      c.jump = 0;
      if (h.y === 0) { h.vy = 5.2; h.vs = -6; }
    }
    if (h.y > 0 || h.vy > 0) {
      h.vy -= 18 * dt;
      h.y += h.vy * dt;
      if (h.y <= 0) { h.y = 0; h.vy = 0; h.vs -= 5; }
    }
    h.vs += (-220 * h.s - 16 * h.vs) * dt;
    h.s += h.vs * dt;
    // breathing when idle
    const breathe = h.y === 0 ? Math.sin(clock.getElapsedTime() * 2) * 0.012 : 0;
    if (squash.current) {
      squash.current.position.y = h.y;
      const sy = 1 + h.s * 0.12 + breathe;
      squash.current.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    }
  });

  return (
    <group ref={spin}>
      <group ref={squash}>
        <group ref={lean} position={[0, 0, 0]}>
          <mesh position={[0, BODY_Y, 0]} scale={R} castShadow>
            <sphereGeometry args={[1, 48, 36]} />
            <meshStandardMaterial color={body} roughness={0.88} />
          </mesh>
          <Face placeholder={placeholder} reduce={reduce} />
          {!placeholder && <Accessory kind={accessory} body={body} />}
        </group>
      </group>
      {/* feet keep it from looking like it floats */}
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.1, 0.2]} scale={[1, 0.55, 1.2]} castShadow>
          <sphereGeometry args={[0.24, 20, 14]} />
          <meshStandardMaterial color={body} roughness={0.88} />
        </mesh>
      ))}
    </group>
  );
}

/** Interactive 3D clay figure for a member's page. Drag to spin, click to make it hop.
    Renders an empty host until WebGL is confirmed; the CSS ClayFigure underneath stays as fallback. */
export default function ClayBuddy({ clay, accessory, placeholder = false, hint, hintTouch }: Props) {
  const [ok, setOk] = useState(false);
  const [visible, setVisible] = useState(true);
  const host = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const touch = useMedia('(hover: none)');
  const ctl = useRef<Ctl>({ spin: -0.35, vel: 0, dragging: false, jump: 0 });

  useEffect(() => setOk(canRun3D()), []);
  useEffect(() => {
    if (!host.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(host.current);
    return () => io.disconnect();
  }, [ok]);
  useEffect(() => {
    if (ok) host.current?.closest('[data-buddy]')?.setAttribute('data-live', '');
  }, [ok]);

  // Pointer handling on the host: horizontal drag spins, a tap without movement hops.
  useEffect(() => {
    const el = host.current;
    if (!ok || !el) return;
    let x0 = 0, last = 0, lastT = 0, moved = 0;
    const down = (e: PointerEvent) => {
      x0 = last = e.clientX; lastT = performance.now(); moved = 0;
      ctl.current.dragging = true; ctl.current.vel = 0;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!ctl.current.dragging) return;
      const now = performance.now();
      const dx = e.clientX - last;
      moved = Math.max(moved, Math.abs(e.clientX - x0));
      ctl.current.spin += dx * 0.012;
      ctl.current.vel = (dx * 0.012) / Math.max((now - lastT) / 1000, 1 / 120);
      last = e.clientX; lastT = now;
    };
    const up = () => {
      if (!ctl.current.dragging) return;
      ctl.current.dragging = false;
      if (moved < 6) { ctl.current.vel = 0; if (!reduce) ctl.current.jump = 1; }
      if (reduce) ctl.current.vel = 0;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [ok, reduce]);

  if (!ok) return <div ref={host} className="buddy-canvas" aria-hidden="true" />;
  return (
    <div ref={host} className="buddy-canvas" aria-hidden="true">
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        frameloop={visible ? 'always' : 'never'}
        camera={{ position: [0, 1.9, 7.4], fov: 30 }}
        onCreated={({ camera }) => camera.lookAt(0, 1.15, 0)}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      >
        <hemisphereLight args={['#ffffff', '#b9c6d8', 1.7]} />
        <directionalLight position={[3, 6, 5]} intensity={2.3} castShadow shadow-mapSize={[512, 512]} shadow-bias={-0.0005}
          shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-3} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[2.2, 40]} />
          <shadowMaterial opacity={0.18} />
        </mesh>
        <Buddy clay={clay} accessory={accessory} placeholder={placeholder} reduce={reduce} ctl={ctl} />
      </Canvas>
      <span className="buddy-hint">{touch ? hintTouch : hint}</span>
    </div>
  );
}
