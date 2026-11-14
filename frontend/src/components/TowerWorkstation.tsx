import React, { useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2, ArrowRightLeft, Fuel, PlaneTakeoff, PlaneLanding } from 'lucide-react';
import { AIRPORTS, type AirportCode, type WakeTelemetry } from '../physics/wakeEngine';

interface Props {
  airport: AirportCode;
  crosswindKts: number;
  separationNm: number;
  telemetry: WakeTelemetry;
  onApplyCompression: (targetNm: number) => void;
}

interface FlightStrip {
  callsign: string;
  acType: string;
  wakeClass: 'SUPER' | 'HEAVY' | 'MEDIUM';
  opType: 'ARR' | 'DEP';
  runway: string;
  icaoSepNm: number;
  dynamicSepNm: number;
  delaySavedMin: number;
  gateHold: boolean;
  status: 'SEQUENCED' | 'COMPRESSIBLE' | 'HOLDING';
}

export default function TowerWorkstation({
  airport,
  crosswindKts,
  separationNm,
  telemetry,
  onApplyCompression,
}: Props) {
  const spec = AIRPORTS[airport];
  const rwyAlt = spec.runway.endsWith('R') ? spec.runway.replace('R', 'L') : spec.runway.replace('L', 'R');

  const [compressedApplied, setCompressedApplied] = useState(false);
  const [strips, setStrips] = useState<FlightStrip[]>([
    {
      callsign: 'UAL863',
      acType: 'A388',
      wakeClass: 'SUPER',
      opType: 'ARR',
      runway: spec.runway,
      icaoSepNm: 6.0,
      dynamicSepNm: crosswindKts >= 10 ? 3.5 : 4.5,
      delaySavedMin: crosswindKts >= 10 ? 4.2 : 2.1,
      gateHold: false,
      status: 'SEQUENCED',
    },
    {
      callsign: 'DAL1428',
      acType: 'B738',
      wakeClass: 'MEDIUM',
      opType: 'ARR',
      runway: spec.runway,
      icaoSepNm: 6.0,
      dynamicSepNm: crosswindKts >= 10 ? 3.4 : 4.2,
      delaySavedMin: crosswindKts >= 10 ? 5.8 : 3.0,
      gateHold: false,
      status: 'COMPRESSIBLE',
    },
    {
      callsign: 'ANA108',
      acType: 'B789',
      wakeClass: 'HEAVY',
      opType: 'ARR',
      runway: rwyAlt,
      icaoSepNm: 5.0,
      dynamicSepNm: crosswindKts >= 10 ? 3.2 : 3.9,
      delaySavedMin: crosswindKts >= 10 ? 3.9 : 1.8,
      gateHold: false,
      status: 'COMPRESSIBLE',
    },
    {
      callsign: 'SWA2194',
      acType: 'B38M',
      wakeClass: 'MEDIUM',
      opType: 'DEP',
      runway: '01R',
      icaoSepNm: 3.0,
      dynamicSepNm: 2.5,
      delaySavedMin: 3.4,
      gateHold: telemetry.status === 'CRITICAL',
      status: telemetry.status === 'CRITICAL' ? 'HOLDING' : 'SEQUENCED',
    },
  ]);

  const handleCompressAll = () => {
    const optimalNm = crosswindKts >= 10 ? 3.4 : 4.2;
    setCompressedApplied(true);
    onApplyCompression(optimalNm);
    setStrips((prev) =>
      prev.map((s) => ({
        ...s,
        dynamicSepNm: optimalNm,
        status: 'SEQUENCED',
        gateHold: false,
      }))
    );
  };

  const toggleRunway = (callsign: string) => {
    setStrips((prev) =>
      prev.map((s) =>
        s.callsign === callsign
          ? { ...s, runway: s.runway === spec.runway ? rwyAlt : spec.runway }
          : s
      )
    );
  };

  const windDir = spec.runwayHeading + 45 > 360 ? spec.runwayHeading - 45 : spec.runwayHeading + 45;
  const totalWind = Math.max(4, Math.round(crosswindKts * 1.4));
  const gustWind = totalWind + 6;
  const gateHoldActive = telemetry.status === 'CRITICAL' && !compressedApplied;

  return (
    <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3.5 font-mono text-xs flex flex-col gap-3">
      {/* Top IDS4 Tower Status Strip (Modeled on SFO ATCT Right Monitor) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* ATIS & Altimeter Box */}
        <div className="lg:col-span-3 bg-black border border-amber-500/40 rounded-lg p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block">ATIS INFO</span>
            <span className="text-3xl font-black text-amber-400 leading-none">Z</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block">{spec.code} ATCT-GC</span>
            <span className="text-lg font-extrabold text-amber-300">30.11</span>
            <span className="text-[10px] text-emerald-400 block">CAT I / VMC</span>
          </div>
        </div>

        {/* Per-Runway Threshold Wind Readouts */}
        <div className="lg:col-span-5 bg-black border border-slate-800 rounded-lg p-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-amber-300 font-bold">{spec.runway}A:</span>
            <span className="text-white">{String(windDir).padStart(3, '0')}° {totalWind}G{gustWind}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-300 font-bold">{rwyAlt}A:</span>
            <span className="text-white">{String(windDir).padStart(3, '0')}° {totalWind}KT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cyan-300 font-bold">01LD:</span>
            <span className="text-slate-300">{String(windDir).padStart(3, '0')}° {Math.max(3, totalWind - 4)}KT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cyan-300 font-bold">X-WIND:</span>
            <span className="text-emerald-400 font-bold">{crosswindKts.toFixed(1)} KTS</span>
          </div>
        </div>

        {/* Smart Gate-Hold & Flow Optimization Banner */}
        <div className="lg:col-span-4 bg-black border border-slate-800 rounded-lg p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">DEPARTURE FLOW GATEWAY</span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-black tracking-wider ${
                gateHoldActive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
              }`}
            >
              {gateHoldActive ? 'GATEHOLD ACTIVE' : 'FLOW RELEASED'}
            </span>
          </div>

          <div className="flex items-center justify-between mt-1.5 gap-2">
            <span className="text-[10px] text-slate-300">
              {gateHoldActive
                ? 'Hold DEP 01R 45s for wake decay (saves 180kg Jet-A)'
                : `Dynamic spacing active (${separationNm.toFixed(1)} NM)`}
            </span>
            <button
              onClick={handleCompressAll}
              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] whitespace-nowrap transition"
            >
              {compressedApplied ? '✓ FLOW OPTIMIZED' : 'OPTIMIZE QUEUE'}
            </button>
          </div>
        </div>
      </div>

      {/* Electronic Flight Progress Strips (Modeled on Tower Desk Paper Strips) */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 px-1">
          <span className="font-bold uppercase tracking-wider text-cyan-400">
            Electronic Flight Progress Strips — Active Runway Queue
          </span>
          <span className="text-emerald-400">
            Total Queue Delay Reduction: -15.4 MINS | Fuel Saved: 640 KG
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          {strips.map((strip) => (
            <div
              key={strip.callsign}
              className={`rounded-lg border p-2.5 transition ${
                strip.opType === 'ARR'
                  ? 'bg-[#0b1524] border-cyan-900/70'
                  : 'bg-[#171309] border-amber-900/70'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  {strip.opType === 'ARR' ? (
                    <PlaneLanding className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <PlaneTakeoff className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span className="font-black text-white text-xs">{strip.callsign}</span>
                  <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-300">{strip.acType}</span>
                </div>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    strip.wakeClass === 'SUPER'
                      ? 'bg-red-500/20 text-red-300'
                      : strip.wakeClass === 'HEAVY'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-cyan-500/20 text-cyan-300'
                  }`}
                >
                  {strip.wakeClass}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <div>
                  <span className="text-slate-400 text-[9px] block">ASSIGNED RWY</span>
                  <button
                    onClick={() => toggleRunway(strip.callsign)}
                    className="font-bold text-amber-300 hover:underline flex items-center gap-1"
                    title="Click to reassign parallel runway"
                  >
                    RWY {strip.runway} <ArrowRightLeft className="w-2.5 h-2.5" />
                  </button>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[9px] block">WAKE SPACING</span>
                  <span className="text-slate-500 line-through mr-1">{strip.icaoSepNm.toFixed(1)}</span>
                  <span className="text-emerald-400 font-bold">{strip.dynamicSepNm.toFixed(1)} NM</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
                <span className="text-emerald-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> -{strip.delaySavedMin}m delay
                </span>
                <span
                  className={`font-bold flex items-center gap-1 ${
                    strip.status === 'HOLDING'
                      ? 'text-amber-400'
                      : strip.status === 'SEQUENCED'
                      ? 'text-emerald-400'
                      : 'text-cyan-300'
                  }`}
                >
                  {strip.status === 'HOLDING' ? (
                    <>
                      <AlertTriangle className="w-3 h-3" /> GATEHOLD
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> {strip.status}
                    </>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Active NOTAMs & Outages Bar (Modeled on Bottom-Right IDS4 Box) */}
      <div className="bg-red-950/25 border border-red-900/50 rounded-lg px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px]">
        <div className="flex items-center gap-2 text-red-300">
          <span className="font-bold bg-red-500/20 px-1.5 py-0.5 rounded">OUTAGES / NOTAMS</span>
          <span>TWY J CLSD BTN {spec.runway} & {rwyAlt} • WAKE RECAT-EU DYNAMIC SEPARATION AUTHORIZED</span>
        </div>
        <span className="text-slate-400 flex items-center gap-1">
          <Fuel className="w-3 h-3 text-emerald-400" /> IDLE TARMAC BURN PREVENTED: $2,840/HR
        </span>
      </div>
    </div>
  );
}
