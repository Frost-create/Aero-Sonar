import React, { useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2, ArrowRightLeft, ArrowUp, ArrowDown, Grid, ListOrdered, PlaneTakeoff, PlaneLanding } from 'lucide-react';
import { AIRPORTS, type AirportCode, type FlightRecord, type PairConflictAnalysis, type WakeTelemetry } from '../physics/wakeEngine';

interface Props {
  airport: AirportCode;
  flights: FlightRecord[];
  matrixAnalyses: PairConflictAnalysis[];
  selectedLeadId: string;
  selectedFollowingId: string;
  crosswindKts: number;
  weather: {
    wdir: number | null;
    wspd: number | null;
    wgst: number | null;
    altim: number | null;
    fltCat: string | null;
  } | null;
  telemetry: WakeTelemetry;
  lightMode: boolean;
  onUpdateArrivalTime: (callsign: string, newMinutes: number) => void;
  onReorderFlight: (index: number, direction: -1 | 1) => void;
  onToggleRunway: (callsign: string) => void;
  onSelectPairFromMatrix: (leadId: string, followingId: string) => void;
  onOptimizeQueue: () => void;
}

export default function TowerWorkstation({
  airport,
  flights,
  matrixAnalyses,
  selectedLeadId,
  selectedFollowingId,
  crosswindKts,
  weather,
  telemetry,
  lightMode,
  onUpdateArrivalTime,
  onReorderFlight,
  onToggleRunway,
  onSelectPairFromMatrix,
  onOptimizeQueue,
}: Props) {
  const [bottomTab, setBottomTab] = useState<'STRIPS' | 'MATRIX'>('STRIPS');
  const spec = AIRPORTS[airport];
  const rwyAlt = spec.runway.endsWith('R') ? spec.runway.replace('R', 'L') : spec.runway.replace('L', 'R');

  const fallbackWindDir = spec.runwayHeading + 45 > 360 ? spec.runwayHeading - 45 : spec.runwayHeading + 45;
  const windDir = weather?.wdir ?? fallbackWindDir;
  const totalWind = weather?.wspd ?? Math.max(4, Math.round(crosswindKts * 1.4));
  const gustText = weather?.wgst == null ? '' : `G${weather.wgst}`;
  const altimeterInHg = weather?.altim == null ? '—' : (weather.altim / 33.8639).toFixed(2);
  const flightCategory = weather?.fltCat ?? (weather ? 'NO REPORT' : 'DEMO');
  const gateHoldActive = telemetry.riskCategory === 'CRITICAL';

  const getPairResult = (f1: string, f2: string) =>
    matrixAnalyses.find(
      (m) => (m.leadId === f1 && m.followingId === f2) || (m.leadId === f2 && m.followingId === f1)
    );

  const flightHasConflict = (callsign: string) =>
    matrixAnalyses.some(
      (m) => (m.leadId === callsign || m.followingId === callsign) && (m.matrixSeverity === 'HIGH' || m.matrixSeverity === 'POTENTIAL')
    );

  return (
    <div className={`border rounded-xl p-3.5 font-mono text-xs flex flex-col gap-3 ${lightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#070b14] border-slate-800 text-slate-100'}`}>
      {/* Top IDS4 Tower Status Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className={`lg:col-span-3 border rounded-lg p-2.5 flex items-center justify-between ${lightMode ? 'bg-slate-100 border-amber-500/60' : 'bg-black border-amber-500/40'}`}>
          <div>
            <span className="text-[10px] text-slate-400 block">METAR</span>
            <span className="text-3xl font-black text-amber-500 leading-none">{weather ? 'LIVE' : 'DEMO'}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block">{spec.code} ATCT-GC</span>
            <span className="text-lg font-extrabold text-amber-400">{altimeterInHg}</span>
            <span className="text-[10px] text-emerald-500 block">{flightCategory}</span>
          </div>
        </div>

        <div className={`lg:col-span-5 border rounded-lg p-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] ${lightMode ? 'bg-slate-100 border-slate-300' : 'bg-black border-slate-800'}`}>
          <div className="flex justify-between">
            <span className="text-amber-400 font-bold">{spec.runway}A:</span>
            <span>{String(windDir).padStart(3, '0')}° {totalWind}{gustText}KT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-400 font-bold">{rwyAlt}A:</span>
            <span>{String(windDir).padStart(3, '0')}° {totalWind}KT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cyan-400 font-bold">01LD:</span>
            <span>{String(windDir).padStart(3, '0')}° {totalWind}KT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cyan-400 font-bold">X-WIND:</span>
            <span className="text-emerald-400 font-bold">{crosswindKts.toFixed(1)} KTS</span>
          </div>
        </div>

        <div className={`lg:col-span-4 border rounded-lg p-2.5 flex flex-col justify-between ${lightMode ? 'bg-slate-100 border-slate-300' : 'bg-black border-slate-800'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">DEPARTURE FLOW GATEWAY</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-black ${
                gateHoldActive
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
              }`}
            >
              {gateHoldActive ? 'GATEHOLD ACTIVE' : 'FLOW RELEASED'}
            </span>
          </div>

          <div className="flex items-center justify-between mt-1.5 gap-2">
            <span className="text-[10px] text-slate-400 truncate">
              Pair: {selectedLeadId} → {selectedFollowingId} ({telemetry.separationNm} NM)
            </span>
            <button
              onClick={onOptimizeQueue}
              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] whitespace-nowrap transition"
            >
              SPACE QUEUE SAFELY
            </button>
          </div>
        </div>
      </div>

      {flights.some((flight) => flight.isEstimated) && (
        <div
          className="rounded border border-amber-500/60 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-300"
          role="status"
        >
          DEMO ENRICHMENT: aircraft type, wake class, operation, runway, ETA, and separation are estimated. Not for operational use.
        </div>
      )}

      {/* Switcher Bar: Arrival Sequence Timeline vs Pairwise Aircraft Conflict Matrix */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setBottomTab('STRIPS')}
            className={`px-3 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 border transition ${
              bottomTab === 'STRIPS'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400'
                : 'border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" /> ARRIVAL SEQUENCE TIMELINE & STRIPS
          </button>
          <button
            onClick={() => setBottomTab('MATRIX')}
            className={`px-3 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 border transition ${
              bottomTab === 'MATRIX'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400'
                : 'border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" /> AIRCRAFT CONFLICT MATRIX
          </button>
        </div>

        <span className="text-[10px] text-slate-400">
          {bottomTab === 'STRIPS'
            ? 'Adjust arrival ETA or queue order to dynamically update 3D spacing & risk'
            : 'Click any pairwise cell to select pair & focus 3D camera'}
        </span>
      </div>

      {bottomTab === 'STRIPS' ? (
        /* Interactive Arrival Sequence Timeline & Flight Progress Strips */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {flights.map((flight, index) => {
            const isSelected = flight.callsign === selectedLeadId || flight.callsign === selectedFollowingId;
            const hasRisk = flightHasConflict(flight.callsign);

            return (
              <div
                key={flight.callsign}
                className={`rounded-lg border p-2.5 transition ${
                  hasRisk
                    ? 'border-red-500/80 bg-red-950/20'
                    : isSelected
                    ? 'border-cyan-400 bg-cyan-950/20'
                    : lightMode
                    ? 'bg-slate-50 border-slate-300'
                    : 'bg-[#0b1524] border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800/70 pb-1 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300">
                      #{index + 1}
                    </span>
                    {flight.opType === 'ARR' ? (
                      <PlaneLanding className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <PlaneTakeoff className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span className="font-black text-xs">{flight.callsign}</span>
                    <span className="text-[10px] text-slate-400">{flight.acType}</span>
                    {flight.isEstimated && (
                      <span
                        className="rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-300"
                        title={`Estimated: ${flight.estimatedFields?.join(', ') || 'flight metadata'}`}
                      >
                        DEMO
                      </span>
                    )}
                  </div>

                  {/* Sequence Reorder Buttons */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => onReorderFlight(index, -1)}
                      disabled={index === 0}
                      className="p-0.5 rounded bg-slate-800 text-slate-300 disabled:opacity-30 hover:text-cyan-300"
                      title="Move earlier in sequence"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onReorderFlight(index, 1)}
                      disabled={index === flights.length - 1}
                      className="p-0.5 rounded bg-slate-800 text-slate-300 disabled:opacity-30 hover:text-cyan-300"
                      title="Move later in sequence"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Runway & Editable Scheduled Arrival Time */}
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <div>
                    <span className="text-slate-400 text-[9px] block">ASSIGNED RWY</span>
                    <button
                      onClick={() => onToggleRunway(flight.callsign)}
                      className="font-bold text-amber-400 hover:underline flex items-center gap-1"
                    >
                      RWY {flight.runway} <ArrowRightLeft className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-400 text-[9px] block">SCHED ARRIVAL (ETA)</span>
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => onUpdateArrivalTime(flight.callsign, Math.max(0.5, Math.round((flight.arrivalMinutes - 0.5) * 10) / 10))}
                        className="px-1.5 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold"
                      >
                        -
                      </button>
                      <span className="font-bold text-emerald-400 min-w-[44px] text-center">
                        +{flight.arrivalMinutes.toFixed(1)}m
                      </span>
                      <button
                        onClick={() => onUpdateArrivalTime(flight.callsign, Math.min(15.0, Math.round((flight.arrivalMinutes + 0.5) * 10) / 10))}
                        className="px-1.5 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/70 text-[10px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {flight.wakeClass} ({flight.speedKts}kt)
                  </span>
                  <span className={`font-bold flex items-center gap-1 ${hasRisk ? 'text-red-400' : 'text-emerald-400'}`}>
                    {hasRisk ? (
                      <>
                        <AlertTriangle className="w-3 h-3" /> CONFLICT RISK
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> SEQUENCED
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Pairwise Aircraft Conflict Matrix */
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-1.5 px-2">AIRCRAFT PAIR</th>
                {flights.map((f) => (
                  <th key={f.callsign} className="py-1.5 px-2 font-bold text-cyan-400">
                    {f.callsign} ({f.wakeClass[0]})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flights.map((rowFlight) => (
                <tr key={rowFlight.callsign} className="border-b border-slate-800/60">
                  <td className="py-1.5 px-2 font-bold text-white">
                    {rowFlight.callsign} <span className="text-[10px] text-slate-400">+{rowFlight.arrivalMinutes.toFixed(1)}m</span>
                  </td>
                  {flights.map((colFlight) => {
                    if (rowFlight.callsign === colFlight.callsign) {
                      return (
                        <td key={colFlight.callsign} className="py-1.5 px-2 text-slate-600">
                          —
                        </td>
                      );
                    }
                    const res = getPairResult(rowFlight.callsign, colFlight.callsign);
                    if (!res) return <td key={colFlight.callsign} />;

                    const colorClasses =
                      res.matrixSeverity === 'HIGH'
                        ? 'bg-red-500/20 border-red-500 text-red-300'
                        : res.matrixSeverity === 'POTENTIAL'
                        ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                        : res.matrixSeverity === 'MONITOR'
                        ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300'
                        : 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300';

                    return (
                      <td key={colFlight.callsign} className="py-1 px-1.5">
                        <button
                          onClick={() => onSelectPairFromMatrix(rowFlight.callsign, colFlight.callsign)}
                          className={`w-full text-left px-2 py-1 rounded border text-[10px] font-bold transition hover:brightness-125 ${colorClasses}`}
                        >
                          <div>{res.conflictLabel}</div>
                          <div className="text-[9px] opacity-80 font-normal">
                            CPA: {res.cpaDistanceNm} NM • Risk: {res.riskScore}%
                          </div>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
