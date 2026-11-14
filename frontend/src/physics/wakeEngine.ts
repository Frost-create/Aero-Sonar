export type AirportCode = 'KSFO' | 'EGLL' | 'VIDP' | 'OMDB' | 'KJFK' | 'RJTT';
export type WakeCategory = 'SUPER' | 'HEAVY' | 'MEDIUM';

export interface AirportSpec {
  code: AirportCode;
  iata: string;
  name: string;
  runway: string;
  runwayHeading: number;
  defaultCrosswind: number;
  metarFallback: string;
}

export const AIRPORTS: Record<AirportCode, AirportSpec> = {
  KSFO: { code: 'KSFO', iata: 'SFO', name: 'San Francisco Intl', runway: '28R', runwayHeading: 284, defaultCrosswind: 1.5, metarFallback: 'KSFO 141956Z 29004KT 10SM FEW025 17/09 A3012' },
  EGLL: { code: 'EGLL', iata: 'LHR', name: 'London Heathrow', runway: '27L', runwayHeading: 270, defaultCrosswind: 14.5, metarFallback: 'EGLL 141950Z 21016KT 9999 SCT032 12/06 Q1018' },
  VIDP: { code: 'VIDP', iata: 'DEL', name: 'Indira Gandhi Intl', runway: '29R', runwayHeading: 290, defaultCrosswind: 4.0, metarFallback: 'VIDP 141930Z 26006KT 4000 HZ NSC 22/11 Q1015' },
  OMDB: { code: 'OMDB', iata: 'DXB', name: 'Dubai International', runway: '30R', runwayHeading: 300, defaultCrosswind: 11.5, metarFallback: 'OMDB 141900Z 34013KT CAVOK 28/14 Q1014' },
  KJFK: { code: 'KJFK', iata: 'JFK', name: 'John F. Kennedy Intl', runway: '31L', runwayHeading: 314, defaultCrosswind: 16.0, metarFallback: 'KJFK 141951Z 24018G24KT 10SM BKN045 09/M02 A2998' },
  RJTT: { code: 'RJTT', iata: 'HND', name: 'Tokyo Haneda Intl', runway: '34L', runwayHeading: 337, defaultCrosswind: 8.5, metarFallback: 'RJTT 141930Z 04011KT 9999 FEW030 14/04 Q1021' },
};

export interface FlightRecord {
  callsign: string;
  acType: string;
  wakeClass: WakeCategory;
  opType: 'ARR' | 'DEP';
  runway: string;
  arrivalMinutes: number; // Scheduled arrival/departure offset in minutes from now
  speedKts: number;
  icaoSepNm: number;
}

export interface SimulationParams {
  airport: AirportCode;
  leadFlightId: string;
  followingFlightId: string;
  trajectoryThresholdNm: number;
  crosswindKts: number;
  windDirectionDeg: number;
  windSpeedKts: number;
  offlineEdgeMode: boolean;
  isPlaying: boolean;
  voiceEnabled: boolean;
  autoWatchdog: boolean;
  showHazardZones: boolean;
  aircraftScale: number;
}

export type MatrixSeverity = 'HIGH' | 'POTENTIAL' | 'MONITOR' | 'CLEAR';

export interface PairConflictAnalysis {
  leadId: string;
  followingId: string;
  // A. Trajectory Conflict
  trajectoryConflict: boolean;
  cpaDistanceNm: number;
  timeToCpaSec: number;
  // B. Wake-Vortex Encounter
  wakeEncounter: boolean;
  wakeAgeSec: number;
  wakeIntensityGamma: number;
  lateralDriftM: number;
  verticalSinkM: number;
  // Combined Decision Metrics
  riskScore: number;
  riskCategory: 'CRITICAL' | 'CAUTION' | 'MONITOR' | 'CLEAR';
  matrixSeverity: MatrixSeverity;
  conflictLabel: string;
  separationNm: number;
  encounterPoint3D: [number, number, number];
}

export interface WakeTelemetry extends PairConflictAnalysis {
  gamma0: number;
  extraLandingsHr: number;
  co2SavedKgHr: number;
  delayCostSavedUsdHr: number;
  decayCurve: { sec: number; strength: number; safeThreshold: number }[];
}

export const SPECS: Record<WakeCategory, { mass: number; span: number; speed: number; icaoSep: number }> = {
  SUPER: { mass: 560000, span: 79.8, speed: 72, icaoSep: 6.0 },
  HEAVY: { mass: 351000, span: 64.8, speed: 74, icaoSep: 5.0 },
  MEDIUM: { mass: 79000, span: 35.8, speed: 70, icaoSep: 3.0 },
};

export const INITIAL_FLIGHTS: FlightRecord[] = [
  { callsign: 'UAL863', acType: 'A388', wakeClass: 'SUPER', opType: 'ARR', runway: '28R', arrivalMinutes: 2.0, speedKts: 145, icaoSepNm: 6.0 },
  { callsign: 'DAL1428', acType: 'B738', wakeClass: 'MEDIUM', opType: 'ARR', runway: '28R', arrivalMinutes: 3.3, speedKts: 155, icaoSepNm: 6.0 },
  { callsign: 'ANA108', acType: 'B789', wakeClass: 'HEAVY', opType: 'ARR', runway: '28L', arrivalMinutes: 5.2, speedKts: 165, icaoSepNm: 5.0 },
  { callsign: 'SWA2194', acType: 'B38M', wakeClass: 'MEDIUM', opType: 'DEP', runway: '01R', arrivalMinutes: 4.1, speedKts: 150, icaoSepNm: 3.0 },
];

export function getFlightState3D(flight: FlightRecord, primaryRunway: string) {
  const distNm = Math.max(0.5, (flight.arrivalMinutes / 60) * flight.speedKts);
  const z = -4.5 + distNm * 2.1;
  const x = flight.opType === 'DEP' ? 1.8 : flight.runway === primaryRunway ? 0 : -1.9;
  const y = flight.opType === 'DEP' ? 1.6 + Math.max(0, 6 - distNm) * 0.35 : Math.min(5.2, 1.3 + distNm * 0.28);
  return { x, y, z, distNm };
}

export function analyzeFlightPair(
  lead: FlightRecord,
  following: FlightRecord,
  params: SimulationParams,
  appliedOffset: { lateralM: number; altitudeFt: number } = { lateralM: 0, altitudeFt: 0 }
): PairConflictAnalysis {
  const airportSpec = AIRPORTS[params.airport];
  const leadSpec = SPECS[lead.wakeClass];

  // Ensure chronological order for wake generation (earlier arrival leads)
  const [first, second] = lead.arrivalMinutes <= following.arrivalMinutes ? [lead, following] : [following, lead];
  const firstSpec = SPECS[first.wakeClass];

  const dtMin = Math.abs(second.arrivalMinutes - first.arrivalMinutes);
  const avgSpeedKts = (first.speedKts + second.speedKts) / 2;
  const inTrailNm = Math.max(0.4, (dtMin / 60) * avgSpeedKts);

  // Runway lane lateral separation in meters
  const sameRunway = first.runway === second.runway && first.opType === second.opType;
  const baseLaneOffsetM = sameRunway ? 0 : first.opType !== second.opType ? 95 : 220;

  // A. Trajectory Conflict (3D Closest Point of Approach)
  const lateralSepNm = (baseLaneOffsetM + Math.abs(appliedOffset.lateralM)) / 1852;
  const verticalSepNm = (Math.abs(second.arrivalMinutes - first.arrivalMinutes) * 320 + appliedOffset.altitudeFt) / 6076;
  const cpaDistanceNm = Math.round(Math.sqrt(inTrailNm ** 2 + lateralSepNm ** 2 + verticalSepNm ** 2) * 100) / 100;
  const timeToCpaSec = Math.max(5, Math.round(first.arrivalMinutes * 60));
  const trajectoryConflict = cpaDistanceNm < params.trajectoryThresholdNm;

  // B. Wake-Vortex Encounter (Burnham-Hallock Decay & Drift)
  const scale = params.aircraftScale ?? 1.0;
  const b0 = (Math.PI / 4) * firstSpec.span * scale;
  const gamma0 = (firstSpec.mass * scale * 9.81) / (1.225 * firstSpec.speed * b0);
  const wakeAgeSec = Math.max(8, Math.round(dtMin * 60));
  const wakeIntensityGamma = Math.round(gamma0 * Math.exp(-wakeAgeSec / 55));

  const lateralDriftM = Math.round(params.crosswindKts * 0.514444 * wakeAgeSec * 10) / 10;
  const sinkRate = wakeIntensityGamma / (2 * Math.PI * b0);
  const verticalSinkM = Math.round(Math.min(sinkRate * wakeAgeSec * 0.45, 22) * 10) / 10;

  const effectiveLateralClearance = Math.abs(baseLaneOffsetM + lateralDriftM + appliedOffset.lateralM);
  const effectiveVerticalClearance = appliedOffset.altitudeFt * 0.3048;
  const totalWakeClearanceM = Math.sqrt(effectiveLateralClearance ** 2 + effectiveVerticalClearance ** 2);

  const wakeExposure = Math.max(0, 1 - totalWakeClearanceM / 58);
  const strengthRatio = Math.min(1.15, wakeIntensityGamma / 255);
  const wakeRisk = wakeExposure * strengthRatio * 96;
  const trajRisk = trajectoryConflict ? Math.min(95, ((params.trajectoryThresholdNm - cpaDistanceNm) / params.trajectoryThresholdNm) * 110) : 0;

  const riskScore = Math.round(Math.min(99.2, Math.max(wakeRisk, trajRisk)) * 10) / 10;
  const wakeEncounter = wakeRisk > 35 && inTrailNm < firstSpec.icaoSep;

  let riskCategory: PairConflictAnalysis['riskCategory'] = 'CLEAR';
  let matrixSeverity: MatrixSeverity = 'CLEAR';
  let conflictLabel = 'No Modeled Conflict';

  if (riskScore >= 65) {
    riskCategory = 'CRITICAL';
    matrixSeverity = 'HIGH';
    conflictLabel = wakeEncounter ? 'Potential Wake Encounter' : 'Trajectory Conflict';
  } else if (riskScore >= 35) {
    riskCategory = 'CAUTION';
    matrixSeverity = 'POTENTIAL';
    conflictLabel = wakeEncounter ? 'Potential Wake Encounter' : 'Potential Conflict';
  } else if (riskScore >= 18 || cpaDistanceNm < params.trajectoryThresholdNm + 0.8) {
    riskCategory = 'MONITOR';
    matrixSeverity = 'MONITOR';
    conflictLabel = 'Monitor';
  }

  const p1 = getFlightState3D(first, airportSpec.runway);
  const p2 = getFlightState3D(second, airportSpec.runway);
  const encounterPoint3D: [number, number, number] = [
    (p1.x + p2.x) / 2,
    (p1.y + p2.y) / 2,
    (p1.z + p2.z) / 2,
  ];

  return {
    leadId: lead.callsign,
    followingId: following.callsign,
    trajectoryConflict,
    cpaDistanceNm,
    timeToCpaSec,
    wakeEncounter,
    wakeAgeSec,
    wakeIntensityGamma,
    lateralDriftM,
    verticalSinkM,
    riskScore,
    riskCategory,
    matrixSeverity,
    conflictLabel,
    separationNm: Math.round(inTrailNm * 10) / 10,
    encounterPoint3D,
  };
}

export function computeLiveWake(
  lead: FlightRecord,
  following: FlightRecord,
  params: SimulationParams,
  appliedOffset: { lateralM: number; altitudeFt: number } = { lateralM: 0, altitudeFt: 0 }
): WakeTelemetry {
  const pair = analyzeFlightPair(lead, following, params, appliedOffset);
  const spec = SPECS[lead.wakeClass];
  const scale = params.aircraftScale ?? 1.0;
  const b0 = (Math.PI / 4) * spec.span * scale;
  const gamma0 = (spec.mass * scale * 9.81) / (1.225 * spec.speed * b0);

  const spacingSaved = Math.max(0, spec.icaoSep - pair.separationNm);
  const extraLandingsHr = Math.round(spacingSaved * 1.6 * 10) / 10;

  const decayCurve = Array.from({ length: 10 }, (_, i) => {
    const sec = i * 15;
    return { sec, strength: Math.round(gamma0 * Math.exp(-sec / 55)), safeThreshold: 180 };
  });

  return {
    ...pair,
    gamma0: Math.round(gamma0),
    extraLandingsHr,
    co2SavedKgHr: Math.round(extraLandingsHr * 420),
    delayCostSavedUsdHr: Math.round(extraLandingsHr * 1850),
    decayCurve,
  };
}
