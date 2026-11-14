export type AirportCode = 'KSFO' | 'EGLL' | 'VIDP' | 'OMDB' | 'KJFK' | 'RJTT';

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

export interface SimulationParams {
  airport: AirportCode;
  leadCategory: 'SUPER' | 'HEAVY' | 'MEDIUM';
  separationNm: number;
  crosswindKts: number;
  offlineEdgeMode: boolean;
  isPlaying: boolean;
  voiceEnabled: boolean;
  autoWatchdog: boolean;
  showTrafficStream: boolean;
}

export interface WakeTelemetry {
  gamma0: number;
  gammaCurrent: number;
  wakeAgeSec: number;
  lateralDriftM: number;
  verticalSinkM: number;
  riskScore: number;
  status: 'CLEAR' | 'CAUTION' | 'CRITICAL';
  extraLandingsHr: number;
  co2SavedKgHr: number;
  delayCostSavedUsdHr: number;
  decayCurve: { sec: number; strength: number; safeThreshold: number }[];
}

const SPECS = {
  SUPER: { mass: 560000, span: 79.8, speed: 72, icaoSep: 6.0 },
  HEAVY: { mass: 351000, span: 64.8, speed: 74, icaoSep: 5.0 },
  MEDIUM: { mass: 79000, span: 35.8, speed: 70, icaoSep: 3.0 },
};

export function computeLiveWake(
  params: SimulationParams,
  appliedOffset: { lateralM: number; altitudeFt: number } = { lateralM: 0, altitudeFt: 0 }
): WakeTelemetry {
  const spec = SPECS[params.leadCategory];
  const b0 = (Math.PI / 4) * spec.span;
  const gamma0 = (spec.mass * 9.81) / (1.225 * spec.speed * b0);
  const sepMeters = params.separationNm * 1852;
  const wakeAgeSec = sepMeters / spec.speed;
  const gammaCurrent = gamma0 * Math.exp(-wakeAgeSec / 55);

  const lateralDriftM = params.crosswindKts * 0.514444 * wakeAgeSec;
  const sinkRate = gammaCurrent / (2 * Math.PI * b0);
  const verticalSinkM = Math.min(sinkRate * wakeAgeSec * 0.45, 22);

  const effectiveLateralClearance = Math.abs(lateralDriftM + appliedOffset.lateralM);
  const effectiveVerticalClearance = appliedOffset.altitudeFt * 0.3048;
  const totalClearanceM = Math.sqrt(effectiveLateralClearance ** 2 + effectiveVerticalClearance ** 2);

  const centerlineExposure = Math.max(0, 1 - totalClearanceM / 52);
  const strengthRatio = Math.min(1.15, gammaCurrent / 260);
  const riskScore = Math.round(Math.min(99.4, centerlineExposure * strengthRatio * 96) * 10) / 10;

  const spacingSaved = Math.max(0, spec.icaoSep - params.separationNm);
  const extraLandingsHr = Math.round(spacingSaved * 1.6 * 10) / 10;

  const decayCurve = Array.from({ length: 10 }, (_, i) => {
    const sec = i * 15;
    return { sec, strength: Math.round(gamma0 * Math.exp(-sec / 55)), safeThreshold: 180 };
  });

  return {
    gamma0: Math.round(gamma0),
    gammaCurrent: Math.round(gammaCurrent),
    wakeAgeSec: Math.round(wakeAgeSec),
    lateralDriftM: Math.round(lateralDriftM * 10) / 10,
    verticalSinkM: Math.round(verticalSinkM * 10) / 10,
    riskScore,
    status: riskScore > 65 ? 'CRITICAL' : riskScore > 30 ? 'CAUTION' : 'CLEAR',
    extraLandingsHr,
    co2SavedKgHr: Math.round(extraLandingsHr * 420),
    delayCostSavedUsdHr: Math.round(extraLandingsHr * 1850),
    decayCurve,
  };
}
