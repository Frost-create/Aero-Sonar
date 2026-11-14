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
  const streaks = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    x: ((i * 7) % 24) - 12,
    y: 0.6 + ((i * 3) % 5) * 0.85,
    z: -15 + ((i * 5) % 26),
    len: 0.6 + (i % 3) * 0.35,
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
          <boxGeometry args={[s.len, 0.015, 0.015]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={Math.min(0.45, 0.12 + crosswindKts / 35)} />
        </mesh>
      ))}
    </group>
  );
}

function AircraftMesh({
  position,
  scale = 1,
  tailColor,
  isQuadEngine,
  isSelected,
  isConflict,
  bankAngle = 0,
  onClick,
}: {
  position: [number, number, number];
  scale?: number;
  tailColor: string;
  isQuadEngine: boolean;
  isSelected: boolean;
  isConflict: boolean;
  bankAngle?: number;
  onClick: () => void;
}) {
  const ringRef = useRef<THREE.Mesh>(null);

  // Smooth aerodynamic fuselage lathe profile (nose tip at y=-1.65 to tail APU at y=+1.65)
  const fuselageGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.001, -1.68),
      new THREE.Vector2(0.08, -1.56),
      new THREE.Vector2(0.15, -1.35),
      new THREE.Vector2(0.185, -1.05),
      new THREE.Vector2(0.19, 0.45),
      new THREE.Vector2(0.15, 1.05),
      new THREE.Vector2(0.075, 1.48),
      new THREE.Vector2(0.02, 1.66),
    ];
    return new THREE.LatheGeometry(pts, 32);
  }, []);

  // Tapered swept vertical stabilizer fin (sleek, realistic height)
  const tailFinGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.55, 0);
    shape.lineTo(0.76, 0.56);
    shape.lineTo(0.54, 0.56);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 0.032, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
  }, []);

  // Tapered swept wing geometry
  const wingGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.32);
    shape.lineTo(2.05, 0.42);
    shape.lineTo(2.05, 0.56);
    shape.lineTo(0, 0.24);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 0.026, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2 });
  }, []);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 4.5) * 0.06;
      ringRef.current.scale.set(s, s, s);
    }
  });

  const engineOffsets = isQuadEngine ? [-0.62, -1.18, 0.62, 1.18] : [-0.66, 0.66];

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
      {/* Sculpted Gloss-White & Pearl-Silver Airliner Fuselage */}
      <mesh geometry={fuselageGeo} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#f8fafc" metalness={0.35} roughness={0.22} />
      </mesh>

      {/* Dark Wrap-Around Cockpit Windshield */}
      <mesh position={[0, 0.085, -1.28]} rotation={[0.48, 0, 0]}>
        <cylinderGeometry args={[0.145, 0.165, 0.14, 24, 1, false, -Math.PI * 0.36, Math.PI * 0.72]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Subtle Airline Cheatline & Window Band */}
      <mesh position={[0, 0.03, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.192, 0.192, 1.75, 28, 1, true]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Swept Right & Left Airfoil Wings */}
      <mesh geometry={wingGeo} position={[0.14, -0.04, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#cbd5e1" metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh geometry={wingGeo} position={[-0.14, -0.04, -0.05]} rotation={[Math.PI / 2, Math.PI, 0]}>
        <meshStandardMaterial color="#cbd5e1" metalness={0.55} roughness={0.28} />
      </mesh>

      {/* Blended Winglets */}
      <mesh position={[2.16, 0.06, 0.44]} rotation={[0.15, 0, -0.35]}>
        <boxGeometry args={[0.025, 0.22, 0.12]} />
        <meshStandardMaterial color={tailColor} />
      </mesh>
      <mesh position={[-2.16, 0.06, 0.44]} rotation={[0.15, 0, 0.35]}>
        <boxGeometry args={[0.025, 0.22, 0.12]} />
        <meshStandardMaterial color={tailColor} />
      </mesh>

      {/* High-Bypass Underwing Turbofan Engines */}
      {engineOffsets.map((engX, idx) => {
        const zSweep = Math.abs(engX) * 0.26 - 0.18;
        return (
          <group key={idx} position={[engX, -0.14, zSweep]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.095, 0.085, 0.46, 20]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.65} roughness={0.22} />
            </mesh>
            <mesh position={[0, 0, -0.235]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.09, 0.012, 10, 24]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.95} roughness={0.1} />
            </mesh>
            <mesh position={[0, 0, -0.22]}>
              <circleGeometry args={[0.082, 16]} />
              <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        );
      })}

      {/* Sleek Swept Vertical Tail Fin (Proportional & Crisp) */}
      <mesh geometry={tailFinGeo} position={[-0.016, 0.06, 0.92]} rotation={[0, -Math.PI / 2, 0]}>
        <meshStandardMaterial color={tailColor} metalness={0.35} roughness={0.28} />
      </mesh>

      {/* Horizontal Tail Stabilizers */}
      <mesh position={[0.42, 0.04, 1.38]} rotation={[0, -0.35, 0]}>
        <boxGeometry args={[0.74, 0.022, 0.2]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[-0.42, 0.04, 1.38]} rotation={[0, 0.35, 0]}>
        <boxGeometry args={[0.74, 0.022, 0.2]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Subtle Selection / Conflict Ring */}
      {(isSelected || isConflict) && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.35, 0.025, 10, 48]} />
          <meshBasicMaterial color={isConflict ? '#ef4444' : '#38bdf8'} transparent opacity={0.65} />
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

  // Compact, proportional wake trail length so it never dominates the viewport
  const wakeTrailLength = Math.min(5.2, Math.max(2.8, telemetry.separationNm * 1.1));

  const { leftPoints, rightPoints } = useMemo(() => {
    const lPts: [number, number, number][] = [];
    const rPts: [number, number, number][] = [];
    const segments = 28;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const z = leadPos[2] + 1.5 + t * wakeTrailLength;
      const driftX = (telemetry.lateralDriftM / 18) * t;
      const sinkY = leadPos[1] - (telemetry.verticalSinkM / 30) * t - t * 0.25;
      const swirl = Math.sin(t * 16) * (0.04 + t * 0.12);
      const swirlY = Math.cos(t * 16) * (0.04 + t * 0.12);

      lPts.push([leadPos[0] - 0.85 + driftX + swirl, Math.max(0.2, sinkY + swirlY), z]);
      rPts.push([leadPos[0] + 0.85 + driftX - swirl, Math.max(0.2, sinkY - swirlY), z]);
    }
    return { leftPoints: lPts, rightPoints: rPts };
  }, [leadPos, wakeTrailLength, telemetry.lateralDriftM, telemetry.verticalSinkM]);

  const hazardColor =
    telemetry.riskCategory === 'CRITICAL'
      ? '#ef4444'
      : telemetry.riskCategory === 'CAUTION'
      ? '#f59e0b'
      : '#38bdf8';

  const isOffsetActive = recommendedOffset.lateralM > 0 || recommendedOffset.altitudeFt > 0;
  const hasConflict = telemetry.riskCategory === 'CRITICAL' || telemetry.riskCategory === 'CAUTION';

  return (
    <group>
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

        const baseScale = flight.wakeClass === 'SUPER' ? 1.15 : flight.wakeClass === 'HEAVY' ? 0.98 : 0.82;
        const scale = baseScale * (params.aircraftScale ?? 1.0);

        // Sophisticated airline tail colors (Lufthansa/United Deep Navy, Emerald, Amber)
        const tailColor =
          isSelected && hasConflict
            ? '#dc2626'
            : isLead
            ? '#0f294a' // Deep Lufthansa / United Navy
            : isFollowing
            ? '#047857' // Deep Emerald
            : flight.wakeClass === 'HEAVY'
            ? '#b45309' // Warm Amber
            : '#334155'; // Slate

        const pathEnd: [number, number, number] =
          flight.opType === 'DEP'
            ? [pos[0], pos[1] + 2.5, pos[2] - 12]
            : [pos[0], 0.15, -14];

        return (
          <group key={flight.callsign}>
            <AircraftMesh
              position={pos}
              scale={scale}
              tailColor={tailColor}
              isQuadEngine={flight.wakeClass === 'SUPER'}
              isSelected={isSelected}
              isConflict={isSelected && hasConflict}
              bankAngle={isFollowing && isOffsetActive ? 0.14 : 0}
              onClick={() => onSelectFlight(flight.callsign)}
            />

            <Html position={[pos[0], pos[1] + 1.15 * scale, pos[2]]} center>
              <button
                onClick={() => onSelectFlight(flight.callsign)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border shadow whitespace-nowrap transition ${
                  isSelected && hasConflict
                    ? 'bg-red-950/95 text-red-200 border-red-500 font-bold'
                    : isLead
                    ? 'bg-slate-900/95 text-sky-300 border-sky-500/70 font-bold'
                    : isFollowing
                    ? 'bg-slate-900/95 text-emerald-300 border-emerald-500/70 font-bold'
                    : 'bg-slate-950/85 text-slate-300 border-slate-700'
                }`}
              >
                {flight.callsign} • {flight.acType} • +{flight.arrivalMinutes.toFixed(1)}m
              </button>
            </Html>

            <Line
              points={[pos, pathEnd]}
              color={isLead ? '#38bdf8' : isFollowing ? '#10b981' : '#475569'}
              lineWidth={isSelected ? 1.5 : 0.8}
              dashed
              dashSize={0.5}
              gapSize={0.4}
              transparent
              opacity={0.55}
            />
          </group>
        );
      })}

      {/* Sleek, Non-Distracting Helical Wake Streamlines */}
      {params.showHazardZones && (
        <>
          <Line points={leftPoints} color={hazardColor} lineWidth={2.2} transparent opacity={0.55} />
          <Line points={rightPoints} color={hazardColor} lineWidth={2.2} transparent opacity={0.55} />
        </>
      )}

      {hasConflict && (
        <group position={[telemetry.encounterPoint3D[0], telemetry.encounterPoint3D[1], telemetry.encounterPoint3D[2] - simTick]}>
          <mesh>
            <sphereGeometry args={[0.28, 16, 16]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.75} />
          </mesh>
          <Html position={[0, 0.65, 0]} center>
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
        <ambientLight intensity={lightMode ? 1.3 : 1.05} />
        <directionalLight position={[14, 22, 12]} intensity={2.1} color="#ffffff" />
        <directionalLight position={[-10, 8, -10]} intensity={0.7} color="#bae6fd" />
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
