"use client";
import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const STRAND_POINTS = 120;   // resolution per strand
const RADIUS       = 1.2;    // helix radius
const PITCH        = 0.38;   // vertical spacing per turn
const TURNS        = 5;      // number of full turns
const RUNGS        = 28;     // cross-bridge count

function Helix() {
  const groupRef = useRef<THREE.Group>(null!);

  const { strand1Line, strand2Line, rungLines } = useMemo(() => {
    const total   = STRAND_POINTS * TURNS;
    const height  = TURNS * PITCH * 2 * Math.PI;
    const halfH   = height / 2;

    const s1pts: THREE.Vector3[] = [];
    const s2pts: THREE.Vector3[] = [];

    for (let i = 0; i <= total; i++) {
      const t = (i / total) * TURNS * Math.PI * 2;
      const y = (i / total) * height - halfH;
      s1pts.push(new THREE.Vector3( Math.cos(t) * RADIUS, y,  Math.sin(t) * RADIUS));
      s2pts.push(new THREE.Vector3(-Math.cos(t) * RADIUS, y, -Math.sin(t) * RADIUS));
    }

    const s1Geo = new THREE.BufferGeometry().setFromPoints(s1pts);
    const s2Geo = new THREE.BufferGeometry().setFromPoints(s2pts);

    // Rungs — evenly spaced cross-bridges
    const rungPositions: number[] = [];
    for (let r = 0; r < RUNGS; r++) {
      const i  = Math.round((r / RUNGS) * total);
      const t  = (i / total) * TURNS * Math.PI * 2;
      const y  = (i / total) * height - halfH;
      const x1 =  Math.cos(t) * RADIUS;
      const z1 =  Math.sin(t) * RADIUS;
      const x2 = -Math.cos(t) * RADIUS;
      const z2 = -Math.sin(t) * RADIUS;
      rungPositions.push(x1, y, z1, x2, y, z2);
    }
    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rungPositions), 3));

    const strandMaterial = new THREE.LineBasicMaterial({
      color: "#000000",
      transparent: true,
      opacity: 0.14,
    });
    const rungMaterial = new THREE.LineBasicMaterial({
      color: "#000000",
      transparent: true,
      opacity: 0.06,
    });

    return {
      strand1Line: new THREE.Line(s1Geo, strandMaterial),
      strand2Line: new THREE.Line(s2Geo, strandMaterial.clone()),
      rungLines: new THREE.LineSegments(rGeo, rungMaterial),
    };
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.18 + state.mouse.x * 0.3;
    groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.12 + state.mouse.y * 0.14;
    groupRef.current.rotation.z = Math.sin(t * 0.18) * 0.05;
    const breathe = 1 + Math.sin(t * 0.6) * 0.015;
    groupRef.current.scale.setScalar(breathe);
  });

  return (
    <group ref={groupRef} position={[0.8, 0, 0]}>
      <primitive object={strand1Line} />
      <primitive object={strand2Line} />
      <primitive object={rungLines} />
    </group>
  );
}

export function HeroGeometry() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 42 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
      style={{ background: "transparent" }}
    >
      <Helix />
    </Canvas>
  );
}
