import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { AIRPORTS, getFlightState3D, type FlightRecord, type SimulationParams, type WakeTelemetry } from '../physics/wakeEngine';

interface Props {
  flights: FlightRecord[];
  params: SimulationParams;
  telemetry: WakeTelemetry;
  recommendedOffset: { lateralM: number; altitudeFt: number };
  focusTrigger: number;
  lightMode: boolean;
  onSelectFlight: (callsign: string) => void;
  onToggleHazardZones: () => void;
}

type CameraPreset = 'TOWER' | 'CHASE' | 'RADAR' | 'FOCUS';

function CameraController({ preset, encounterPoint }: { preset: CameraPreset; encounterPoint: [number, number, number] }) {
  const { camera } = useThree();
  const targetPos = useMemo(() => {
    if (preset === 'FOCUS') return new THREE.Vector3(encounterPoint[0] + 6.5, encounterPoint[1] + 4.2, encounterPoint[2] + 7.5);
    if (preset === 'CHASE') return new THREE.Vector3(3.4, 4.5, 13.0);
    if (preset === 'RADAR') return new THREE.Vector3(0.01, 25, 1.5);
    return new THREE.Vector3(12.5, 7.8, 12.5);
  }, [preset, encounterPoint]);

  useFrame(() => {
    camera.position.lerp(targetPos, 0.06);
  });
  return null;
}

function WindParticles({ crosswindKts, isPlaying }: { crosswindKts: number; isPlaying: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const streaks = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    x: ((i * 7) % 24) - 12,
    y: 0.6 + ((i * 3) % 5) * 0.85,
    z: -15 + ((i * 5) % 26),
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

function AircraftMesh({
  position,
  scale = 1,
  bodyColor,
  accentColor,
  isSelected,
  isConflict,
  bankAngle = 0,
  onClick,
}: {
  position: [number, number, number];
  scale?: number;
  bodyColor: string;
  accentColor: string;
  isSelected: boolean;
  isConflict: boolean;
  bankAngle?: number;
  onClick: () => void;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ringRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 6) * 0.12;
      ringRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group
      position={position}
      scale={scale}
      rotation={[0, 0, bankAngle]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.13, 2.4, 20]} />
        <meshStandardMaterial color={bodyColor} metalness={0.65} roughness={0.25} />
      </mesh>
      <mesh position={[0, -0.02, -1.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.16, 0.45, 20]} />
        <meshStandardMaterial color={bodyColor} metalness={0.65} roughness={0.25} />
      </mesh>
      <mesh position={[-0.85, -0.02, 0.15]} rotation={[0, 0.28, -0.04]}>
        <boxGeometry args={[1.65, 0.04, 0.42]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      <mesh position={[0.85, -0.02, 0.15]} rotation={[0, -0.28, 0.04]}>
        <boxGeometry args={[1.65, 0.04, 0.42]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      <mesh position={[0, 0.36, 0.98]} rotation={[-0.25, 0, 0]}>
        <boxGeometry args={[0.05, 0.65, 0.35]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.45} />
      </mesh>
      {(isSelected || isConflict) && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.85, 0.035, 12, 36]} />
          <meshBasicMaterial color={isConflict ? '#ef4444' : '#38bdf8'} transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
}

function AnimatedAirspace({
  flights,
  params,
  telemetry,
  recommendedOffset,
  onSelectFlight,
}: Omit<Props, 'focusTrigger' | 'lightMode' | 'onToggleHazardZones'>) {
  const [simTick, setSimTick] = useState(0);
  const airportSpec = AIRPORTS[params.airport];

  useFrame((_, delta) => {
    if (params.isPlaying) {
      setSimTick((prev) => (prev + delta * 0.6) % 4);
    }
  });

  const leadFlight = flights.find((f) => f.callsign === params.leadFlightId) || flights[0];
  const followingFlight = flights.find((f) => f.callsign === params.followingFlightId) || flights[1];

  const leadPos = useMemo(() => {
    const base = getFlightState3D(leadFlight, airportSpec.runway);
    return [base.x, base.y, base.z - simTick] as [number, number, number];
  }, [leadFlight, airportSpec.runway, simTick]);

  const wakeTrailLength = Math.max(4.5, telemetry.separationNm * 2.1);

  const { leftCurve, rightCurve, leftCoreCurve, rightCoreCurve } = useMemo(() => {
    const leftPts: THREE.Vector3[] = [];
    const rightPts: THREE.Vector3[] = [];
    const leftCore: THREE.Vector3[] = [];
    const rightCore: THREE.Vector3[] = [];
    const segments = 36;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const z = leadPos[2] + t * wakeTrailLength;
      const driftX = (telemetry.lateralDriftM / 14) * t;
      const sinkY = leadPos[1] - (telemetry.verticalSinkM / 25) * t - t * 0.35;
      const spiral = Math.sin(t * 22) * (0.08 + t * 0.2);
      const spiralY = Math.cos(t * 22) * (0.08 + t * 0.2);

      leftPts.push(new THREE.Vector3(leadPos[0] - 0.8 + driftX + spiral, Math.max(0.25, sinkY + spiralY), z));
      rightPts.push(new THREE.Vector3(leadPos[0] + 0.8 + driftX - spiral, Math.max(0.25, sinkY - spiralY), z));
      leftCore.push(new THREE.Vector3(leadPos[0] - 0.8 + driftX, Math.max(0.25, sinkY), z));
      rightCore.push(new THREE.Vector3(leadPos[0] + 0.8 + driftX, Math.max(0.25, sinkY), z));
    }
    return {
      leftCurve: new THREE.CatmullRomCurve3(leftPts),
      rightCurve: new THREE.CatmullRomCurve3(rightPts),
      leftCoreCurve: new THREE.CatmullRomCurve3(leftCore),
      rightCoreCurve: new THREE.CatmullRomCurve3(rightCore),
    };
  }, [leadPos, wakeTrailLength, telemetry.lateralDriftM, telemetry.verticalSinkM]);

  const hazardColor =
    telemetry.riskCategory === 'CRITICAL'
      ? '#ef4444'
      : telemetry.riskCategory === 'CAUTION'
      ? '#f59e0b'
      : '#06b6d4';

  const isOffsetActive = recommendedOffset.lateralM > 0 || recommendedOffset.altitudeFt > 0;
  const hasConflict = telemetry.riskCategory === 'CRITICAL' || telemetry.riskCategory === 'CAUTION';

  return (
    <group>
      {/* Render All Active Flights from Shared Flight Dataset */}
      {flights.map((flight) => {
        const base = getFlightState3D(flight, airportSpec.runway);
        const isLead = flight.callsign === leadFlight.callsign;
        const isFollowing = flight.callsign === followingFlight.callsign;
        const isSelected = isLead || isFollowing;

        const offsetX = isFollowing ? -(recommendedOffset.lateralM / 14) : 0;
        const offsetY = isFollowing ? recommendedOffset.altitudeFt / 220 : 0;

        const pos: [number, number, number] = [
          base.x + offsetX,
          base.y + offsetY,
          base.z - simTick,
        ];

        const baseScale = flight.wakeClass === 'SUPER' ? 1.18 : flight.wakeClass === 'HEAVY' ? 0.98 : 0.78;
        const scale = baseScale * (params.aircraftScale ?? 1.0);
        const bodyColor = isLead ? '#f8fafc' : isFollowing ? '#bae6fd' : '#94a3b8';
        const accentColor = isSelected && hasConflict ? '#ef4444' : isLead ? '#38bdf8' : isFollowing ? '#10b981' : '#64748b';

        // Projected flight path line toward runway threshold or departure climb
        const pathEnd: [number, number, number] =
          flight.opType === 'DEP'
            ? [pos[0], pos[1] + 2.5, pos[2] - 12]
            : [pos[0], 0.15, -14];

        return (
          <group key={flight.callsign}>
            <AircraftMesh
              position={pos}
              scale={scale}
              bodyColor={bodyColor}
              accentColor={accentColor}
              isSelected={isSelected}
              isConflict={isSelected && hasConflict}
              bankAngle={isFollowing && isOffsetActive ? 0.14 : 0}
              onClick={() => onSelectFlight(flight.callsign)}
            />

            {/* Callsign & ETA Label */}
            <Html position={[pos[0], pos[1] + 1.15, pos[2]]} center>
              <button
                onClick={() => onSelectFlight(flight.callsign)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border shadow whitespace-nowrap transition ${
                  isSelected && hasConflict
                    ? 'bg-red-950/95 text-red-200 border-red-500 font-bold'
                    : isLead
                    ? 'bg-cyan-950/95 text-cyan-200 border-cyan-400 font-bold'
                    : isFollowing
                    ? 'bg-emerald-950/95 text-emerald-200 border-emerald-400 font-bold'
                    : 'bg-slate-950/85 text-slate-300 border-slate-700'
                }`}
              >
                {flight.callsign} • ETA +{flight.arrivalMinutes.toFixed(1)}m
              </button>
            </Html>

            {/* Projected Flight Path Line */}
            <Line
              points={[pos, pathEnd]}
              color={isLead ? '#38bdf8' : isFollowing ? '#10b981' : '#475569'}
              lineWidth={isSelected ? 2 : 1}
              dashed
              dashSize={0.45}
              gapSize={0.3}
            />
          </group>
        );
      })}

      {/* Wake Vortex Hazard Tubes Behind Lead Aircraft */}
      {params.showHazardZones && (
        <>
          <mesh>
            <tubeGeometry args={[leftCurve, 48, 0.26 * (params.aircraftScale ?? 1.0), 12, false]} />
            <meshStandardMaterial color={hazardColor} emissive={hazardColor} emissiveIntensity={0.6} transparent opacity={0.32} />
          </mesh>
          <mesh>
            <tubeGeometry args={[rightCurve, 48, 0.26 * (params.aircraftScale ?? 1.0), 12, false]} />
            <meshStandardMaterial color={hazardColor} emissive={hazardColor} emissiveIntensity={0.6} transparent opacity={0.32} />
          </mesh>
          <mesh>
            <tubeGeometry args={[leftCoreCurve, 40, 0.055, 8, false]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
          </mesh>
          <mesh>
            <tubeGeometry args={[rightCoreCurve, 40, 0.055, 8, false]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
          </mesh>
        </>
      )}

      {/* Predicted Encounter Point Marker */}
      {hasConflict && (
        <group position={[telemetry.encounterPoint3D[0], telemetry.encounterPoint3D[1], telemetry.encounterPoint3D[2] - simTick]}>
          <mesh>
            <sphereGeometry args={[0.35, 16, 16]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
          </mesh>
          <Html position={[0, 0.7, 0]} center>
            <div className="px-2 py-0.5 rounded bg-red-950/95 border border-red-500 text-[9px] font-mono text-red-200 whitespace-nowrap">
              PREDICTED CPA: {telemetry.cpaDistanceNm} NM ({telemetry.timeToCpaSec}s)
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}

export default function AirspaceScene({
  flights,
  params,
  telemetry,
  recommendedOffset,
  focusTrigger,
  lightMode,
  onSelectFlight,
  onToggleHazardZones,
}: Props) {
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('TOWER');
  const airportSpec = AIRPORTS[params.airport];

  React.useEffect(() => {
    if (focusTrigger > 0) setCameraPreset('FOCUS');
  }, [focusTrigger]);

  return (
    <div className={`w-full h-full rounded-xl overflow-hidden border relative ${lightMode ? 'bg-slate-200 border-slate-300' : 'bg-[#040812] border-slate-800'}`}>
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 bg-slate-950/85 backdrop-blur border border-slate-800 p-1 rounded-lg">
        {(['TOWER', 'CHASE', 'RADAR', 'FOCUS'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setCameraPreset(view)}
            className={`px-2 py-1 text-[10px] font-mono font-bold rounded transition ${
              cameraPreset === view ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {view}
          </button>
        ))}
        <button
          onClick={onToggleHazardZones}
          className={`px-2 py-1 text-[10px] font-mono font-bold rounded border transition ${
            params.showHazardZones ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'text-slate-400 border-slate-700'
          }`}
        >
          HAZARD ZONES: {params.showHazardZones ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-slate-950/85 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg text-[11px] font-mono">
        <span className="text-amber-300 font-bold">{airportSpec.code} RWY {airportSpec.runway}</span>
        <span className="text-slate-600">|</span>
        <span className="text-cyan-300">X-WIND: {params.crosswindKts.toFixed(1)} KTS</span>
      </div>

      <Canvas camera={{ position: [12.5, 7.8, 12.5], fov: 44 }}>
        <color attach="background" args={[lightMode ? '#cbd5e1' : '#040812']} />
        <fog attach="fog" args={[lightMode ? '#cbd5e1' : '#040812', 24, 58]} />
        <ambientLight intensity={lightMode ? 1.1 : 0.75} />
        <directionalLight position={[12, 18, 10]} intensity={1.6} color="#e0f2fe" />
        <CameraController preset={cameraPreset} encounterPoint={telemetry.encounterPoint3D} />
        <WindParticles crosswindKts={params.crosswindKts} isPlaying={params.isPlaying} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -4]}>
          <planeGeometry args={[2.8, 36]} />
          <meshStandardMaterial color="#0b1222" />
        </mesh>
        <Line points={[[-1.35, 0.02, -22], [-1.35, 0.02, 14]]} color="#38bdf8" lineWidth={1.5} />
        <Line points={[[1.35, 0.02, -22], [1.35, 0.02, 14]]} color="#38bdf8" lineWidth={1.5} />
        <Line points={[[0, 0.03, -22], [0, 0.03, 14]]} color="#94a3b8" lineWidth={2} dashed dashSize={0.7} gapSize={0.5} />

        <Html position={[0, 0.08, 11.5]} rotation={[-Math.PI / 2, 0, 0]} transform>
          <div className="text-slate-500 font-mono font-black text-2xl tracking-widest select-none">{airportSpec.runway}</div>
        </Html>

        <Grid infiniteGrid fadeDistance={44} sectionColor={lightMode ? '#94a3b8' : '#1e293b'} cellColor={lightMode ? '#cbd5e1' : '#0f172a'} />
        <AnimatedAirspace
          flights={flights}
          params={params}
          telemetry={telemetry}
          recommendedOffset={recommendedOffset}
          onSelectFlight={onSelectFlight}
        />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
    </div>
  );
}
