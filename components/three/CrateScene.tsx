'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox, ContactShadows, Sparkles, Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useRef } from 'react';
import * as THREE from 'three';
import { targetDpr } from '@/lib/visual-capability';

// Camera framing: a resting 3/4 idle, and a tighter, slightly-craned OPEN pose
// the camera dollies into as the lid lifts — so the climax feels directed.
// Module-scope constants → no per-frame allocation.
const CAM_IDLE = new THREE.Vector3(2.3, 1.7, 2.7);
const CAM_OPEN = new THREE.Vector3(1.55, 2.25, 2.0);

/**
 * The real 3D Daily-Drop crate — a dark, metallic, ribbon-wrapped box that idles
 * (slow spin + bob) with an emissive accent glow + bloom. On `opening`, the idle
 * stops, the lid lifts/tilts off, and a glowing light shaft bursts up before the
 * reel takes over. Pure lights (no network HDRI), DPR-clamped, transparent
 * canvas. Mounted ONLY behind the capability gate + next/dynamic ssr:false.
 */
function Crate({ hue, opening }: { hue: string; opening: boolean }) {
  const group = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const shaft = useRef<THREE.Mesh>(null);
  const t = useRef(0); // open progress 0→1
  const accent = new THREE.Color(hue);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const d = Math.min(dt, 1 / 30);
    if (opening) {
      t.current = Math.min(1, t.current + d * 1.9);
    } else {
      t.current = Math.max(0, t.current - d * 3);
      g.rotation.y += 0.013; // idle spin only when closed — bold, clearly turning
    }
    const e = 1 - Math.pow(1 - t.current, 3); // easeOutCubic
    g.rotation.x = -0.18 + Math.sin(state.clock.elapsedTime * 0.6) * 0.05 * (1 - e);
    g.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.06 * (1 - e);

    // Cinematic dolly: ease the camera from the idle 3/4 into a tighter craned
    // pose as the lid rises, tracking the lift point. Frame-rate-independent lerp.
    const cam = state.camera;
    cam.position.lerp(opening ? CAM_OPEN : CAM_IDLE, 1 - Math.pow(0.0001, d));
    cam.lookAt(0, e * 0.5, 0);
    const pcam = cam as THREE.PerspectiveCamera;
    const fovTarget = 38 - e * 4; // gentle push-in on the glass
    if (Math.abs(pcam.fov - fovTarget) > 0.01) {
      pcam.fov = fovTarget;
      pcam.updateProjectionMatrix();
    }
    if (lid.current) {
      lid.current.position.y = 0.42 + e * 0.95;
      lid.current.rotation.x = -e * 0.5;
      lid.current.rotation.z = e * 0.22;
    }
    if (shaft.current) {
      const m = shaft.current.material as THREE.MeshBasicMaterial;
      m.opacity = e * 0.5;
      shaft.current.scale.set(0.6 + e * 0.6, 0.4 + e * 1.6, 0.6 + e * 0.6);
    }
  });

  return (
    <group ref={group} rotation={[-0.18, 0.5, 0]} scale={1.14}>
      {/* body */}
      <RoundedBox args={[1.45, 1.05, 1.45]} radius={0.1} smoothness={4} position={[0, -0.18, 0]} castShadow>
        <meshStandardMaterial color="#15151a" metalness={0.85} roughness={0.22} envMapIntensity={1.4} emissive={accent} emissiveIntensity={0.05} />
      </RoundedBox>
      {/* ribbon cross on the body (slim emissive accent, gentle glow) */}
      <mesh position={[0, -0.16, 0]}>
        <boxGeometry args={[0.11, 1.1, 1.5]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} metalness={0.35} roughness={0.45} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.16, 0]}>
        <boxGeometry args={[1.5, 1.1, 0.11]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} metalness={0.35} roughness={0.45} toneMapped={false} />
      </mesh>
      {/* light shaft — hidden until open, then bursts upward (blooms) */}
      <mesh ref={shaft} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.06, 0.55, 2.4, 24, 1, true]} />
        <meshBasicMaterial color={accent} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* lid group — lifts + tilts on open; bow rides along */}
      <group ref={lid} position={[0, 0.42, 0]}>
        <RoundedBox args={[1.56, 0.34, 1.56]} radius={0.09} smoothness={4}>
          <meshStandardMaterial color="#1d1d24" metalness={0.78} roughness={0.26} envMapIntensity={1.3} />
        </RoundedBox>
        <mesh position={[0, 0.2, 0]}>
          <icosahedronGeometry args={[0.14, 0]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} metalness={0.3} roughness={0.4} toneMapped={false} />
        </mesh>
        {/* ribbon segment on the lid (so it reads wrapped when closed) */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.11, 0.36, 1.6]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} metalness={0.35} roughness={0.45} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.6, 0.36, 0.11]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} metalness={0.35} roughness={0.45} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

export default function CrateScene({ hue = '#FF2D6D', opening = false }: { hue?: string; opening?: boolean }) {
  return (
    <Canvas
      dpr={targetDpr()}
      camera={{ position: [2.3, 1.7, 2.7], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 2]} intensity={2.2} />
      <pointLight position={[-2.5, 1, 2.5]} intensity={28} color={hue} distance={9} decay={2} />
      <pointLight position={[0, 3.5, -1]} intensity={14} color="#E7C79B" distance={11} decay={2} />
      {/* Baked, network-free reflection environment — champagne + accent soft
          boxes the lacquered metal picks up as specular roll-off and edge
          glints. frames={1} renders the cubemap ONCE (zero per-frame cost). */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.4} color="#E7C79B" scale={[6, 3, 1]} position={[0, 4, -3]} />
        <Lightformer form="rect" intensity={3} color={hue} scale={[3, 4, 1]} position={[-4, 1, 2]} />
        <Lightformer form="rect" intensity={1.6} color="#ffffff" scale={[4, 2, 1]} position={[4, 2, 3]} />
        <Lightformer form="ring" intensity={1.2} color="#E7C79B" scale={2} position={[0, -1, 4]} />
      </Environment>
      <Crate hue={hue} opening={opening} />
      {/* Restrained champagne glints drifting around the crate — a few premium
          motes (not a dense field); they catch the bloom for a luxe shimmer. */}
      <Sparkles count={40} scale={[3.4, 2.8, 3.4]} position={[0, 0.2, 0]} size={5} speed={0.5} noise={0.5} color="#E7C79B" opacity={0.8} />
      <ContactShadows position={[0, -0.92, 0]} opacity={0.55} blur={2.6} far={2.2} scale={4} color="#000000" />
      <EffectComposer>
        <Bloom intensity={1.35} luminanceThreshold={0.18} luminanceSmoothing={0.4} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
