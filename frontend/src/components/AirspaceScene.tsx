import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { SimulationParams, WakeTelemetry } from '../physics/wakeEngine';

interface Props {
  params: SimulationParams;
  telemetry: WakeTelemetry;
  recommendedOffset: { lateralM: number; altitudeFt: number };
}

type CameraPreset = 'TOWER' | 'CHASE' | 'RADAR';

function CameraController({ preset }: { preset: CameraPreset }) {
  const { camera } = useThree();
  const targetPos = useMemo(() => {
    if (preset === 'CHASE') return new THREE.Vector3(2.8, 4.2, 11.5);
    if (preset === 'RADAR') return new THREE.Vector3(0.01, 22, 1.5);
    return new THREE.Vector3(12, 7.5, 12);
  }, [preset]);

  useFrame(() => {
    camera.position.lerp(targetPos, 0.06);
  });
  return null;
}

function DetailedAircraft({
  position,
  scale = 1,
  bodyColor = '#f8fafc',
  accentColor = '#38bdf8',
  isWarning = false,
}: {
  position: [number, number, number];
  scale?: number;
  bodyColor?: string;
  accentColor?: string;
  isWarning?: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ringRef.current && isWarning) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 8) * 0.15;
      ringRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group position={position} scale={scale}>
      {/* Main Fuselage */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.13, 2.4, 20]} />
        <meshStandardMaterial color={bodyColor} metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Nose Cone */}
      <mesh position={[0, -0.02, -1.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.16, 0.45, 20]} />
        <meshStandardMaterial color={bodyColor} metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Swept Left & Right Wings */}
      <mesh position={[-0.85, -0.02, 0.15]} rotation={[0, 0.28, -0.04]}>
        <boxGeometry args={[1.65, 0.04, 0.42]} />
        <meshStandardMaterial color={bodyColor} metalness={0.65} roughness={0.25} />
      </mesh>
      <mesh position={[0.85, -0.02, 0.15]} rotation={[0, -0.28, 0.04]}>
        <boxGeometry args={[1.65, 0.04, 0.42]} />
        <meshStandardMaterial color={bodyColor} metalness={0.65} roughness={0.25} />
      </mesh>
      {/* Wingtip Nav Lights */}
      <mesh position={[-1.65, 0.02, 0.35]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[1.65, 0.02, 0.35]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
      {/* Horizontal Stabilizers & Vertical Tail */}
      <mesh position={[0, 0.04, 1.05]}>
        <boxGeometry args={[0.95, 0.03, 0.25]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      <mesh position={[0, 0.36, 0.98]} rotation={[-0.25, 0, 0]}>
        <boxGeometry args={[0.05, 0.65, 0.35]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.4} />
      </mesh>
      {/* Hazard Alert Halo when Follower enters Wake */}
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
  const sepVisual = params.separationNm * 2.1;

  // Continuous forward flight loop along glideslope
  useFrame((_, delta) => {
    if (flightGroupRef.current && params.isPlaying) {
      flightGroupRef.current.position.z -= delta * 1.4;
      if (flightGroupRef.current.position.z < -7) {
        flightGroupRef.current.position.z = 4;
      }
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

  const hazardColor =
    telemetry.status === 'CRITICAL' ? '#ef4444' : telemetry.status === 'CAUTION' ? '#f59e0b' : '#06b6d4';

  const leadScale = params.leadCategory === 'SUPER' ? 1.2 : params.leadCategory === 'HEAVY' ? 1.0 : 0.82;
  const followerZ = -2 + sepVisual;
  const safeX = -(recommendedOffset.lateralM / 14);
  const safeY = 2.15 + recommendedOffset.altitudeFt / 220;

  return (
    <group ref={flightGroupRef}>
      {/* Lead Aircraft */}
      <DetailedAircraft position={[0, 2.6, -2]} scale={leadScale} bodyColor="#f8fafc" accentColor="#38bdf8" />
      <Html position={[0, 3.65, -2]} center>
        <div className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-950/90 text-cyan-300 border border-cyan-500/50 rounded shadow whitespace-nowrap">
          LEAD • {params.leadCategory}
        </div>
      </Html>

      {/* Outer Translucent Wake Hazard Envelope */}
      <mesh>
        <tubeGeometry args={[leftCurve, 56, 0.26, 12, false]} />
        <meshStandardMaterial color={hazardColor} emissive={hazardColor} emissiveIntensity={0.6} transparent opacity={0.32} />
      </mesh>
      <mesh>
        <tubeGeometry args={[rightCurve, 56, 0.26, 12, false]} />
        <meshStandardMaterial color={hazardColor} emissive={hazardColor} emissiveIntensity={0.6} transparent opacity={0.32} />
      </mesh>

      {/* High-Energy Inner Vortex Cores */}
      <mesh>
        <tubeGeometry args={[leftCoreCurve, 48, 0.06, 8, false]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </mesh>
      <mesh>
        <tubeGeometry args={[rightCoreCurve, 48, 0.06, 8, false]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </mesh>

      {/* Trailing Aircraft */}
      <DetailedAircraft
        position={[0, 2.15, followerZ]}
        scale={0.78}
        bodyColor={telemetry.status === 'CRITICAL' ? '#fecaca' : '#d1fae5'}
        accentColor={telemetry.status === 'CRITICAL' ? '#ef4444' : '#10b981'}
        isWarning={telemetry.status === 'CRITICAL'}
      />
      <Html position={[0, 3.15, followerZ]} center>
        <div
          className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border shadow whitespace-nowrap ${
            telemetry.status === 'CRITICAL'
              ? 'bg-red-950/95 text-red-300 border-red-500 animate-pulse'
              : 'bg-slate-950/90 text-emerald-300 border-emerald-500/50'
          }`}
        >
          FOLLOWER • {telemetry.status === 'CRITICAL' ? 'WAKE ALERT!' : 'B737-800'}
        </div>
      </Html>

      {/* Agentic Recommended Safe Bypass Trajectory */}
      {(recommendedOffset.lateralM > 0 || recommendedOffset.altitudeFt > 0) && (
        <>
          <Line
            points={[
              [0, 2.15, followerZ + 3],
              [safeX, safeY, followerZ],
              [safeX, safeY - 0.3, followerZ - 4.5],
            ]}
            color="#10b981"
            lineWidth={3.5}
            dashed
            dashSize={0.4}
            gapSize={0.2}
          />
          <Html position={[safeX, safeY + 0.65, followerZ]} center>
            <div className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-950/95 text-emerald-300 border border-emerald-400 rounded shadow whitespace-nowrap">
              ✓ SAFE OFFSET ({recommendedOffset.lateralM}m / +{recommendedOffset.altitudeFt}ft)
            </div>
          </Html>
        </>
      )}
    </group>
  );
}

export default function AirspaceScene({ params, telemetry, recommendedOffset }: Props) {
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('TOWER');

  return (
    <div className="w-full h-full bg-[#040812] rounded-xl overflow-hidden border border-slate-800 relative">
      {/* Floating Camera Preset Bar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur border border-slate-800 p-1 rounded-lg">
        {(['TOWER', 'CHASE', 'RADAR'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setCameraPreset(view)}
            className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded transition ${
              cameraPreset === view
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {view} VIEW
          </button>
        ))}
      </div>

      {/* Live Wind Vector HUD */}
      <div className="absolute top-3 right-3 z-10 bg-slate-950/85 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg text-[11px] font-mono text-cyan-300">
        WIND VECTOR: {params.crosswindKts.toFixed(1)} KTS →
      </div>

      <Canvas camera={{ position: [12, 7.5, 12], fov: 44 }}>
        <color attach="background" args={['#040812']} />
        <fog attach="fog" args={['#040812', 22, 55]} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[12, 18, 10]} intensity={1.6} color="#e0f2fe" />
        <pointLight position={[0, 4, 0]} intensity={0.8} color="#38bdf8" />

        <CameraController preset={cameraPreset} />

        {/* Runway 28R Tarmac & Threshold Markings */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -4]}>
          <planeGeometry args={[2.8, 34]} />
          <meshStandardMaterial color="#0b1222" />
        </mesh>
        <Line points={[[-1.35, 0.02, -20], [-1.35, 0.02, 12]]} color="#38bdf8" lineWidth={1.5} />
        <Line points={[[1.35, 0.02, -20], [1.35, 0.02, 12]]} color="#38bdf8" lineWidth={1.5} />
        <Line points={[[0, 0.03, -20], [0, 0.03, 12]]} color="#94a3b8" lineWidth={2} dashed dashSize={0.7} gapSize={0.5} />

        <Grid infiniteGrid fadeDistance={42} sectionColor="#1e293b" cellColor="#0f172a" />

        <AnimatedAirspace params={params} telemetry={telemetry} recommendedOffset={recommendedOffset} />

        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
    </div>
  );
}
