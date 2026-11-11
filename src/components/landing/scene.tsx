"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Cinematic scroll-driven scene for the public landing page.
 * World layout (camera flies along -Z as the page scrolls):
 *   hero/ribbon z≈8…-55 · candle field alongside · calendar heatmap z≈-78 · prop rings z≈-102 · final pull-back.
 * All data is deterministic illustration (seeded RNG), never user data.
 */
const GOLD = new THREE.Color("#C6A15B");
const GOLD_HI = new THREE.Color("#F1D49A");
const PROFIT = new THREE.Color("#39B980");
const LOSS = new THREE.Color("#E45D67");
const GRAPHITE = new THREE.Color("#262D38");

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Camera keyframes: [position, look-at] per section (0 … 5). */
const KEYS: [number, number, number, number, number, number][] = [
  [16, 3.2, -13, 0, 1.4, -20], // hero: side view — the equity curve rises left → right
  [7, 2.6, -30, -1.5, 1.8, -39], // journal: glide alongside the curve
  [11, 5.5, -47, -5, 1.2, -50], // statistics: candle field behind the curve
  [4.5, 10.5, -63, 4.5, -0.5, -78], // calendar heatmap from above, left of the text
  [0, 2.8, -82, 3, 1, -102], // prop rings, right of the text
  [26, 22, -8, 0, -1, -52], // final pull-back over the whole world (fog lifts)
];const posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(k[0], k[1], k[2])), false, "centripetal");
const lookCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(k[3], k[4], k[5])), false, "centripetal");

function useEquityCurve() {
  return useMemo(() => {
    const r = rng(7);
    const pts: THREE.Vector3[] = [];
    let y = -1.5;
    for (let i = 0; i < 90; i++) {
      y += (r() - 0.38) * 0.45; // positive drift: an edge
      pts.push(new THREE.Vector3(Math.sin(i * 0.13) * 3.2, y, 8 - i * 0.72));
    }
    return new THREE.CatmullRomCurve3(pts);
  }, []);
}

function CameraRig({ progress, reduced }: { progress: React.RefObject<number>; reduced: boolean }) {
  const { camera, pointer, scene } = useThree();
  const t = useRef(0);
  const look = useMemo(() => new THREE.Vector3(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const target = Math.min(1, Math.max(0, progress.current ?? 0));
    t.current = reduced ? target : THREE.MathUtils.damp(t.current, target, 3.2, dt);
    posCurve.getPoint(t.current, pos);
    lookCurve.getPoint(t.current, look);
    if (!reduced) { pos.x += pointer.x * 0.6; pos.y += pointer.y * 0.35; }
    camera.position.copy(pos);
    camera.lookAt(look);
    // lift the fog for the final overview shot
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      const k = THREE.MathUtils.smoothstep(t.current, 0.8, 1);
      fog.near = THREE.MathUtils.lerp(18, 40, k);
      fog.far = THREE.MathUtils.lerp(70, 170, k);
    }
  });
  return null;
}

function EquityRibbon({ curve, progress, reduced }: { curve: THREE.CatmullRomCurve3; progress: React.RefObject<number>; reduced: boolean }) {
  const core = useMemo(() => new THREE.TubeGeometry(curve, 600, 0.07, 10, false), [curve]);
  const glow = useMemo(() => new THREE.TubeGeometry(curve, 600, 0.32, 12, false), [curve]);
  const pulse = useRef<THREE.Mesh>(null);
  const drawn = useRef(reduced ? 1 : 0);
  useFrame((state, dt) => {
    // draw the curve in on load, then keep it fully visible
    drawn.current = Math.min(1, drawn.current + dt * 0.35);
    const count = Math.floor(core.index!.count * drawn.current);
    core.setDrawRange(0, count - (count % 3));
    glow.setDrawRange(0, Math.floor(glow.index!.count * drawn.current / 3) * 3);
    if (pulse.current) {
      const u = reduced ? 0.98 : (state.clock.elapsedTime * 0.06 + (progress.current ?? 0) * 0.5) % 1;
      curve.getPoint(Math.min(u, drawn.current), pulse.current.position);
      const s = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.25;
      pulse.current.scale.setScalar(s);
    }
  });
  return (
    <group>
      <mesh geometry={core}><meshBasicMaterial color={GOLD_HI} toneMapped={false} /></mesh>
      <mesh geometry={glow}><meshBasicMaterial color={GOLD} transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
      <mesh ref={pulse}>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshBasicMaterial color={GOLD_HI} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CandleField({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const wicks = useRef<THREE.InstancedMesh>(null);
  const N = 140;
  const data = useMemo(() => {
    const r = rng(42);
    return Array.from({ length: N }, (_, i) => {
      const u = i / N;
      const p = curve.getPoint(u);
      const up = r() > 0.42;
      // behind the curve (seen from +x), in depth layers
      return { x: p.x - (3.5 + r() * 11), y: p.y + (r() - 0.5) * 3.5, z: p.z + (r() - 0.5) * 3, h: 0.4 + r() * 1.8, w: 1.2 + r() * 1.6, up, phase: r() * Math.PI * 2 };
    });
  }, [curve]);
  useEffect(() => {
    const m = new THREE.Matrix4();
    data.forEach((c, i) => {
      bodies.current!.setColorAt(i, c.up ? PROFIT : LOSS);
      wicks.current!.setColorAt(i, c.up ? PROFIT : LOSS);
      m.makeScale(1, c.h, 1).setPosition(c.x, c.y, c.z);
      bodies.current!.setMatrixAt(i, m);
      m.makeScale(1, c.h * c.w, 1).setPosition(c.x, c.y, c.z);
      wicks.current!.setMatrixAt(i, m);
    });
    bodies.current!.instanceColor!.needsUpdate = true;
    wicks.current!.instanceColor!.needsUpdate = true;
  }, [data]);
  useFrame((state) => {
    // gentle float
    const m = new THREE.Matrix4();
    const t = state.clock.elapsedTime;
    data.forEach((c, i) => {
      const dy = Math.sin(t * 0.6 + c.phase) * 0.15;
      m.makeScale(1, c.h, 1).setPosition(c.x, c.y + dy, c.z);
      bodies.current!.setMatrixAt(i, m);
      m.makeScale(1, c.h * c.w, 1).setPosition(c.x, c.y + dy, c.z);
      wicks.current!.setMatrixAt(i, m);
    });
    bodies.current!.instanceMatrix.needsUpdate = true;
    wicks.current!.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, N]}>
        <boxGeometry args={[0.32, 1, 0.32]} />
        <meshStandardMaterial roughness={0.35} metalness={0.2} emissive="#0b0f14" />
      </instancedMesh>
      <instancedMesh ref={wicks} args={[undefined, undefined, N]}>
        <boxGeometry args={[0.04, 1, 0.04]} />
        <meshBasicMaterial transparent opacity={0.7} />
      </instancedMesh>
    </group>
  );
}

function CalendarHeatmap() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const cols = 7, rows = 5, N = cols * rows;
  const cells = useMemo(() => {
    const r = rng(11);
    return Array.from({ length: N }, (_, i) => {
      const weekend = i % 7 >= 5;
      const v = weekend ? 0 : (r() - 0.4) * 2;
      return { x: 2 + (i % cols - (cols - 1) / 2) * 1.7, z: -78 + (Math.floor(i / cols) - (rows - 1) / 2) * 1.7, v, phase: r() * 6 };
    });
  }, [N]);
  useEffect(() => {
    cells.forEach((c, i) => ref.current!.setColorAt(i, c.v === 0 ? GRAPHITE : c.v > 0 ? PROFIT : LOSS));
    ref.current!.instanceColor!.needsUpdate = true;
  }, [cells]);
  useFrame((state) => {
    const m = new THREE.Matrix4();
    const t = state.clock.elapsedTime;
    cells.forEach((c, i) => {
      const h = 0.15 + Math.abs(c.v) * 2.6 * (0.85 + Math.sin(t * 0.8 + c.phase) * 0.15);
      m.makeScale(1, h, 1).setPosition(c.x, h / 2 - 1.5, c.z);
      ref.current!.setMatrixAt(i, m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, N]}>
        <boxGeometry args={[1.35, 1, 1.35]} />
        <meshStandardMaterial roughness={0.3} metalness={0.25} />
      </instancedMesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2, -1.52, -78]}>
        <planeGeometry args={[14, 11]} />
        <meshBasicMaterial color="#0E1117" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function PropRings() {
  const group = useRef<THREE.Group>(null);
  const rings = [
    { x: 3.5, progress: 0.62, color: GOLD },
    { x: 8.7, progress: 0.38, color: GOLD_HI },
    { x: 13.9, progress: 1, color: PROFIT },
  ];
  useFrame((state) => {
    if (!group.current) return;
    group.current.children.forEach((g, i) => {
      g.rotation.z = state.clock.elapsedTime * (0.15 + i * 0.05);
      g.position.y = 1 + Math.sin(state.clock.elapsedTime * 0.7 + i) * 0.25;
    });
  });
  return (
    <group ref={group} position={[0, 0, -102]}>
      {rings.map((r) => (
        <group key={r.x} position={[r.x, 1, 0]}>
          <mesh><torusGeometry args={[2, 0.06, 16, 120]} /><meshBasicMaterial color={GRAPHITE} /></mesh>
          <mesh><torusGeometry args={[2, 0.12, 16, 160, Math.PI * 2 * r.progress]} /><meshBasicMaterial color={r.color} toneMapped={false} /></mesh>
          <mesh><torusGeometry args={[2, 0.42, 16, 160, Math.PI * 2 * r.progress]} /><meshBasicMaterial color={r.color} transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
        </group>
      ))}
    </group>
  );
}

function GoldDust({ reduced }: { reduced: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const r = rng(3);
    const n = 2400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (r() - 0.5) * 70;
      pos[i * 3 + 1] = (r() - 0.3) * 40;
      pos[i * 3 + 2] = 30 - r() * 150;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame((_, dt) => { if (ref.current && !reduced) ref.current.rotation.y += dt * 0.006; });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color={GOLD} size={0.06} sizeAttenuation transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

export default function LandingScene({ progress, reduced }: { progress: React.RefObject<number>; reduced: boolean }) {
  const curve = useEquityCurve();
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      camera={{ fov: 50, near: 0.1, far: 260, position: [0, 1.6, 15] }}
      aria-hidden
    >
      <color attach="background" args={["#090B0F"]} />
      <fog attach="fog" args={["#090B0F", 18, 70]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 12, 8]} intensity={1.2} color="#ffe9c2" />
      <pointLight position={[2, 6, -78]} intensity={60} distance={30} color="#C6A15B" />
      <pointLight position={[9, 5, -100]} intensity={50} distance={28} color="#D8B56D" />
      <CameraRig progress={progress} reduced={reduced} />
      <GoldDust reduced={reduced} />
      <EquityRibbon curve={curve} progress={progress} reduced={reduced} />
      <CandleField curve={curve} />
      <CalendarHeatmap />
      <PropRings />
    </Canvas>
  );
}
