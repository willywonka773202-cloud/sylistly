'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { targetDpr } from '@/lib/visual-capability';

/**
 * Client-only (next/dynamic ssr:false via CelebrationBurst) WebGL celebration.
 * Two systems, both rarity-scaled:
 *   1. InstancedMesh foil confetti — one draw call, tumbles in 3D under gravity
 *      + drag, foil glint baked into per-instance color.
 *   2. Points bloom embers — additive-blended soft sprite (procedural canvas
 *      texture, no network asset) for the champagne/pink glow.
 *
 * Perf contract:
 *   - DPR clamped via targetDpr().
 *   - Particle budget scaled by rarity AND hardwareConcurrency.
 *   - Zero per-frame allocation (reused Matrix4/Quaternion/Vector3, typed-array
 *     particle state).
 *   - rAF is R3F-managed; we pause via frameloop="always" + an internal time
 *     bound that stops updates and calls onComplete. <Canvas> auto-disposes geo/
 *     mats/textures on unmount; we also dispose the ember texture explicitly.
 */

const GRAVITY = -9.2;
const DRAG = 0.86;

function rarityCaps(level: number): { confetti: number; embers: number } {
  // hardwareConcurrency-aware budget (SSR-safe: navigator only read in browser).
  const cores =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4;
  const perfScale = cores <= 4 ? 0.6 : cores <= 8 ? 0.85 : 1;
  const confetti = Math.round((70 + level * 60) * perfScale); // ~42–276
  const embers = Math.round((30 + level * 30) * perfScale); // ~18–108
  return { confetti, embers };
}

/* ── procedural soft round sprite for the embers (no network asset) ───────── */
function makeEmberTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface SceneProps {
  level: number;
  hue: string;
  origin: { x: number; y: number };
  durationMs: number;
  onComplete?: () => void;
}

function Burst({ level, hue, origin, durationMs, onComplete }: SceneProps) {
  const { confetti: confettiCount, embers: emberCount } = useMemo(
    () => rarityCaps(level),
    [level],
  );

  const meshRef = useRef<THREE.InstancedMesh>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const elapsedRef = useRef(0);
  const completedRef = useRef(false);

  // Map normalized viewport origin → scene XY (camera is a simple ortho-ish persp;
  // we just bias the spawn so it reads as coming from the reveal point).
  const spawn = useMemo(() => {
    const x = (origin.x - 0.5) * 6;
    const y = (0.5 - origin.y) * 8;
    return new THREE.Vector3(x, y, 0);
  }, [origin]);

  // Per-instance physics state (typed arrays — no per-frame allocation).
  const state = useMemo(() => {
    const pos = new Float32Array(confettiCount * 3);
    const vel = new Float32Array(confettiCount * 3);
    const rot = new Float32Array(confettiCount * 3); // current euler
    const rotVel = new Float32Array(confettiCount * 3);
    const scale = new Float32Array(confettiCount);
    const spread = 1 + level * 0.6;
    const impulse = 5.5 + level * 2.2;
    for (let i = 0; i < confettiCount; i++) {
      const a = (i / confettiCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = impulse * (0.6 + Math.random() * 0.8);
      pos[i * 3] = spawn.x + (Math.random() - 0.5) * 0.3;
      pos[i * 3 + 1] = spawn.y + (Math.random() - 0.5) * 0.3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
      vel[i * 3] = Math.cos(a) * speed * spread;
      vel[i * 3 + 1] = Math.sin(a) * speed + impulse * 0.5;
      vel[i * 3 + 2] = (Math.random() - 0.5) * speed * 0.5;
      rotVel[i * 3] = (Math.random() - 0.5) * 10;
      rotVel[i * 3 + 1] = (Math.random() - 0.5) * 10;
      rotVel[i * 3 + 2] = (Math.random() - 0.5) * 10;
      scale[i] = 0.6 + Math.random() * 0.7;
    }
    return { pos, vel, rot, rotVel, scale };
  }, [confettiCount, level, spawn]);

  // Ember positions/velocities.
  const emberState = useMemo(() => {
    const pos = new Float32Array(emberCount * 3);
    const vel = new Float32Array(emberCount * 3);
    for (let i = 0; i < emberCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * (2 + level);
      pos[i * 3] = spawn.x;
      pos[i * 3 + 1] = spawn.y;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      vel[i * 3] = Math.cos(a) * sp;
      vel[i * 3 + 1] = Math.sin(a) * sp + 2;
      vel[i * 3 + 2] = (Math.random() - 0.5) * sp;
    }
    return { pos, vel };
  }, [emberCount, level, spawn]);

  const emberPositions = useMemo(
    () => new Float32Array(emberState.pos),
    [emberState],
  );

  const emberTexture = useMemo(() => makeEmberTexture(), []);
  useEffect(() => () => emberTexture.dispose(), [emberTexture]);

  // Per-instance foil colors (gold/foil mix ramps with rarity).
  const instanceColors = useMemo(() => {
    const base = new THREE.Color(hue);
    const gold = new THREE.Color('#FFC24B');
    const white = new THREE.Color('#FFFFFF');
    const arr = new Float32Array(confettiCount * 3);
    const c = new THREE.Color();
    for (let i = 0; i < confettiCount; i++) {
      const r = Math.random();
      const goldBias = 0.25 + level * 0.12;
      if (r < goldBias) c.copy(gold);
      else if (r < goldBias + 0.18) c.copy(white);
      else c.copy(base);
      // foil glint: random brightness so faces "catch light" differently
      const glint = 0.7 + Math.random() * 0.7;
      arr[i * 3] = c.r * glint;
      arr[i * 3 + 1] = c.g * glint;
      arr[i * 3 + 2] = c.b * glint;
    }
    return arr;
  }, [confettiCount, hue, level]);

  // Reused scratch objects (no allocation in the loop).
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const emberColor = useMemo(() => new THREE.Color(hue), [hue]);

  // Seed instance matrices + colors once.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < confettiCount; i++) {
      dummy.position.set(state.pos[i * 3], state.pos[i * 3 + 1], state.pos[i * 3 + 2]);
      dummy.scale.setScalar(state.scale[i]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new THREE.Color(instanceColors[i * 3], instanceColors[i * 3 + 1], instanceColors[i * 3 + 2]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [confettiCount, dummy, instanceColors, state]);

  useFrame((_, rawDelta) => {
    if (completedRef.current) return;
    const delta = Math.min(rawDelta, 1 / 30); // clamp big tab-resume steps
    elapsedRef.current += delta;
    const tNorm = elapsedRef.current / (durationMs / 1000);

    const mesh = meshRef.current;
    if (mesh) {
      for (let i = 0; i < confettiCount; i++) {
        const ix = i * 3;
        // integrate
        state.vel[ix] *= DRAG ** delta;
        state.vel[ix + 1] += GRAVITY * delta;
        state.vel[ix + 1] *= DRAG ** delta;
        state.vel[ix + 2] *= DRAG ** delta;
        state.pos[ix] += state.vel[ix] * delta;
        state.pos[ix + 1] += state.vel[ix + 1] * delta;
        state.pos[ix + 2] += state.vel[ix + 2] * delta;
        state.rot[ix] += state.rotVel[ix] * delta;
        state.rot[ix + 1] += state.rotVel[ix + 1] * delta;
        state.rot[ix + 2] += state.rotVel[ix + 2] * delta;

        dummy.position.set(state.pos[ix], state.pos[ix + 1], state.pos[ix + 2]);
        dummy.rotation.set(state.rot[ix], state.rot[ix + 1], state.rot[ix + 2]);
        // edge-on = thin (foil), face-on = wide — fake with non-uniform scale
        const faceOn = Math.abs(Math.cos(state.rot[ix + 1]));
        dummy.scale.set(state.scale[i] * (0.3 + faceOn * 0.7), state.scale[i], 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    const points = pointsRef.current;
    if (points) {
      const geo = points.geometry;
      const attr = geo.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < emberCount; i++) {
        const ix = i * 3;
        emberState.vel[ix + 1] += GRAVITY * 0.4 * delta;
        arr[ix] += emberState.vel[ix] * delta;
        arr[ix + 1] += emberState.vel[ix + 1] * delta;
        arr[ix + 2] += emberState.vel[ix + 2] * delta;
      }
      attr.needsUpdate = true;
      const mat = points.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, 1 - tNorm);
    }

    if (mesh) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - Math.max(0, tNorm - 0.6) / 0.4);
    }

    if (elapsedRef.current >= durationMs / 1000) {
      completedRef.current = true;
      onComplete?.();
    }
  });

  const emberSize = 0.18 + level * 0.06;

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, confettiCount]}
        frustumCulled={false}
      >
        <planeGeometry args={[0.16, 0.26]} />
        <meshBasicMaterial
          vertexColors
          transparent
          side={THREE.DoubleSide}
          toneMapped={false}
          depthWrite={false}
        />
      </instancedMesh>

      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[emberPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          map={emberTexture}
          color={emberColor}
          size={emberSize}
          sizeAttenuation
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </>
  );
}

/** Pauses R3F's rAF when the tab is hidden (mobile battery). */
function VisibilityGate() {
  const { setFrameloop } = useThree((s) => ({ setFrameloop: s.setFrameloop }));
  useEffect(() => {
    const onVis = () =>
      setFrameloop(document.hidden ? 'never' : 'always');
    document.addEventListener('visibilitychange', onVis);
    onVis();
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [setFrameloop]);
  return null;
}

export default function CelebrationScene(props: SceneProps) {
  return (
    <Canvas
      orthographic={false}
      camera={{ position: [0, 0, 9], fov: 50 }}
      dpr={targetDpr()}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <VisibilityGate />
      <Burst {...props} />
    </Canvas>
  );
}
