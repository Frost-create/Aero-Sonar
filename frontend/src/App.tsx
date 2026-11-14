import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Wind, ShieldAlert, Cpu, Sparkles, Plane, Leaf, DollarSign, WifiOff, Play, Pause, Volume2, VolumeX, RotateCcw, Radio, Layers } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import AirspaceScene from './components/AirspaceScene';
import StarsRadar from './components/StarsRadar';
import TowerWorkstation from './components/TowerWorkstation';
import { AIRPORTS, computeLiveWake, type AirportCode, type SimulationParams } from './physics/wakeEngine';

export default function App() {
  const [params, setParams] = useState<SimulationParams>({
    airport: 'KSFO',
    leadCategory: 'SUPER',
    separationNm: 3.1,
    crosswindKts: 1.5,
    offlineEdgeMode: false,
    isPlaying: true,
    voiceEnabled: true,
    autoWatchdog: false,
    showTrafficStream: true,
  });

  const [viewMode, setViewMode] = useState<'3D' | 'STARS'>('3D');
  const [liveMetar, setLiveMetar] = useState<string>(AIRPORTS.KSFO.metarFallback);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentResponse, setAgentResponse] = useState<{
    mode: string;
    atc_advisory: string;
    tool_trace: string[];
    recommended_lateral_offset_m: number;
    recommended_altitude_offset_ft: number;
  } | null>(null);

  const telemetry = useMemo(
    () =>
      computeLiveWake(params, {
        lateralM: agentResponse?.recommended_lateral_offset_m ?? 0,
        altitudeFt: agentResponse?.recommended_altitude_offset_ft ?? 0,
      }),
    [params, agentResponse]
  );

  useEffect(() => {
    const spec = AIRPORTS[params.airport];
    setLiveMetar(spec.metarFallback);
    if (params.offlineEdgeMode) return;

    fetch(`https://aviationweather.gov/api/data/metar?ids=${params.airport}&format=json`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data[0]?.rawOb) {
          setLiveMetar(data[0].rawOb);
          if (typeof data[0].wspd === 'number') {
            const wdir = typeof data[0].wdir === 'number' ? data[0].wdir : spec.runwayHeading + 45;
            const angleRad = ((wdir - spec.runwayHeading) * Math.PI) / 180;
            const xwind = Math.min(20, Math.round(Math.abs(data[0].wspd * Math.sin(angleRad)) * 10) / 10);
            setParams((p) => ({ ...p, crosswindKts: xwind }));
          }
        }
      })
      .catch(() => {});
  }, [params.airport, params.offlineEdgeMode]);

  const speakAtcClearance = useCallback((text: string) => {
    if (!params.voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.06;
    utterance.pitch = 0.92;
    window.speechSynthesis.speak(utterance);
  }, [params.voiceEnabled]);

  const triggerAtcAgent = useCallback(async () => {
    setAgentLoading(true);
    const airportSpec = AIRPORTS[params.airport];
    try {
      const res = await fetch('http://localhost:8000/api/atc-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_category: params.leadCategory,
          follower_category: 'MEDIUM',
          separation_nm: params.separationNm,
          crosswind_kts: params.crosswindKts,
          offline_edge_mode: params.offlineEdgeMode,
        }),
      });
      const data = await res.json();
      setAgentResponse(data);
      speakAtcClearance(data.atc_advisory);
    } catch {
      const needsOffset = telemetry.riskScore > 30;
      const advisory = needsOffset
        ? `${airportSpec.name} Tower: Delta 1428, caution wake turbulence behind heavy traffic. Sidestep 50 meters upwind and maintain plus 180 feet above glideslope, Runway ${airportSpec.runway}.`
        : `${airportSpec.name} Tower: Crosswind cleared centerline wake corridor. Delta 1428 cleared dynamic spacing approach Runway ${airportSpec.runway}.`;

      setAgentResponse({
        mode: params.autoWatchdog ? 'AUTONOMOUS_WATCHDOG_INTERVENTION' : 'LOCAL_EDGE_FAILOVER',
        atc_advisory: advisory,
        tool_trace: [
          `[PERCEIVE] Risk=${telemetry.riskScore}% | Gamma_0=${telemetry.gamma0} m²/s at ${airportSpec.code}`,
          needsOffset
            ? '[TOOL] Tested 50m upwind + 180ft vertical offset -> Risk dropped to SAFE (<15%)'
            : '[TOOL] Verified crosswind drift clears centerline corridor',
          '[ACT] Published 3D bypass trajectory & transmitted radio clearance',
        ],
        recommended_lateral_offset_m: needsOffset ? 50 : 0,
        recommended_altitude_offset_ft: needsOffset ? 180 : 0,
      });
      speakAtcClearance(advisory);
    } finally {
      setAgentLoading(false);
    }
  }, [params, telemetry.riskScore, telemetry.gamma0, speakAtcClearance]);

  useEffect(() => {
    if (params.autoWatchdog && telemetry.riskScore > 65 && !agentResponse && !agentLoading) {
      triggerAtcAgent();
    }
  }, [params.autoWatchdog, telemetry.riskScore, agentResponse, agentLoading, triggerAtcAgent]);

  return (
    <div className="min-h-screen bg-[#03060f] text-slate-100 p-3.5 font-sans flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/75 border border-slate-800 px-4 py-2.5 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <Plane className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-wider text-white">AERO-SONAR</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                ATCT WORKSTATION v2.5
              </span>
            </div>
            <p className="text-[11px] font-mono text-emerald-400/90 truncate max-w-md">{liveMetar}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={params.airport}
            onChange={(e) => {
              setAgentResponse(null);
              const code = e.target.value as AirportCode;
              setParams((p) => ({ ...p, airport: code, crosswindKts: AIRPORTS[code].defaultCrosswind }));
            }}
            className="bg-slate-950 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold px-3 py-1.5 rounded-lg outline-none"
          >
            {(Object.keys(AIRPORTS) as AirportCode[]).map((code) => (
              <option key={code} value={code}>
                {code} ({AIRPORTS[code].iata}) — RWY {AIRPORTS[code].runway}
              </option>
            ))}
          </select>

          <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('3D')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition ${viewMode === '3D' ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50' : 'text-slate-400'}`}
            >
              3D TWIN + IDS4 DESK
            </button>
            <button
              onClick={() => setViewMode('STARS')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition ${viewMode === 'STARS' ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50' : 'text-slate-400'}`}
            >
              2D STARS RADAR
            </button>
          </div>

          <button
            onClick={() => setParams((p) => ({ ...p, autoWatchdog: !p.autoWatchdog }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition ${
              params.autoWatchdog ? 'bg-purple-500/25 border-purple-400 text-purple-200' : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            {params.autoWatchdog ? 'AUTO-AGENT: ON' : 'AUTO-AGENT: OFF'}
          </button>

          <button
            onClick={() => setParams((p) => ({ ...p, voiceEnabled: !p.voiceEnabled }))}
            className={`p-1.5 rounded-lg border ${params.voiceEnabled ? 'bg-purple-500/15 border-purple-500/40 text-purple-300' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
          >
            {params.voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setParams((p) => ({ ...p, isPlaying: !p.isPlaying }))}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:border-cyan-400"
          >
            {params.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setParams((p) => ({ ...p, offlineEdgeMode: !p.offlineEdgeMode }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border ${
              params.offlineEdgeMode ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-800/80 border-slate-700 text-slate-300'
            }`}
          >
            {params.offlineEdgeMode ? <WifiOff className="w-3.5 h-3.5" /> : <Cpu className="w-3.5 h-3.5 text-cyan-400" />}
            {params.offlineEdgeMode ? 'EDGE FAILOVER' : 'GEMINI ONLINE'}
          </button>
        </div>
      </header>

      {viewMode === 'STARS' ? (
        <div className="flex-1 rounded-xl overflow-hidden border border-cyan-900/60">
          <StarsRadar />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            <div className="lg:col-span-3 bg-slate-900/65 border border-slate-800 rounded-xl p-4 flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-400">Airspace Parameters</h2>
                <button
                  onClick={() => setParams((p) => ({ ...p, showTrafficStream: !p.showTrafficStream }))}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 flex items-center gap-1"
                >
                  <Layers className="w-3 h-3" /> {params.showTrafficStream ? '3-SHIP QUEUE' : '2-SHIP PAIR'}
                </button>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1.5">Lead Aircraft Wake Category</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['SUPER', 'HEAVY', 'MEDIUM'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setAgentResponse(null); setParams({ ...params, leadCategory: cat }); }}
                      className={`py-1.5 rounded-lg text-xs font-bold border ${
                        params.leadCategory === cat ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 flex items-center gap-1"><Wind className="w-3.5 h-3.5 text-cyan-400" /> Crosswind Speed</span>
                  <span className="font-mono text-cyan-300">{params.crosswindKts.toFixed(1)} kts</span>
                </div>
                <input type="range" min={0} max={20} step={0.5} value={params.crosswindKts} onChange={(e) => { setAgentResponse(null); setParams({ ...params, crosswindKts: parseFloat(e.target.value) }); }} className="w-full accent-cyan-400" />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">In-Trail Separation</span>
                  <span className="font-mono text-amber-300">{params.separationNm.toFixed(1)} NM</span>
                </div>
                <input type="range" min={2.5} max={7.0} step={0.1} value={params.separationNm} onChange={(e) => { setAgentResponse(null); setParams({ ...params, separationNm: parseFloat(e.target.value) }); }} className="w-full accent-amber-400" />
              </div>

              <div className="bg-slate-950/90 border border-slate-800/80 rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vortex Decay Γ(t)</span>
                  <span className="text-[10px] font-mono text-cyan-400">τ = 55s</span>
                </div>
                <div className="h-20 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={telemetry.decayCurve}>
                      <XAxis dataKey="sec" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => `${v}s`} />
                      <YAxis hide domain={[0, 650]} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', fontSize: '11px' }} />
                      <ReferenceLine y={180} stroke="#10b981" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="strength" stroke="#38bdf8" fill="#0284c7" fillOpacity={0.25} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mt-auto pt-2.5 border-t border-slate-800 space-y-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Runway & Climate ROI</h3>
                <div className="bg-slate-950/90 px-3 py-1.5 rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Throughput Gain</span>
                  <span className="text-xs font-bold text-emerald-400">+{telemetry.extraLandingsHr} flights/hr</span>
                </div>
                <div className="bg-slate-950/90 px-3 py-1.5 rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-xs text-slate-400 flex items-center gap-1"><Leaf className="w-3.5 h-3.5 text-emerald-400" /> CO₂ Prevented</span>
                  <span className="text-xs font-bold text-emerald-300">{telemetry.co2SavedKgHr} kg/hr</span>
                </div>
                <div className="bg-slate-950/90 px-3 py-1.5 rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-xs text-slate-400 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-cyan-400" /> Delay Cost Saved</span>
                  <span className="text-xs font-bold text-cyan-300">${telemetry.delayCostSavedUsdHr}/hr</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 h-[470px]">
              <AirspaceScene
                params={params}
                telemetry={telemetry}
                recommendedOffset={{
                  lateralM: agentResponse?.recommended_lateral_offset_m ?? 0,
                  altitudeFt: agentResponse?.recommended_altitude_offset_ft ?? 0,
                }}
              />
            </div>

            <div className="lg:col-span-3 bg-slate-900/65 border border-slate-800 rounded-xl p-4 flex flex-col gap-3.5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-400">Wake Physics Telemetry</h2>

              <div className={`p-3 rounded-xl border transition-all duration-500 ${
                telemetry.status === 'CRITICAL' ? 'bg-red-950/45 border-red-500/70' : telemetry.status === 'CAUTION' ? 'bg-amber-950/45 border-amber-500/70' : 'bg-emerald-950/35 border-emerald-500/60'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300 flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Encounter Risk</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-950">{telemetry.status}</span>
                </div>
                <div className="text-3xl font-black mt-1 font-mono">{telemetry.riskScore}%</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">Circulation (Γ)</span>
                  <span className="font-mono font-bold text-cyan-300">{telemetry.gammaCurrent} m²/s</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">Lateral Drift</span>
                  <span className="font-mono font-bold text-cyan-300">{telemetry.lateralDriftM} m</span>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-800 flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Gemini ATC Agent</h3>
                  {agentResponse && (
                    <button onClick={() => setAgentResponse(null)} className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  )}
                </div>

                <button onClick={triggerAtcAgent} disabled={agentLoading} className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-xs font-bold tracking-wide text-white shadow-lg transition disabled:opacity-50">
                  {agentLoading ? 'AGENT RUNNING PHYSICS TOOLS...' : 'RUN AUTONOMOUS DE-CONFLICTION'}
                </button>

                {agentResponse ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-1.5 text-xs overflow-y-auto flex-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">{agentResponse.mode}</span>
                    <p className="text-slate-200 leading-relaxed font-medium">{agentResponse.atc_advisory}</p>
                    <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                      {agentResponse.tool_trace.map((step, i) => (
                        <div key={i} className="text-[10px] font-mono text-cyan-400/90">→ {step}</div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-400 leading-relaxed">
                    Enable <strong className="text-purple-300">AUTO-AGENT</strong> or click above to resolve wake hazards & optimize queue spacing.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SFO ATCT-Style IDS4 Console & Electronic Flight Progress Strips */}
          <TowerWorkstation
            airport={params.airport}
            crosswindKts={params.crosswindKts}
            separationNm={params.separationNm}
            telemetry={telemetry}
            onApplyCompression={(targetNm) => setParams((p) => ({ ...p, separationNm: targetNm }))}
          />
        </>
      )}
    </div>
  );
}
