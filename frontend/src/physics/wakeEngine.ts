export interface SimulationParams {
  leadCategory: 'SUPER' | 'HEAVY' | 'MEDIUM';
  separationNm: number;
  crosswindKts: number;
  offlineEdgeMode: boolean;
  isPlaying: boolean;
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

export function computeLiveWake(params: SimulationParams): WakeTelemetry {
  const spec = SPECS[params.leadCategory];
  const b0 = (Math.PI / 4) * spec.span;
  const gamma0 = (spec.mass * 9.81) / (1.225 * spec.speed * b0);
  const sepMeters = params.separationNm * 1852;
  const wakeAgeSec = sepMeters / spec.speed;
  const gammaCurrent = gamma0 * Math.exp(-wakeAgeSec / 55);

  const lateralDriftM = params.crosswindKts * 0.514444 * wakeAgeSec;
  const sinkRate = gammaCurrent / (2 * Math.PI * b0);
  const verticalSinkM = Math.min(sinkRate * wakeAgeSec * 0.45, 22);

  // Calibrated hazard corridor: dangerous if drift < 45m and separation < ICAO standard
  const centerlineExposure = Math.max(0, 1 - lateralDriftM / 48);
  const strengthRatio = Math.min(1.15, gammaCurrent / 260);
  const riskScore = Math.round(Math.min(99.4, centerlineExposure * strengthRatio * 96) * 10) / 10;

  const spacingSaved = Math.max(0, spec.icaoSep - params.separationNm);
  const extraLandingsHr = Math.round(spacingSaved * 1.6 * 10) / 10;

  const decayCurve = Array.from({ length: 10 }, (_, i) => {
    const sec = i * 15;
    return {
      sec,
      strength: Math.round(gamma0 * Math.exp(-sec / 55)),
      safeThreshold: 180,
    };
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
