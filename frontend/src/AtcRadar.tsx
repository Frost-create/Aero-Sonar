import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio,
  RotateCcw,
  Search,
  RefreshCw,
  Compass,
  ArrowUpDown,
  Gauge,
  Navigation,
  X,
  Activity,
  Plane
} from 'lucide-react';

// ============================================================================
// KSFO REFERENCE & GEODETIC PROJECTION (1 NM = 1.852 km)
// Origin (0, 0) = KSFO (37.6213° N, 122.3790° W)
// ============================================================================

const KSFO_LAT = 37.6213;
const KSFO_LON = -122.3790;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const NM_PER_DEG_LAT = 60.0;
const NM_PER_DEG_LON = 60.0 * Math.cos(KSFO_LAT * DEG2RAD);

// Convert WGS84 (lat, lon) to local Nautical Miles (x = East, y = South) relative to KSFO
function latLonToNM(lat, lon) {
  const x = (lon - KSFO_LON) * NM_PER_DEG_LON;
  const y = -(lat - KSFO_LAT) * NM_PER_DEG_LAT;
  return { x, y };
}

function normHdg(h) {
  const res = ((h % 360) + 360) % 360;
  return res === 0 ? 360 : res;
}

function bearingFromSFO(x, y) {
  return normHdg(Math.atan2(x, -y) * RAD2DEG);
}

// Heavy / Super aircraft ICAO types for wake turbulence tag ('H')
const HEAVY_TYPES = new Set([
  'B744', 'B748', 'B762', 'B763', 'B764', 'B772', 'B77L', 'B77W', 'B779',
  'B788', 'B789', 'B78X', 'A332', 'A333', 'A339', 'A343', 'A346', 'A359',
  'A35K', 'A388', 'MD11', 'DC10', 'C17', 'C5M', 'B52', 'K35R', 'KC10', 'KC46'
]);

// ============================================================================
// HIGH-DETAIL SAN FRANCISCO BAY AREA VECTOR MAP (WGS84 COORDINATES)
// ============================================================================

const BAY_LAND_POLYGONS_GEO = [
  // San Francisco Peninsula, South Bay & East Bay Shoreline
  [
    [38.15, -122.95], [37.98, -122.78], [37.86, -122.62],
    [37.783, -122.513], // Lands End / Cliff House
    [37.808, -122.476], // Fort Point / Golden Gate South
    [37.806, -122.435], // Marina / Crissy Field
    [37.808, -122.405], // Fisherman's Wharf / Pier 39
    [37.795, -122.392], // Ferry Building / Bay Bridge West
    [37.752, -122.382], // Potrero / Pier 80
    [37.728, -122.365], // Hunters Point
    [37.711, -122.384], // Candlestick / Brisbane
    [37.664, -122.382], // South San Francisco / Oyster Point
    [37.634, -122.374], // KSFO North Seawall
    [37.614, -122.357], // KSFO East Thresholds (28R/28L)
    [37.592, -122.352], // Millbrae / Burlingame
    [37.571, -122.285], // Coyote Point / San Mateo Bridge West
    [37.535, -122.245], // Belmont / Redwood Shores
    [37.498, -122.185], // Menlo Park / Dumbarton West
    [37.458, -122.115], // Palo Alto / East Palo Alto
    [37.428, -122.055], // Moffett Field (NUQ) / Mountain View
    [37.425, -121.985], // Alviso / South Bay Tip
    [37.455, -122.025], // Fremont / Coyote Creek
    [37.515, -122.095], // Dumbarton East / Newark
    [37.585, -122.145], // San Mateo Bridge East / Hayward Shoreline
    [37.655, -122.165], // San Leandro Bay
    [37.705, -122.225], // Oakland Airport (KOAK) South Dike
    [37.728, -122.248], // KOAK West Shoreline
    [37.768, -122.285], // Alameda Island West
    [37.798, -122.315], // Oakland Outer Harbor / Bay Bridge East
    [37.845, -122.305], // Emeryville / Berkeley Marina
    [37.905, -122.355], // Richmond Inner Harbor
    [37.925, -122.418], // Point Richmond / San Rafael Bridge East
    [37.995, -122.355], // Point Pinole / San Pablo Bay East
    [38.055, -122.255], // Rodeo / Crockett / Carquinez Strait
    [38.068, -122.125], // Benicia / Martinez
    [38.085, -121.920], // Suisun Bay / Pittsburg
    [38.350, -121.400], // NE Boundary
    [36.750, -121.400], // SE Boundary
    [36.750, -122.450], // South Coast / Santa Cruz
    [37.110, -122.340], // Pigeon Point
    [37.260, -122.415], // Pescadero / San Gregorio
    [37.463, -122.448], // Pillar Point / Half Moon Bay
    [37.585, -122.515], // Montara / Devil's Slide
    [37.655, -122.495], // Pacifica
    [37.735, -122.508], // Ocean Beach
    [37.783, -122.513],
  ],
  // Marin Headlands & North Bay Peninsula
  [
    [37.818, -122.528], // Point Bonita / Marin Headlands
    [37.832, -122.478], // Horseshoe Bay / Golden Gate North
    [37.858, -122.478], // Sausalito
    [37.872, -122.452], // Tiburon Peninsula
    [37.928, -122.485], // Corte Madera / Larkspur
    [37.965, -122.482], // Point San Pedro / San Rafael
    [38.045, -122.495], // Novato / Hamilton Field
    [38.115, -122.445], // Petaluma River Mouth
    [38.118, -122.275], // Vallejo / Mare Island
    [38.075, -122.235], // Carquinez North
    [38.350, -122.150],
    [38.350, -122.950],
    [37.995, -122.745], // Bolinas Lagoon
    [37.895, -122.635], // Muir Beach / Tennessee Valley
    [37.818, -122.528],
  ],
  // Treasure Island / Yerba Buena
  [
    [37.812, -122.374], [37.831, -122.376], [37.830, -122.364], [37.811, -122.362]
  ],
  // Angel Island
  [
    [37.856, -122.442], [37.869, -122.440], [37.868, -122.423], [37.855, -122.426]
  ],
  // Farallon Islands (Southeast Farallon)
  [
    [37.696, -123.008], [37.702, -123.004], [37.699, -122.996], [37.694, -123.001]
  ]
];

// Bay Bridges (WGS84 endpoints)
const BAY_BRIDGES_GEO = [
  { name: 'GOLDEN GATE', p1: [37.808, -122.478], p2: [37.832, -122.479] },
  { name: 'BAY BRIDGE',  p1: [37.788, -122.388], p2: [37.822, -122.322] },
  { name: 'SAN MATEO',   p1: [37.573, -122.282], p2: [37.603, -122.152] },
  { name: 'DUMBARTON',   p1: [37.498, -122.132], p2: [37.512, -122.104] },
  { name: 'RICHMOND',    p1: [37.943, -122.478], p2: [37.928, -122.418] },
];

// Bay Area Airports with True Runway Geometry
const BAY_AIRPORTS = [
  {
    icao: 'SFO',
    lat: 37.6213,
    lon: -122.3790,
    major: true,
    runways: [
      [[37.6285, -122.3932], [37.6135, -122.3575]], // 28R / 10L
      [[37.6263, -122.3939], [37.6115, -122.3585]], // 28L / 10R
      [[37.6118, -122.3832], [37.6295, -122.3712]], // 01L / 19R
      [[37.6110, -122.3806], [37.6315, -122.3668]], // 01R / 19L
    ]
  },
  {
    icao: 'OAK',
    lat: 37.7214,
    lon: -122.2208,
    major: true,
    runways: [
      [[37.7315, -122.2445], [37.7115, -122.2125]], // 30 / 12
      [[37.7345, -122.2285], [37.7275, -122.2085]], // 28R / 10L
      [[37.7322, -122.2295], [37.7258, -122.2115]], // 28L / 10R
    ]
  },
  {
    icao: 'SJC',
    lat: 37.3626,
    lon: -121.9290,
    major: true,
    runways: [
      [[37.3735, -121.9395], [37.3505, -121.9165]], // 30L / 12R
      [[37.3752, -121.9372], [37.3522, -121.9142]], // 30R / 12L
    ]
  },
  {
    icao: 'NUQ',
    lat: 37.4161,
    lon: -122.0491,
    major: false,
    runways: [
      [[37.4275, -122.0555], [37.4045, -122.0425]], // 32R / 14L
    ]
  },
  {
    icao: 'SQL',
    lat: 37.5119,
    lon: -122.2495,
    major: false,
    runways: [
      [[37.5155, -122.2535], [37.5082, -122.2455]], // 30 / 12
    ]
  },
  {
    icao: 'HWD',
    lat: 37.6589,
    lon: -122.1217,
    major: false,
    runways: [
      [[37.6645, -122.1285], [37.6535, -122.1155]], // 28L / 10R
    ]
  },
  {
    icao: 'PAO',
    lat: 37.4611,
    lon: -122.1150,
    major: false,
    runways: [
      [[37.4642, -122.1185], [37.4580, -122.1115]], // 31 / 13
    ]
  },
  {
    icao: 'CCR',
    lat: 37.9897,
    lon: -122.0569,
    major: false,
    runways: [
      [[37.9965, -122.0595], [37.9825, -122.0545]], // 01L / 19R
    ]
  }
];

// NorCal TRACON (NCT) Navigation Fixes
const NCT_FIXES = [
  { id: 'BDEGA', lat: 38.125, lon: -122.920 },
  { id: 'SERFR', lat: 37.185, lon: -122.480 },
  { id: 'DYAMD', lat: 37.695, lon: -121.745 },
  { id: 'SUNOL', lat: 37.588, lon: -121.885 },
  { id: 'CEDES', lat: 37.518, lon: -122.110 },
  { id: 'BOLDR', lat: 37.335, lon: -122.165 },
  { id: 'ARCHI', lat: 37.568, lon: -122.238 },
  { id: 'MENLO', lat: 37.482, lon: -122.162 },
  { id: 'PORTE', lat: 37.392, lon: -122.285 },
  { id: 'SAHEY', lat: 37.815, lon: -122.645 },
];

// ============================================================================
// REALISTIC KSFO SCHEDULE FALLBACK (ONLY USED IF SANDBOX BLOCKS ALL APIS)
// ============================================================================

function createFallbackKSFOTraffic() {
  const seed = [
    { hex: 'a0b142', callsign: 'UAL142',  type: 'B77W', lat: 37.582, lon: -122.275, alt: 1750,  gs: 146, track: 298, vs: -750,  squawk: '4211' },
    { hex: 'a4c408', callsign: 'DAL408',  type: 'A321', lat: 37.542, lon: -122.192, alt: 3100,  gs: 164, track: 298, vs: -820,  squawk: '3314' },
    { hex: '86d108', callsign: 'ANA108',  type: 'B789', lat: 37.498, lon: -122.105, alt: 4500,  gs: 178, track: 298, vs: -900,  squawk: '5104' },
    { hex: 'a14182', callsign: 'AAL182',  type: 'B738', lat: 37.452, lon: -122.012, alt: 6100,  gs: 192, track: 298, vs: -950,  squawk: '2145' },
    { hex: '407285', callsign: 'BAW285',  type: 'A359', lat: 37.515, lon: -121.880, alt: 7800,  gs: 215, track: 252, vs: -1100, squawk: '6231' },
    { hex: 'a2d219', callsign: 'SWA2319', type: 'B738', lat: 37.365, lon: -122.185, alt: 6800,  gs: 210, track: 350, vs: -1050, squawk: '1422' },
    { hex: '780872', callsign: 'CPA872',  type: 'B77W', lat: 37.910, lon: -122.740, alt: 11500, gs: 255, track: 132, vs: -1400, squawk: '5412' },
    { hex: 'a66516', callsign: 'JBU516',  type: 'A321', lat: 37.685, lon: -121.795, alt: 10200, gs: 245, track: 258, vs: -1300, squawk: '4610' },
    { hex: 'a12885', callsign: 'UAL885',  type: 'B77W', lat: 37.712, lon: -122.425, alt: 3800,  gs: 225, track: 342, vs: 2400,  squawk: '7102' },
    { hex: 'a3b342', callsign: 'ASA342',  type: 'B739', lat: 37.845, lon: -122.545, alt: 8400,  gs: 270, track: 315, vs: 2200,  squawk: '7215' },
    { hex: 'a75412', callsign: 'SKW5412', type: 'E75L', lat: 37.565, lon: -122.585, alt: 5400,  gs: 235, track: 232, vs: 1850,  squawk: '7340' },
    { hex: 'ac2882', callsign: 'FDX882',  type: 'B763', lat: 37.648, lon: -122.065, alt: 3300,  gs: 168, track: 300, vs: -850,  squawk: '4512' },
    { hex: 'a18110', callsign: 'SWA1108', type: 'B738', lat: 37.795, lon: -122.345, alt: 4900,  gs: 240, track: 296, vs: 2100,  squawk: '3120' },
    { hex: 'a3f612', callsign: 'ASA612',  type: 'B738', lat: 37.255, lon: -121.815, alt: 3900,  gs: 174, track: 312, vs: -880,  squawk: '2615' },
    { hex: '896225', callsign: 'UAE225',  type: 'A388', lat: 38.080, lon: -122.680, alt: 31000, gs: 472, track: 152, vs: 0,     squawk: '6510' },
    { hex: 'a91910', callsign: 'DAL98',   type: 'B764', lat: 37.460, lon: -122.880, alt: 34000, gs: 485, track: 74,  vs: 0,     squawk: '6702' },
  ];

  return seed.map(s => {
    const pos = latLonToNM(s.lat, s.lon);
    return {
      ...s,
      id: s.hex,
      x: pos.x,
      y: pos.y,
      targetX: pos.x,
      targetY: pos.y,
      targetAlt: s.alt,
      isHeavy: HEAVY_TYPES.has(s.type),
      history: [],
      lastSeen: performance.now(),
      isFallback: true
    };
  });
}

// Determine operational flight phase relative to KSFO
function getFlightPhase(ac) {
  const distSFO = Math.hypot(ac.x, ac.y);
  if (ac.alt <= 120 && ac.gs < 45) return 'GND / TAXI';
  if (distSFO < 14 && ac.alt < 5500 && ac.vs < -250 && ac.track >= 275 && ac.track <= 320) {
    return 'SFO FINAL 28R/L';
  }
  if (distSFO < 18 && ac.alt < 9000 && ac.vs > 600) {
    return 'SFO DEPARTURE';
  }
  if (ac.alt >= 18000) return `HIGH ENROUTE FL${Math.round(ac.alt / 100)}`;
  if (ac.vs < -300) return 'TRACON DESCENT';
  if (ac.vs > 300) return 'TRACON CLIMB';
  return 'TRACON LEVEL';
}

export default function App() {
  const canvasRef = useRef(null);
  const aircraftMapRef = useRef(new Map());
  // Camera centered at KSFO (0, 0) at 14.5 px/NM (shows ~60-80 NM across screen)
  const cameraRef = useRef({ x: 0, y: 0, zoom: 14.5 });
  const dragRef = useRef({ active: false, startX: 0, startY: 0, camX: 0, camY: 0, moved: false });
  const isFetchingRef = useRef(false);

  // STARS Display Control Bar (DCB) States
  const [selectedHex, setSelectedHex] = useState(null);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [ptlMinutes, setPtlMinutes] = useState(2); // Predicted Track Line: 1, 2, 4 min
  const [altFilter, setAltFilter] = useState('ALL'); // 'ALL' | 'LOW' | 'APP' | 'HIGH'
  const [showTrails, setShowTrails] = useState(true);
  const [showRangeRings, setShowRangeRings] = useState(true); // Toggleable range rings centered on KSFO
  const [searchQuery, setSearchQuery] = useState('');

  // Live ADS-B Feed Status Telemetry
  const [feedSource, setFeedSource] = useState('CONNECTING...');
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [lastPollTime, setLastPollTime] = useState('--:--:--Z');
  const [isPolling, setIsPolling] = useState(false);
  const [zuluClock, setZuluClock] = useState('');

  // Normalize ADS-B JSON records from adsb.lol / airplanes.live / OpenSky
  const ingestAdsbRecords = useCallback((records, sourceLabel) => {
    const now = performance.now();
    const seenHexes = new Set();

    records.forEach(raw => {
      if (!raw.hex || typeof raw.lat !== 'number' || typeof raw.lon !== 'number') return;

      const hex = String(raw.hex).toLowerCase().trim();
      const rawFlight = (raw.flight || raw.r || hex.toUpperCase()).trim();
      const callsign = rawFlight || hex.toUpperCase();
      const alt = raw.alt_baro === 'ground' ? 0 : Number(raw.alt_baro ?? raw.alt_geom ?? 0);
      const gs = Number(raw.gs ?? 0);
      const track = normHdg(Number(raw.track ?? raw.true_heading ?? 0));
      const vs = Number(raw.baro_rate ?? raw.geom_rate ?? 0);
      const acType = (raw.t || 'UNKN').toUpperCase().trim();
      const squawk = String(raw.squawk || '1200').trim();
      const isHeavy = HEAVY_TYPES.has(acType) || raw.category === 'A5';

      const pos = latLonToNM(raw.lat, raw.lon);
      // Filter out targets beyond 65 NM from KSFO
      if (Math.hypot(pos.x, pos.y) > 65) return;

      seenHexes.add(hex);
      const existing = aircraftMapRef.current.get(hex);

      if (existing) {
        // Record previous true radar hit into 5-dot decaying phosphor trail
        const movedNM = Math.hypot(pos.x - existing.targetX, pos.y - existing.targetY);
        if (movedNM > 0.04) {
          existing.history.unshift({ x: existing.targetX, y: existing.targetY });
          if (existing.history.length > 5) existing.history.pop();
        }

        existing.callsign = callsign;
        existing.type = acType;
        existing.isHeavy = isHeavy;
        existing.squawk = squawk;
        existing.lat = raw.lat;
        existing.lon = raw.lon;
        existing.targetX = pos.x;
        existing.targetY = pos.y;
        existing.targetAlt = alt;
        existing.gs = gs;
        existing.track = track;
        existing.vs = vs;
        existing.lastSeen = now;
        existing.isFallback = false;
      } else {
        aircraftMapRef.current.set(hex, {
          id: hex,
          hex,
          callsign,
          type: acType,
          isHeavy,
          squawk,
          lat: raw.lat,
          lon: raw.lon,
          x: pos.x,
          y: pos.y,
          targetX: pos.x,
          targetY: pos.y,
          alt,
          targetAlt: alt,
          gs,
          track,
          vs,
          history: [],
          lastSeen: now,
          isFallback: false
        });
      }
    });

    // Purge stale tracks not seen in > 25 seconds
    for (const [hex, ac] of aircraftMapRef.current.entries()) {
      if (!seenHexes.has(hex) && now - ac.lastSeen > 25000) {
        aircraftMapRef.current.delete(hex);
      }
    }

    const utcNow = new Date();
    const hh = String(utcNow.getUTCHours()).padStart(2, '0');
    const mm = String(utcNow.getUTCMinutes()).padStart(2, '0');
    const ss = String(utcNow.getUTCSeconds()).padStart(2, '0');

    setFeedSource(sourceLabel);
    setIsFallbackMode(false);
    setLiveCount(aircraftMapRef.current.size);
    setLastPollTime(`${hh}:${mm}:${ss}Z`);
  }, []);

  // Multi-endpoint Live ADS-B Poller (adsb.lol -> airplanes.live -> OpenSky -> Fallback)
  const pollLiveADSB = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsPolling(true);

    const fetchWithTimeout = async (url, ms = 4500) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      try {
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        clearTimeout(timer);
        throw err;
      }
    };

    try {
      // 1. Primary: api.adsb.lol (60 NM around KSFO)
      const data1 = await fetchWithTimeout(
        `https://api.adsb.lol/v2/lat/${KSFO_LAT}/lon/${KSFO_LON}/dist/60`
      );
      if (data1 && Array.isArray(data1.ac) && data1.ac.length > 0) {
        ingestAdsbRecords(data1.ac, 'ADSB.LOL LIVE');
        isFetchingRef.current = false;
        setIsPolling(false);
        return;
      }
      throw new Error('Empty adsb.lol response');
    } catch (_) {
      try {
        // 2. Fallback 1: api.airplanes.live
        const data2 = await fetchWithTimeout(
          `https://api.airplanes.live/v2/point/${KSFO_LAT}/${KSFO_LON}/60`
        );
        if (data2 && Array.isArray(data2.ac) && data2.ac.length > 0) {
          ingestAdsbRecords(data2.ac, 'AIRPLANES.LIVE');
          isFetchingRef.current = false;
          setIsPolling(false);
          return;
        }
        throw new Error('Empty airplanes.live response');
      } catch (__) {
        try {
          // 3. Fallback 2: OpenSky Network State Vectors (Bay Area bounding box)
          const data3 = await fetchWithTimeout(
            'https://opensky-network.org/api/states/all?lamin=36.8&lomin=-123.3&lamax=38.4&lomax=-121.4'
          );
          if (data3 && Array.isArray(data3.states) && data3.states.length > 0) {
            const mappedOpenSky = data3.states
              .filter(s => typeof s[6] === 'number' && typeof s[5] === 'number')
              .map(s => ({
                hex: s[0],
                flight: (s[1] || s[0]).trim(),
                lon: s[5],
                lat: s[6],
                alt_baro: s[8] ? 'ground' : Math.round((s[7] ?? s[13] ?? 0) * 3.28084),
                gs: Math.round((s[9] ?? 0) * 1.94384),
                track: s[10] ?? 0,
                baro_rate: Math.round((s[11] ?? 0) * 196.85),
                squawk: s[14] || '1200',
                t: 'LIVE'
              }));
            ingestAdsbRecords(mappedOpenSky, 'OPENSKY LIVE');
            isFetchingRef.current = false;
            setIsPolling(false);
            return;
          }
          throw new Error('Empty OpenSky states');
        } catch (___) {
          // 4. Network/CORS Sandbox Fallback: Realistic KSFO Schedule Traffic
          if (aircraftMapRef.current.size === 0 || !isFallbackMode) {
            const fallbackList = createFallbackKSFOTraffic();
            aircraftMapRef.current.clear();
            fallbackList.forEach(f => aircraftMapRef.current.set(f.hex, f));
          }
          const utcNow = new Date();
          const hh = String(utcNow.getUTCHours()).padStart(2, '0');
          const mm = String(utcNow.getUTCMinutes()).padStart(2, '0');
          const ss = String(utcNow.getUTCSeconds()).padStart(2, '0');

          setFeedSource('SIM FALLBACK (API BLOCKED)');
          setIsFallbackMode(true);
          setLiveCount(aircraftMapRef.current.size);
          setLastPollTime(`${hh}:${mm}:${ss}Z`);
        }
      }
    } finally {
      isFetchingRef.current = false;
      setIsPolling(false);
    }
  }, [ingestAdsbRecords, isFallbackMode]);

  // Initial ADS-B Poll + 5-Second Live Refresh Loop
  useEffect(() => {
    pollLiveADSB();
    const pollInterval = setInterval(pollLiveADSB, 5000);
    return () => clearInterval(pollInterval);
  }, [pollLiveADSB]);

  // 4Hz UTC Zulu Clock & Selected Flight Drawer Sync
  useEffect(() => {
    const syncTelemetry = () => {
      const now = new Date();
      const hh = String(now.getUTCHours()).padStart(2, '0');
      const mm = String(now.getUTCMinutes()).padStart(2, '0');
      const ss = String(now.getUTCSeconds()).padStart(2, '0');
      setZuluClock(`${hh}${mm}/${ss}Z`);

      if (selectedHex) {
        const ac = aircraftMapRef.current.get(selectedHex);
        setSelectedAircraft(ac ? { ...ac } : null);
      }
    };
    syncTelemetry();
    const timer = setInterval(syncTelemetry, 250);
    return () => clearInterval(timer);
  }, [selectedHex]);

  // 60 FPS Dead-Reckoning Physics Interpolation & Phosphor-Green CRT Rendering
  useEffect(() => {
    let animId;
    let lastFrameTime = performance.now();
    let fallbackTrailAccum = 0;

    // Pre-project static Bay Area geography into NM coordinates once
    const bayPolygonsNM = BAY_LAND_POLYGONS_GEO.map(poly =>
      poly.map(([lat, lon]) => latLonToNM(lat, lon))
    );
    const bayBridgesNM = BAY_BRIDGES_GEO.map(br => ({
      p1: latLonToNM(br.p1[0], br.p1[1]),
      p2: latLonToNM(br.p2[0], br.p2[1])
    }));
    const airportsNM = BAY_AIRPORTS.map(apt => ({
      ...apt,
      pos: latLonToNM(apt.lat, apt.lon),
      rwysNM: apt.runways.map(([a, b]) => [latLonToNM(a[0], a[1]), latLonToNM(b[0], b[1])])
    }));
    const fixesNM = NCT_FIXES.map(f => ({
      id: f.id,
      pos: latLonToNM(f.lat, f.lon)
    }));

    const stepPhysics = (dt) => {
      fallbackTrailAccum += dt;
      const recordFallbackTrail = fallbackTrailAccum >= 4.0;
      if (recordFallbackTrail) fallbackTrailAccum = 0;

      for (const ac of aircraftMapRef.current.values()) {
        // 1. Dead-reckoning velocity vector integration (1 knot = 1 NM / 3600 sec)
        const stepNM = (ac.gs / 3600) * dt;
        const rad = ac.track * DEG2RAD;
        const vx = Math.sin(rad) * stepNM;
        const vy = -Math.cos(rad) * stepNM;

        ac.x += vx;
        ac.y += vy;
        ac.targetX += vx;
        ac.targetY += vy;

        // 2. Smooth reconciliation blend toward live ADS-B target coordinates
        // Prevents sudden 5-second jumps while eliminating drift
        const blend = Math.min(1, dt * 3.0);
        ac.x += (ac.targetX - ac.x) * blend;
        ac.y += (ac.targetY - ac.y) * blend;

        // 3. Smooth vertical altitude interpolation using live baro_rate (ft/min)
        const vertStepFt = (ac.vs / 60) * dt;
        ac.alt = Math.max(0, ac.alt + vertStepFt);
        ac.targetAlt = Math.max(0, ac.targetAlt + vertStepFt);
        ac.alt += (ac.targetAlt - ac.alt) * blend;

        // If running in fallback simulation mode, recycle approaches/departures seamlessly
        if (ac.isFallback) {
          if (recordFallbackTrail) {
            ac.history.unshift({ x: ac.x, y: ac.y });
            if (ac.history.length > 5) ac.history.pop();
          }
          if (ac.vs < 0 && ac.alt < 200) {
            // Reset arrival back onto 18 NM final
            const resetPos = latLonToNM(37.452, -122.012);
            ac.x = resetPos.x;
            ac.y = resetPos.y;
            ac.targetX = resetPos.x;
            ac.targetY = resetPos.y;
            ac.alt = 6100;
            ac.targetAlt = 6100;
            ac.history = [];
          } else if (Math.hypot(ac.x, ac.y) > 55) {
            // Wrap departing/enroute flights around TRACON boundary
            ac.x = -ac.x * 0.85;
            ac.y = -ac.y * 0.85;
            ac.targetX = ac.x;
            ac.targetY = ac.y;
            ac.history = [];
          }
        }
      }
    };

    const renderScope = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const W = rect.width;
      const H = rect.height;
      const cam = cameraRef.current;

      const toScreen = (wx, wy) => ({
        x: W / 2 + (wx - cam.x) * cam.zoom,
        y: H / 2 + (wy - cam.y) * cam.zoom
      });

      // 1. PURE FAA STARS CRT PHOSPHOR BACKGROUND
      ctx.fillStyle = '#020804';
      ctx.fillRect(0, 0, W, H);

      // Subtle CRT phosphor scanline texture
      ctx.fillStyle = 'rgba(36, 240, 107, 0.016)';
      for (let y = 0; y < H; y += 3) {
        ctx.fillRect(0, y, W, 1);
      }

      // 1.5 TOGGLEABLE RANGE RINGS & AZIMUTH SPOKES CENTERED ON KSFO (0,0)
      if (showRangeRings) {
        const sfoScreen = toScreen(0, 0);
        const ringDistancesNM = [10, 20, 30, 40];

        ctx.save();
        ctx.strokeStyle = 'rgba(20, 102, 48, 0.45)';
        ctx.fillStyle = 'rgba(20, 102, 48, 0.65)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([4, 4]);

        ringDistancesNM.forEach(distNM => {
          const radiusPx = distNM * cam.zoom;
          ctx.beginPath();
          ctx.arc(sfoScreen.x, sfoScreen.y, radiusPx, 0, Math.PI * 2);
          ctx.stroke();

          // Distance label on the top of each ring
          ctx.font = '9px ui-monospace, monospace';
          ctx.fillText(`${distNM} NM`, sfoScreen.x + 4, sfoScreen.y - radiusPx + 11);
        });

        // Center crosshair and 8 cardinal azimuth spokes at KSFO
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        for (let angle = 0; angle < 360; angle += 45) {
          const rad = angle * DEG2RAD;
          const outerX = Math.sin(rad) * 45;
          const outerY = -Math.cos(rad) * 45;
          const op = toScreen(outerX, outerY);
          ctx.moveTo(sfoScreen.x, sfoScreen.y);
          ctx.lineTo(op.x, op.y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 2. SAN FRANCISCO BAY AREA SHORELINE & TOPOGRAPHY VECTORS
      ctx.save();
      ctx.strokeStyle = '#146630';
      ctx.fillStyle = 'rgba(9, 38, 18, 0.22)';
      ctx.lineWidth = 1.2;

      bayPolygonsNM.forEach(poly => {
        ctx.beginPath();
        poly.forEach((pt, idx) => {
          const sp = toScreen(pt.x, pt.y);
          if (idx === 0) ctx.moveTo(sp.x, sp.y);
          else ctx.lineTo(sp.x, sp.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });

      // Bay Bridges (Crisp dashed green lines)
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#125929';
      ctx.lineWidth = 1.0;
      bayBridgesNM.forEach(br => {
        const p1 = toScreen(br.p1.x, br.p1.y);
        const p2 = toScreen(br.p2.x, br.p2.y);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });
      ctx.restore();

      // 3. BAY AREA AIRPORT RUNWAY CROSSHAIRS (SFO, OAK, SJC, NUQ, SQL, HWD, PAO, CCR)
      airportsNM.forEach(apt => {
        if (!apt.major && cam.zoom < 11) return; // Hide reliever airports when zoomed way out
        const sp = toScreen(apt.pos.x, apt.pos.y);

        ctx.strokeStyle = apt.major ? '#24f06b' : '#18b852';
        ctx.lineWidth = apt.major ? Math.max(1.5, 0.14 * cam.zoom) : 1.1;

        apt.rwysNM.forEach(([p1, p2]) => {
          const s1 = toScreen(p1.x, p1.y);
          const s2 = toScreen(p2.x, p2.y);
          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.stroke();
        });

        ctx.fillStyle = apt.major ? '#24f06b' : '#158f40';
        ctx.font = apt.major
          ? 'bold 10.5px ui-monospace, SFMono-Regular, monospace'
          : '9px ui-monospace, SFMono-Regular, monospace';
        ctx.fillText(apt.icao, sp.x + 10, sp.y + 13);
      });

      // 4. NORCAL TRACON NAVIGATION FIXES
      if (cam.zoom >= 9) {
        NCT_FIXES.forEach((_, idx) => {
          const fix = fixesNM[idx];
          const sp = toScreen(fix.pos.x, fix.pos.y);
          ctx.strokeStyle = '#147034';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y - 3.5);
          ctx.lineTo(sp.x + 3.2, sp.y + 2.8);
          ctx.lineTo(sp.x - 3.2, sp.y + 2.8);
          ctx.closePath();
          ctx.stroke();

          ctx.fillStyle = '#147034';
          ctx.font = '8.5px ui-monospace, monospace';
          ctx.fillText(fix.id, sp.x + 5, sp.y + 3);
        });
      }

      // 5. LIVE AIRCRAFT TARGETS, 5-DOT HISTORY TRAILS, PTL VECTORS & STARS FDBs
      const queryUpper = searchQuery.trim().toUpperCase();
      const placedLabels = [];
      let idxCounter = 0;

      for (const ac of aircraftMapRef.current.values()) {
        // Apply Altitude Filter
        if (altFilter === 'LOW' && ac.alt > 10000) continue;
        if (altFilter === 'APP' && ac.alt > 5000) continue;
        if (altFilter === 'HIGH' && ac.alt < 18000) continue;

        const sp = toScreen(ac.x, ac.y);
        // Cull off-screen targets for max FPS
        if (sp.x < -120 || sp.x > W + 120 || sp.y < -120 || sp.y > H + 120) continue;

        const isSelected = ac.hex === selectedHex;
        const isSearchMatch =
          queryUpper.length > 0 &&
          (ac.callsign.toUpperCase().includes(queryUpper) ||
            ac.type.toUpperCase().includes(queryUpper) ||
            ac.hex.toUpperCase().includes(queryUpper));
        const isEmergency = ac.squawk === '7500' || ac.squawk === '7600' || ac.squawk === '7700';

        // Classic FAA STARS Color Hierarchy
        const color = isEmergency
          ? '#ff4444'
          : isSelected || isSearchMatch
          ? '#55ffff'
          : '#24f06b';

        // A. 5-Dot Decaying Phosphor History Trail
        if (showTrails && ac.history.length > 0) {
          ac.history.forEach((pt, hIdx) => {
            const hp = toScreen(pt.x, pt.y);
            const alpha = Math.max(0.14, 0.72 - hIdx * 0.14);
            ctx.fillStyle =
              isSelected || isSearchMatch
                ? `rgba(85, 255, 255, ${alpha})`
                : `rgba(36, 240, 107, ${alpha})`;
            ctx.beginPath();
            ctx.arc(hp.x, hp.y, Math.max(1.3, 2.5 - hIdx * 0.28), 0, Math.PI * 2);
            ctx.fill();
          });
        }

        // B. Predicted Track Line (PTL: 1M / 2M / 4M lookahead)
        if (ptlMinutes > 0 && ac.gs > 25) {
          const lookaheadNM = (ac.gs / 60) * ptlMinutes;
          const rad = ac.track * DEG2RAD;
          const endX = ac.x + Math.sin(rad) * lookaheadNM;
          const endY = ac.y - Math.cos(rad) * lookaheadNM;
          const endSp = toScreen(endX, endY);

          ctx.strokeStyle = color;
          ctx.lineWidth = isSelected || isSearchMatch ? 1.5 : 1.0;
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y);
          ctx.lineTo(endSp.x, endSp.y);
          ctx.stroke();
        }

        // C. STARS Primary + Beacon Target Symbol (Diamond / Square + Selection Ring)
        ctx.save();
        ctx.translate(sp.x, sp.y);

        if (isSelected || isSearchMatch) {
          ctx.strokeStyle = '#55ffff';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Rotated STARS Target Diamond
        ctx.rotate(45 * DEG2RAD);
        ctx.fillStyle = '#020804';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.fillRect(-3.3, -3.3, 6.6, 6.6);
        ctx.strokeRect(-3.3, -3.3, 6.6, 6.6);
        ctx.restore();

        // D. Auto-Deconflicted 3-Line FAA STARS Full Data Block (FDB)
        const candidates = [
          { dx: 15, dy: -21 },
          { dx: 15, dy: 13 },
          { dx: -74, dy: -21 },
          { dx: -74, dy: 13 },
        ];
        let chosen = candidates[idxCounter % 2];
        idxCounter++;

        const boxW = 66;
        const boxH = 33;
        for (const cand of candidates) {
          const bx = sp.x + cand.dx;
          const by = sp.y + cand.dy;
          const overlaps = placedLabels.some(
            b => Math.abs(b.x - bx) < boxW && Math.abs(b.y - by) < boxH
          );
          if (!overlaps) {
            chosen = cand;
            break;
          }
        }

        const bx = sp.x + chosen.dx;
        const by = sp.y + chosen.dy;
        placedLabels.push({ x: bx, y: by });

        // Leader line from target diamond to FDB
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.moveTo(sp.x + (chosen.dx > 0 ? 4 : -4), sp.y + (chosen.dy > 0 ? 4 : -4));
        ctx.lineTo(bx + (chosen.dx > 0 ? -2 : boxW - 4), by + 6);
        ctx.stroke();

        // Line 1: Real Callsign + Emergency Squawk Alert if 7500/7600/7700
        ctx.font =
          isSelected || isSearchMatch
            ? 'bold 11px ui-monospace, SFMono-Regular, monospace'
            : '10.5px ui-monospace, SFMono-Regular, monospace';
        ctx.fillStyle = color;
        const sqkTag = isEmergency ? ` EM${ac.squawk}` : '';
        ctx.fillText(`${ac.callsign}${sqkTag}`, bx, by);

        // Line 2: Altitude (hundreds ft) + Trend Arrow + Groundspeed (tens kts)
        const altStr =
          ac.alt <= 50 && ac.gs < 40
            ? 'GND'
            : String(Math.round(ac.alt / 100)).padStart(3, '0');
        const trendChar = ac.vs > 250 ? '↑' : ac.vs < -250 ? '↓' : ' ';
        const gsStr = String(Math.round(ac.gs / 10)).padStart(2, '0');
        ctx.fillText(`${altStr}${trendChar} ${gsStr}`, bx, by + 11);

        // Line 3: Aircraft Type + Wake Category ('H' for Heavy)
        const wakeTag = ac.isHeavy ? ' H' : '';
        ctx.fillText(`${ac.type}${wakeTag}`, bx, by + 22);
      }

      ctx.restore();
    };

    const loop = (now) => {
      const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
      lastFrameTime = now;
      stepPhysics(dt);
      renderScope();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [altFilter, ptlMinutes, showTrails, searchQuery, selectedHex]);

  // Mouse Wheel Zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    cameraRef.current.zoom = Math.min(60, Math.max(5.5, cameraRef.current.zoom * factor));
  };

  // Click-Drag Pan & Target Click Selection
  const handleMouseDown = (e) => {
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      camX: cameraRef.current.x,
      camY: cameraRef.current.y,
      moved: false
    };
  };

  const handleMouseMove = (e) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > 4) dragRef.current.moved = true;

    cameraRef.current.x = dragRef.current.camX - dx / cameraRef.current.zoom;
    cameraRef.current.y = dragRef.current.camY - dy / cameraRef.current.zoom;
  };

  const handleMouseUp = (e) => {
    const wasClick = !dragRef.current.moved;
    dragRef.current.active = false;

    if (wasClick && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cam = cameraRef.current;

      let closest = null;
      let minDist = 24;

      for (const ac of aircraftMapRef.current.values()) {
        const sx = rect.width / 2 + (ac.x - cam.x) * cam.zoom;
        const sy = rect.height / 2 + (ac.y - cam.y) * cam.zoom;
        const d = Math.hypot(mx - sx, my - sy);
        if (d < minDist) {
          minDist = d;
          closest = ac;
        }
      }

      if (closest) {
        setSelectedHex(closest.hex);
        setSelectedAircraft({ ...closest });
      } else {
        setSelectedHex(null);
        setSelectedAircraft(null);
      }
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020804] select-none font-mono text-[#24f06b]">
      {/* FULL-SCREEN PHOSPHOR-GREEN NORCAL TRACON / KSFO RADAR CANVAS */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="w-full h-full block cursor-crosshair"
      />

      {/* TOP FAA STARS DISPLAY CONTROL BAR (DCB) */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Top-Left: Live ADS-B Feed Status & Force Poll */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 bg-[#031007]/90 border border-[#146630] px-3 py-1.5 rounded shadow-xl">
          <div className="flex items-center gap-2 pr-2 border-r border-[#146630]">
            <span
              className={`w-2 h-2 rounded-full ${
                isFallbackMode ? 'bg-amber-400 animate-pulse' : 'bg-[#24f06b] animate-ping'
              }`}
            />
            <span className="text-xs font-bold tracking-wider">LIVE ADS-B (KSFO)</span>
          </div>

          <span
            className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${
              isFallbackMode
                ? 'border-amber-500/60 bg-amber-950/60 text-amber-300'
                : 'border-[#18b852]/60 bg-[#093016] text-[#24f06b]'
            }`}
          >
            {feedSource}
          </span>

          <span className="text-[11px] text-[#18b852]">
            ACFT: <strong className="text-[#24f06b]">{liveCount}</strong>
          </span>

          <span className="hidden sm:inline text-[11px] text-[#18b852]">
            PKT: <strong className="text-[#24f06b]">{lastPollTime}</strong>
          </span>
        </div>

        {/* Top-Right: STARS Scope Controls (PTL, ALT FILTER, TRAILS, RANGE RINGS, SEARCH, CENTER SFO) */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 bg-[#031007]/90 border border-[#146630] px-2.5 py-1.5 rounded shadow-xl">
          {/* PTL Lookahead Toggle */}
          <button
            onClick={() => setPtlMinutes(v => (v === 1 ? 2 : v === 2 ? 4 : 1))}
            className="px-2 py-1 text-[11px] font-bold bg-[#093016] border border-[#18b852] hover:border-[#24f06b] rounded transition"
            title="Predicted Track Line (Velocity Vector Lookahead)"
          >
            PTL {ptlMinutes}M
          </button>

          {/* Altitude Band Filter */}
          <button
            onClick={() =>
              setAltFilter(f =>
                f === 'ALL' ? 'LOW' : f === 'LOW' ? 'APP' : f === 'APP' ? 'HIGH' : 'ALL'
              )
            }
            className="px-2 py-1 text-[11px] font-bold bg-[#093016] border border-[#18b852] hover:border-[#24f06b] rounded transition"
            title="Filter Targets by Altitude Band"
          >
            ALT:{' '}
            {altFilter === 'ALL'
              ? 'ALL'
              : altFilter === 'LOW'
              ? 'LOW <10K'
              : altFilter === 'APP'
              ? 'APP <5K'
              : 'HIGH >18K'}
          </button>

          {/* 5-Dot Phosphor Trails Toggle */}
          <button
            onClick={() => setShowTrails(t => !t)}
            className={`px-2 py-1 text-[11px] font-bold border rounded transition ${
              showTrails
                ? 'bg-[#093016] border-[#24f06b] text-[#24f06b]'
                : 'bg-transparent border-[#146630] text-[#146630] hover:text-[#24f06b]'
            }`}
          >
            TRAILS
          </button>

          {/* Range Rings Toggle (10, 20, 30, 40 NM Circles) */}
          <button
            onClick={() => setShowRangeRings(r => !r)}
            className={`px-2 py-1 text-[11px] font-bold border rounded transition ${
              showRangeRings
                ? 'bg-[#093016] border-[#24f06b] text-[#24f06b]'
                : 'bg-transparent border-[#146630] text-[#146630] hover:text-[#24f06b]'
            }`}
            title="Toggle KSFO Distance Range Rings (10, 20, 30, 40 NM)"
          >
            RINGS
          </button>

          {/* Live Callsign / Type Search */}
          <div className="relative flex items-center">
            <Search className="w-3 h-3 text-[#18b852] absolute left-2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="CALLSIGN/TYPE"
              className="w-28 sm:w-32 pl-6 pr-5 py-1 text-[11px] bg-[#020804] border border-[#146630] focus:border-[#55ffff] focus:outline-none rounded text-[#55ffff] placeholder-[#146630] uppercase"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 text-[#18b852] hover:text-[#55ffff]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Center KSFO Reset */}
          <button
            onClick={() => {
              cameraRef.current = { x: 0, y: 0, zoom: 14.5 };
            }}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold bg-[#093016] border border-[#18b852] hover:border-[#24f06b] rounded transition"
            title="Reset Center on KSFO (37.6213°N, 122.3790°W)"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden md:inline">CENTER SFO</span>
          </button>

          {/* UTC Zulu Clock */}
          <span className="text-xs font-bold text-[#24f06b] pl-1.5 border-l border-[#146630]">
            {zuluClock}
          </span>
        </div>
      </div>

      {/* RIGHT-EDGE COMPACT TRANSLUCENT STARS FLIGHT TELEMETRY DRAWER */}
      {selectedAircraft && (
        <div className="absolute top-16 right-3 w-72 bg-[#031107]/92 backdrop-blur-sm border border-[#55ffff]/80 rounded-lg p-3.5 shadow-2xl text-[#24f06b]">
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#146630]">
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-[#55ffff]" />
              <span className="font-bold text-base text-[#55ffff] tracking-wide">
                {selectedAircraft.callsign}
              </span>
              {selectedAircraft.isHeavy && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#0a3619] border border-[#24f06b] rounded">
                  HEAVY
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedHex(null);
                setSelectedAircraft(null);
              }}
              className="text-[#18b852] hover:text-[#55ffff] p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ICAO Hex, Aircraft Type & Squawk */}
          <div className="grid grid-cols-3 gap-1.5 py-2 border-b border-[#146630] text-[11px]">
            <div>
              <div className="text-[#158f40]">ICAO HEX</div>
              <div className="font-bold text-[#55ffff] uppercase">{selectedAircraft.hex}</div>
            </div>
            <div>
              <div className="text-[#158f40]">ACFT TYPE</div>
              <div className="font-bold text-[#24f06b]">{selectedAircraft.type}</div>
            </div>
            <div>
              <div className="text-[#158f40]">SQUAWK</div>
              <div
                className={`font-bold ${
                  ['7500', '7600', '7700'].includes(selectedAircraft.squawk)
                    ? 'text-red-400'
                    : 'text-[#24f06b]'
                }`}
              >
                {selectedAircraft.squawk}
              </div>
            </div>
          </div>

          {/* Primary Flight Vectors: Altitude, Groundspeed, Track, Vertical Rate */}
          <div className="grid grid-cols-2 gap-2 py-2.5 text-xs">
            <div className="bg-[#051c0c] border border-[#146630] p-2 rounded">
              <div className="text-[10px] text-[#158f40] flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" /> BARO ALT
              </div>
              <div className="font-bold text-sm text-[#55ffff] mt-0.5">
                {selectedAircraft.alt <= 50 && selectedAircraft.gs < 40
                  ? 'GROUND'
                  : `${Math.round(selectedAircraft.alt).toLocaleString()} FT`}
              </div>
            </div>

            <div className="bg-[#051c0c] border border-[#146630] p-2 rounded">
              <div className="text-[10px] text-[#158f40] flex items-center gap-1">
                <Gauge className="w-3 h-3" /> GROUNDSPEED
              </div>
              <div className="font-bold text-sm text-[#55ffff] mt-0.5">
                {Math.round(selectedAircraft.gs)} KTS
              </div>
            </div>

            <div className="bg-[#051c0c] border border-[#146630] p-2 rounded">
              <div className="text-[10px] text-[#158f40] flex items-center gap-1">
                <Compass className="w-3 h-3" /> TRUE TRACK
              </div>
              <div className="font-bold text-sm text-[#24f06b] mt-0.5">
                {String(Math.round(selectedAircraft.track)).padStart(3, '0')}°
              </div>
            </div>

            <div className="bg-[#051c0c] border border-[#146630] p-2 rounded">
              <div className="text-[10px] text-[#158f40] flex items-center gap-1">
                <Activity className="w-3 h-3" /> VERT RATE
              </div>
              <div className="font-bold text-sm text-[#24f06b] mt-0.5">
                {selectedAircraft.vs > 0 ? '+' : ''}
                {Math.round(selectedAircraft.vs)} FPM
              </div>
            </div>
          </div>

          {/* Distance & Bearing from KSFO + Phase Classification */}
          <div className="bg-[#051c0c] border border-[#146630] p-2.5 rounded text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[#158f40] flex items-center gap-1">
                <Navigation className="w-3 h-3" /> KSFO RELATIVE
              </span>
              <span className="font-bold text-[#24f06b]">
                {Math.hypot(selectedAircraft.x, selectedAircraft.y).toFixed(1)} NM @{' '}
                {String(Math.round(bearingFromSFO(selectedAircraft.x, selectedAircraft.y))).padStart(
                  3,
                  '0'
                )}
                °
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#146630]/60">
              <span className="text-[#158f40]">PHASE</span>
              <span className="font-bold text-[#55ffff]">{getFlightPhase(selectedAircraft)}</span>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM-LEFT MINIMAL SCOPE INTERACTION HINT */}
      <div className="absolute bottom-3 left-3 text-[10.5px] text-[#158f40] bg-[#020804]/85 px-2.5 py-1 rounded border border-[#104f25] pointer-events-none flex items-center gap-1.5">
        <Radio className="w-3 h-3 text-[#18b852]" />
        <span>KSFO 37.6213°N 122.3790°W • SCROLL: ZOOM • DRAG: PAN • CLICK TARGET: TELEMETRY</span>
      </div>
    </div>
  );
}
