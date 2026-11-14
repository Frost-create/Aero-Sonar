import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { AIRPORTS, type SimulationParams, type WakeTelemetry } from '../physics/wakeEngine';

interface Props {
  params: SimulationParams;
  telemetry: WakeTelemetry;
  recommendedOffset: { lateralM: number; altitudeFt: number };
}

type CameraPreset = 'TOWER' | 'CHASE' | 'RADAR';

function CameraController({ preset }: { preset: CameraPreset }) {
  const { camera } = useThree();
  const targetPos = useMemo(() => {
    if (preset === 'CHASE') return new THREE.Vector3(3.2, 4.4, 12.0);
    if (preset === 'RADAR') return new THREE.Vector3(0.01, 23, 1.5);
    return new THREE.Vector3(12, 7.5, 12);
  }, [preset]);

  useFrame(() => { camera.position.lerp(targetPos, 0.06); });
  return null;
}

function WindParticles({ crosswindKts, isPlaying }: { crosswindKts: number; isPlaying: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const streaks = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    x: ((i * 7) % 24) - 12,
    y: 0.6 + ((i * 3) % 5) * 0.85,
    z: -14 + ((i * 5) % 24),
    len: 0.7 + (i % 3) * 0.4,
  })), []);

  useFrame((_, delta) => {
    if (!groupRef.current || !isPlaying || crosswindKts <= 0.1) return;
    const speed = (crosswindKts / 20) * 9.5;
    groupRef.current.children.forEach((child) => {
      child.position.x += speed * delta;
      if (child.position.x > 12) child.position.x = -12;
    });
  });

  if (crosswindKts <= 0.2) return null;
  return (
    <group ref={groupRef}>
      {streaks.map((s, idx) => (
        <mesh key={idx} position={[s.x, s.y, s.z]}>
          <boxGeometry args={[s.len, 0.02, 0.02]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={Math.min(0.65, 0.15 + crosswindKts / 28)} />
        </mesh>
      ))}
    </group>
  );
}

function DetailedAircraft({ position, scale = 1, bodyColor = '#f8fafc', accentColor = '#38bdf8', isWarning = false, bankAngle = 0 }: {
  position: [number, number, number]; scale?: number; bodyColor?: string; accentColor?: string; isWarning?: boolean; bankAngle?: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ringRef.current && isWarning) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 8) * 0.15;
      ringRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group position={position} scale={scale} rotation={[0, 0, bankAngle]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.13, 2.4, 20]} />
        <meshStandardMaterial color={bodyColor} metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[0, -0.02, -1.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.16, 0.45, 20]} />
        <meshStandardMaterial color={bodyColor} metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[-0.85, -0.02, 0.15]} rotation={[0, 0.28, -0.04]}>
        <boxGeometry args={[1.65, 0.04, 0.42]} />
        <meshStandardMaterial color={bodyColor} metalness={0.65} roughness={0.25} />
      </mesh>
      <mesh position={[0.85, -0.02, 0.15]} rotation={[0, -0.28, 0.04]}>
        <boxGeometry args={[1.65, 0.04, 0.42]} />
        <meshStandardMaterial color={bodyColor} metalness={0.65} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.04, 1.05]}>
        <boxGeometry args={[0.95, 0.03, 0.25]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      <mesh position={[0, 0.36, 0.98]} rotation={[-0.25, 0, 0]}>
        <boxGeometry args={[0.05, 0.65, 0.35]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.4} />
      </mesh>
      {isWarning && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.9, 0.03, 12, 36]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

function AnimatedAirspace({ params, telemetry, recommendedOffset }: Props) {
  const flightGroupRef = useRef<THREE.Group>(null);
  const followerGroupRef = useRef<THREE.Group>(null);
  const sepVisual = params.separationNm * 2.1;
  const followerZ = -2 + sepVisual;
  const targetX = -(recommendedOffset.lateralM / 14);
  const targetY = 2.15 + recommendedOffset.altitudeFt / 220;

  useFrame((_, delta) => {
    if (flightGroupRef.current && params.isPlaying) {
      flightGroupRef.current.position.z -= delta * 1.4;
      if (flightGroupRef.current.position.z < -7) flightGroupRef.current.position.z = 4;
    }
    if (followerGroupRef.current) {
      followerGroupRef.current.position.x = THREE.MathUtils.lerp(followerGroupRef.current.position.x, targetX, 0.08);
      followerGroupRef.current.position.y = THREE.MathUtils.lerp(followerGroupRef.current.position.y, targetY, 0.08);
    }
  });

  const { leftCurve, rightCurve, leftCoreCurve, rightCoreCurve } = useMemo(() => {
    const leftPts: THREE.Vector3[] = [];
    const rightPts: THREE.Vector3[] = [];
    const leftCore: THREE.Vector3[] = [];
    const rightCore: THREE.Vector3[] = [];
    const segments = 40;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const z = -2 + t * sepVisual;
      const driftX = (telemetry.lateralDriftM / 14) * t;
      const sinkY = 2.6 - (telemetry.verticalSinkM / 25) * t - t * 0.45;
      const spiral = Math.sin(t * 24) * (0.08 + t * 0.22);
      const spiralY = Math.cos(t * 24) * (0.08 + t * 0.22);

      leftPts.push(new THREE.Vector3(-0.85 + driftX + spiral, Math.max(0.3, sinkY + spiralY), z));
      rightPts.push(new THREE.Vector3(0.85 + driftX - spiral, Math.max(0.3, sinkY - spiralY), z));
      leftCore.push(new THREE.Vector3(-0.85 + driftX, Math.max(0.3, sinkY), z));
      rightCore.push(new THREE.Vector3(0.85 + driftX, Math.max(0.3, sinkY), z));
    }
    return {
      leftCurve: new THREE.CatmullRomCurve3(leftPts),
      rightCurve: new THREE.CatmullRomCurve3(rightPts),
      leftCoreCurve: new THREE.CatmullRomCurve3(leftCore),
      rightCoreCurve: new THREE.CatmullRomCurve3(rightCore),
    };
  }, [sepVisual, telemetry.lateralDriftM, telemetry.verticalSinkM]);

  const hazardColor = telemetry.status === 'CRITICAL' ? '#ef4444' : telemetry.status === 'CAUTION' ? '#f59e0b' : '#06b6d4';
  const leadScale = params.leadCategory === 'SUPER' ? 1.2 : params.leadCategory === 'HEAVY' ? 1.0 : 0.82;
  const isOffsetActive = recommendedOffset.lateralM > 0 || recommendedOffset.altitudeFt > 0;

  return (
    <group ref={flightGroupRef}>
      <DetailedAircraft position={[0, 2.6, -2]} scale={leadScale} bodyColor="#f8fafc" accentColor="#38bdf8" />
      <Html position={[0, 3.65, -2]} center>
        <div className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-950/90 text-cyan-300 border border-cyan-500/50 rounded shadow whitespace-nowrap">
          LEAD • {params.leadCategory}
        </div>
      </Html>

      <mesh>
        <tubeGeometry args={[leftCurve, 56, 0.26, 12, false]} />
        <meshStandardMaterial color={hazardColor} emissive={hazardColor} emissiveIntensity={0.6} transparent opacity={0.32} />
      </mesh>
      <mesh>
        <tubeGeometry args={[rightCurve, 56, 0.26, 12, false]} />
        <meshStandardMaterial color={hazardColor} emissive={hazardColor} emissiveIntensity={0.6} transparent opacity={0.32} />
      </mesh>
      <mesh>
        <tubeGeometry args={[leftCoreCurve, 48, 0.06, 8, false]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </mesh>
      <mesh>
        <tubeGeometry args={[rightCoreCurve, 48, 0.06, 8, false]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </mesh>

      <group ref={followerGroupRef} position={[0, 2.15, followerZ]}>
        <DetailedAircraft
          position={[0, 0, 0]}
          scale={0.78}
          bodyColor={telemetry.status === 'CRITICAL' ? '#fecaca' : '#d1fae5'}
          accentColor={telemetry.status === 'CRITICAL' ? '#ef4444' : '#10b981'}
          isWarning={telemetry.status === 'CRITICAL'}
          bankAngle={isOffsetActive ? 0.14 : 0}
        />
        <Html position={[0, 1.0, 0]} center>
          <div className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border shadow whitespace-nowrap ${
            telemetry.status === 'CRITICAL' ? 'bg-red-950/95 text-red-300 border-red-500 animate-pulse' : 'bg-slate-950/90 text-emerald-300 border-emerald-500/50'
          }`}>
            {isOffsetActive ? 'FOLLOWER • OFFSET ACTIVE' : `FOLLOWER • ${telemetry.status === 'CRITICAL' ? 'WAKE ALERT!' : 'B737-800'}`}
          </div>
        </Html>
      </group>

      {isOffsetActive && (
        <Line points={[[0, 2.15, followerZ + 3.5], [targetX, targetY, followerZ], [targetX, targetY - 0.25, followerZ - 5.0]]} color="#10b981" lineWidth={3.5} dashed dashSize={0.4} gapSize={0.2} />
      )}
    </group>
  );
}

export default function AirspaceScene({ params, telemetry, recommendedOffset }: Props) {
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('TOWER');
  const airportSpec = AIRPORTS[params.airport];

  return (
    <div className="w-full h-full bg-[#040812] rounded-xl overflow-hidden border border-slate-800 relative">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur border border-slate-800 p-1 rounded-lg">
        {(['TOWER', 'CHASE', 'RADAR'] as const).map((view) => (
          <button key={view} onClick={() => setCameraPreset(view)} className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded transition ${cameraPreset === view ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50' : 'text-slate-400 hover:text-slate-200'}`}>
            {view}
          </button>
        ))}
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-slate-950/85 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg text-[11px] font-mono">
        <span className="text-amber-300 font-bold">{airportSpec.code} RWY {airportSpec.runway}</span>
        <span className="text-slate-600">|</span>
        <span className="text-cyan-300">CROSSWIND: {params.crosswindKts.toFixed(1)} KTS →</span>
      </div>

      <Canvas camera={{ position: [12, 7.5, 12], fov: 44 }}>
        <color attach="background" args={['#040812']} />
        <fog attach="fog" args={['#040812', 22, 55]} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[12, 18, 10]} intensity={1.6} color="#e0f2fe" />
        <CameraController preset={cameraPreset} />
        <WindParticles crosswindKts={params.crosswindKts} isPlaying={params.isPlaying} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -4]}>
          <planeGeometry args={[2.8, 34]} />
          <meshStandardMaterial color="#0b1222" />
        </mesh>
        <Line points={[[-1.35, 0.02, -20], [-1.35, 0.02, 12]]} color="#38bdf8" lineWidth={1.5} />
        <Line points={[[1.35, 0.02, -20], [1.35, 0.02, 12]]} color="#38bdf8" lineWidth={1.5} />
        <Line points={[[0, 0.03, -20], [0, 0.03, 12]]} color="#94a3b8" lineWidth={2} dashed dashSize={0.7} gapSize={0.5} />

        <Html position={[0, 0.08, 10.5]} rotation={[-Math.PI / 2, 0, 0]} transform>
          <div className="text-slate-500 font-mono font-black text-2xl tracking-widest select-none">{airportSpec.runway}</div>
        </Html>

        <Grid infiniteGrid fadeDistance={42} sectionColor="#1e293b" cellColor="#0f172a" />
        <AnimatedAirspace params={params} telemetry={telemetry} recommendedOffset={recommendedOffset} />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
    </div>
  );
}
