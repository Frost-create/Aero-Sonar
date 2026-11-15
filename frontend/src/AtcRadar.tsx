import React, { useState, useEffect, useRef } from 'react';
import { 
  Radar, Plane, ShieldAlert, Sliders, RefreshCw, Layers, ZoomIn, 
  Compass, Clock, CloudRain, Sun, Terminal, ChevronRight, CheckCircle2,
  AlertTriangle, Navigation, Activity, Maximize2, Volume2
} from 'lucide-react';

export default function AtcRadar() {
  // --- State Variables ---
  const [rangeNm, setRangeNm] = useState(30);
  const [rangeRings, setRangeRings] = useState(5); // 5, 10, 0 (off)
  const [mapMode, setMapMode] = useState('ALL'); // ALL, GEO+FIX, MINIMAL
  const [ldrDir, setLdrDir] = useState(1); // 0-7 (N, NE, E, SE, S, SW, W, NW)
  const [historyDots, setHistoryDots] = useState(5); // 0-5
  const [ptlMins, setPtlMins] = useState(1); // 0, 1, 2, 4
  const [wxEnabled, setWxEnabled] = useState(true);
  const [brightness, setBrightness] = useState(0.72);
  const [filterSfo, setFilterSfo] = useState(false);
  const [dataFeedMode, setDataFeedMode] = useState('LIVE'); // LIVE or SIM
  const [feedStatus, setFeedStatus] = useState('CONNECTING');
  const [pollCountdown, setPollCountdown] = useState(10);
  const [metarText, setMetarText] = useState('KSFO 142056Z 29014KT 10SM FEW025 SCT180 17/09 A3012 RMK AO2 SLP201');
  const [qnh, setQnh] = useState('30.12');
  const [utcTime, setUtcTime] = useState('1243/12');

  const [tracks, setTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [cursorInfo, setCursorInfo] = useState({ lat: 37.6213, lon: -122.3790, dist: 0.0, brg: 0 });
  const [statusMsg, setStatusMsg] = useState('NCT STARS READY • CLICK TARGET TO INSPECT/VECTOR • DRAG DATA BLOCK TO REPOSITION');

  // Vector command state for selected track
  const [cmdHdg, setCmdHdg] = useState(284);
  const [cmdAlt, setCmdAlt] = useState(3000);
  const [cmdSpd, setCmdSpd] = useState(170);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const draggingRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // --- Constants & Geography (KSFO Center) ---
  const KSFO = { lat: 37.6213, lon: -122.3790 };
  const KOAK = { lat: 37.7213, lon: -122.2208 };
  const KSJC = { lat: 37.3639, lon: -121.9289 };
  const COS_LAT = Math.cos((KSFO.lat * Math.PI) / 180);

  const ldrDirections = [
    { name: 'N (1)',  dx: 0,   dy: -26 },
    { name: 'NE (2)', dx: 20,  dy: -20 },
    { name: 'E (3)',  dx: 26,  dy: 0   },
    { name: 'SE (4)', dx: 20,  dy: 20  },
    { name: 'S (5)',  dx: 0,   dy: 28  },
    { name: 'SW (6)', dx: -52, dy: 20  },
    { name: 'W (7)',  dx: -58, dy: 0   },
    { name: 'NW (8)', dx: -52, dy: -20 }
  ];

  const bayGeography = {
    sfPeninsula: [
      [37.782, -122.512], [37.808, -122.476], [37.807, -122.415], [37.795, -122.393],
      [37.765, -122.386], [37.738, -122.378], [37.708, -122.388], [37.665, -122.385],
      [37.632, -122.392], [37.610, -122.362], [37.588, -122.332], [37.555, -122.285],
      [37.515, -122.245], [37.475, -122.185], [37.445, -122.135], [37.425, -122.085],
      [37.445, -122.035], [37.485, -122.065]
    ],
    pacificCoast: [
      [37.782, -122.512], [37.730, -122.508], [37.665, -122.495], [37.595, -122.515],
      [37.500, -122.500], [37.400, -122.440], [37.280, -122.415], [37.150, -122.360]
    ],
    marinNorthBay: [
      [37.832, -122.480], [37.828, -122.535], [37.890, -122.635], [37.990, -122.750],
      [37.832, -122.480], [37.855, -122.478], [37.875, -122.505], [37.945, -122.475],
      [38.060, -122.495], [38.110, -122.450], [38.100, -122.260]
    ],
    eastBay: [
      [38.055, -122.225], [38.015, -122.285], [37.965, -122.365], [37.925, -122.395],
      [37.895, -122.320], [37.855, -122.305], [37.815, -122.325], [37.795, -122.285],
      [37.735, -122.245], [37.665, -122.165], [37.615, -122.135], [37.555, -122.115]
    ],
    bridges: [
      { name: 'GGB', coords: [[37.808, -122.475], [37.832, -122.479]] },
      { name: 'BAY BR', coords: [[37.788, -122.388], [37.810, -122.366], [37.822, -122.322]] },
      { name: 'SM BR', coords: [[37.576, -122.265], [37.606, -122.160]] },
      { name: 'DUMB BR', coords: [[37.498, -122.132], [37.512, -122.104]] }
    ]
  };

  const sfoRunways = [
    { id: '28R', p1: [37.6135, -122.3572], p2: [37.6288, -122.3935], trueHdg: 297.2, hasLoc: true },
    { id: '28L', p1: [37.6117, -122.3584], p2: [37.6263, -122.3930], trueHdg: 297.2, hasLoc: true },
    { id: '01R', p1: [37.6115, -122.3832], p2: [37.6260, -122.3738], trueHdg: 27.2, hasLoc: false },
    { id: '01L', p1: [37.6132, -122.3852], p2: [37.6258, -122.3770], trueHdg: 27.2, hasLoc: false }
  ];

  const navFixes = [
    { name: 'DUMBA', lat: 37.5685, lon: -122.2555 },
    { name: 'AXMUL', lat: 37.5420, lon: -122.1930 },
    { name: 'CEPIN', lat: 37.5145, lon: -122.1290 },
    { name: 'ARCHI', lat: 37.4720, lon: -122.0310 },
    { name: 'EDDYY', lat: 37.4280, lon: -121.9300 },
    { name: 'MENLO', lat: 37.4750, lon: -122.1550 },
    { name: 'BERKS', lat: 37.8650, lon: -122.2650 },
    { name: 'BRIXX', lat: 37.7550, lon: -122.0450 }
  ];

  const carrierFleet = {
    UAL: { types: ['B738', 'B739', 'B77W', 'B789', 'A320'], wake: 'H' },
    SWA: { types: ['B737', 'B738', 'B38M'], wake: '' },
    DAL: { types: ['A321', 'B739', 'B763', 'A339'], wake: '' },
    AAL: { types: ['A321', 'B738', 'B772'], wake: '' },
    ASA: { types: ['B739', 'E75L'], wake: '' },
    SKW: { types: ['E75L', 'CRJ7'], wake: '' },
    JBU: { types: ['A321', 'A21N'], wake: '' }
  };

  // --- Projection Helpers ---
  const latLonToNm = (lat, lon) => ({
    x: (lon - KSFO.lon) * 60 * COS_LAT,
    y: (lat - KSFO.lat) * 60
  });

  const nmToLatLon = (xNm, yNm) => ({
    lat: KSFO.lat + yNm / 60,
    lon: KSFO.lon + xNm / (60 * COS_LAT)
  });

  const normHeading = (deg) => {
    let h = deg % 360;
    return h <= 0 ? h + 360 : h;
  };

  const angleDiff = (curr, target) => ((target - curr + 540) % 360) - 180;

  // --- Simulation & Fetch Logic ---
  const seedSimTraffic = () => [
    {
      id: 'UAL863', icao24: 'A0C412', callsign: 'UAL863', type: 'B77W', wake: 'H',
      squawk: '3412', x: 4.2, y: -2.1, lat: 37.586, lon: -122.332,
      altitude: 2100, targetAltitude: 0, speed: 148, targetSpeed: 142,
      heading: 297, targetHeading: 297, vRateFpm: -750, dest: 'SFO',
      assignedRwy: '28R', isSfoInbound: true, ldrIdx: 1, customOffset: null,
      history: [{x:4.8, y:-2.7}, {x:5.3, y:-3.2}, {x:5.9, y:-3.8}]
    },
    {
      id: 'DAL142', icao24: 'A1B2C3', callsign: 'DAL142', type: 'A321', wake: '',
      squawk: '1422', x: 8.5, y: -5.1, lat: 37.536, lon: -122.255,
      altitude: 3500, targetAltitude: 1800, speed: 170, targetSpeed: 160,
      heading: 297, targetHeading: 297, vRateFpm: -850, dest: 'SFO',
      assignedRwy: '28L', isSfoInbound: true, ldrIdx: 1, customOffset: null,
      history: [{x:9.2, y:-5.8}, {x:9.9, y:-6.5}]
    },
    {
      id: 'ANA108', icao24: 'A3E4F5', callsign: 'ANA108', type: 'B789', wake: 'H',
      squawk: '5511', x: 12.1, y: -3.5, lat: 37.563, lon: -122.180,
      altitude: 5000, targetAltitude: 3500, speed: 195, targetSpeed: 180,
      heading: 235, targetHeading: 297, vRateFpm: -700, dest: 'SFO',
      assignedRwy: '28R', isSfoInbound: true, ldrIdx: 1, customOffset: null,
      history: [{x:12.8, y:-4.2}, {x:13.5, y:-4.9}]
    },
    {
      id: 'ASA312', icao24: 'A56789', callsign: 'ASA312', type: 'B739', wake: '',
      squawk: '2304', x: -3.2, y: 5.1, lat: 37.707, lon: -122.428,
      altitude: 7000, targetAltitude: 5000, speed: 210, targetSpeed: 210,
      heading: 155, targetHeading: 180, vRateFpm: -1100, dest: 'SFO',
      assignedRwy: '28L', isSfoInbound: true, ldrIdx: 1, customOffset: null,
      history: [{x:-2.8, y:5.8}, {x:-2.4, y:6.5}]
    },
    {
      id: 'SWA219', icao24: 'A98765', callsign: 'SWA219', type: 'B38M', wake: '',
      squawk: '4211', x: 6.8, y: 3.2, lat: 37.674, lon: -122.280,
      altitude: 3200, targetAltitude: 1500, speed: 175, targetSpeed: 160,
      heading: 305, targetHeading: 305, vRateFpm: -800, dest: 'OAK',
      assignedRwy: null, isSfoInbound: false, ldrIdx: 1, customOffset: null,
      history: [{x:7.4, y:2.6}, {x:8.0, y:2.0}]
    }
  ];

  // Poll live OpenSky API
  const fetchLiveOpenSky = async () => {
    if (dataFeedMode !== 'LIVE') return;
    try {
      const res = await fetch('https://opensky-network.org/api/states/all?lamin=36.9&lomin=-123.3&lamax=38.4&lomax=-121.4');
      if (!res.ok) throw new Error('OpenSky HTTP error');
      const json = await res.json();
      if (!json || !json.states) throw new Error('No states');

      const newTracks = json.states.map(s => {
        const icao24 = s[0];
        const callsign = (s[1] || icao24).trim();
        const lon = s[5];
        const lat = s[6];
        const altM = s[7] ?? s[13];
        const onGround = s[8];
        const vel = s[9] || 150;
        const trk = s[10] || 284;
        const vRate = s[11] || 0;

        if (lat == null || lon == null || onGround) return null;
        const altFt = Math.round((altM || 0) * 3.28084);
        const spdKts = Math.round(vel * 1.94384);
        const nm = latLonToNm(lat, lon);

        // Infer type & SFO arrival
        const prefix = callsign.slice(0, 3).toUpperCase();
        const fleet = carrierFleet[prefix];
        const type = fleet ? fleet.types[Math.floor(Math.random() * fleet.types.length)] : 'B738';
        const wake = fleet?.wake || '';
        const isSfoInbound = Math.hypot(nm.x, nm.y) < 25 && altFt < 12000;

        return {
          id: icao24,
          icao24,
          callsign,
          squawk: s[14] || '1200',
          x: nm.x,
          y: nm.y,
          lat,
          lon,
          altitude: altFt,
          targetAltitude: altFt,
          speed: spdKts,
          targetSpeed: spdKts,
          heading: trk,
          targetHeading: trk,
          vRateFpm: Math.round(vRate * 196.85),
          type,
          wake,
          dest: 'SFO',
          assignedRwy: isSfoInbound ? (nm.y > 0 ? '28L' : '28R') : null,
          isSfoInbound,
          ldrIdx: 1,
          customOffset: null,
          history: []
        };
      }).filter(Boolean);

      if (newTracks.length > 0) {
        setTracks(newTracks);
        setFeedStatus('LIVE');
      } else {
        throw new Error('Empty');
      }
    } catch (err) {
      setFeedStatus('FALLBACK');
      if (tracks.length === 0) setTracks(seedSimTraffic());
    }
  };

  // --- Main Animation & Simulation Loop ---
  useEffect(() => {
    setTracks(seedSimTraffic());
    fetchLiveOpenSky();

    const timer = setInterval(() => {
      const now = new Date();
      setUtcTime(`${String(now.getUTCHours()).padStart(2,'0')}${String(now.getUTCMinutes()).padStart(2,'0')}/${String(now.getUTCSeconds()).padStart(2,'0')}`);
      
      setPollCountdown(prev => {
        if (prev <= 1) {
          fetchLiveOpenSky();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [dataFeedMode]);

  useEffect(() => {
    let animId;
    let lastTime = performance.now();

    const loop = (time) => {
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      setTracks(prevTracks => prevTracks.map(t => {
        let { x, y, heading, targetHeading, altitude, targetAltitude, speed, targetSpeed, vRateFpm } = t;

        // Simulation physics for vector control
        const isSimActive = dataFeedMode === 'SIM' || feedStatus !== 'LIVE';
        if (isSimActive) {
          const hDiff = angleDiff(heading, targetHeading);
          if (Math.abs(hDiff) < 3 * dt) heading = targetHeading;
          else heading = normHeading(heading + Math.sign(hDiff) * 3 * dt);

          const aDiff = targetAltitude - altitude;
          if (Math.abs(aDiff) < 30 * dt) {
            altitude = targetAltitude;
            vRateFpm = 0;
          } else {
            altitude += Math.sign(aDiff) * 30 * dt;
            vRateFpm = Math.sign(aDiff) * 1200;
          }

          const sDiff = targetSpeed - speed;
          if (Math.abs(sDiff) < 3 * dt) speed = targetSpeed;
          else speed += Math.sign(sDiff) * 3 * dt;
        }

        const nmPerSec = (speed / 3600) * (isSimActive ? 1.5 : 1.0);
        const rad = (heading * Math.PI) / 180;
        x += Math.sin(rad) * nmPerSec * dt;
        y += Math.cos(rad) * nmPerSec * dt;

        const ll = nmToLatLon(x, y);
        return { ...t, x, y, lat: ll.lat, lon: ll.lon, heading, altitude, speed, vRateFpm };
      }));

      renderCanvas();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [rangeNm, rangeRings, mapMode, ldrDir, historyDots, ptlMins, wxEnabled, brightness, filterSfo, selectedTrackId, tracks]);

  // --- Canvas Rendering Engine ---
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const pxPerNm = Math.min(width, height) / (rangeNm * 2);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const mapAlpha = brightness;

    // 1. NEXRAD Weather Precip
    if (wxEnabled) {
      const grad = ctx.createRadialGradient(centerX - 40, centerY + 50, 10, centerX - 40, centerY + 50, 120);
      grad.addColorStop(0, `rgba(28, 92, 112, ${0.22 * mapAlpha})`);
      grad.addColorStop(1, 'rgba(10, 35, 44, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX - 40, centerY + 50, 120, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Bay Area Geography
    ctx.save();
    ctx.strokeStyle = `rgba(40, 102, 122, ${0.75 * mapAlpha})`;
    ctx.lineWidth = 1.2;

    const drawPoly = (coords) => {
      ctx.beginPath();
      coords.forEach((ll, i) => {
        const nm = latLonToNm(ll[0], ll[1]);
        const px = centerX + nm.x * pxPerNm;
        const py = centerY - nm.y * pxPerNm;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    };

    if (mapMode !== 'MINIMAL') {
      drawPoly(bayGeography.sfPeninsula);
      drawPoly(bayGeography.pacificCoast);
      drawPoly(bayGeography.marinNorthBay);
      drawPoly(bayGeography.eastBay);
      bayGeography.bridges.forEach(b => drawPoly(b.coords));
    }
    ctx.restore();

    // 3. Range Rings
    if (rangeRings > 0) {
      for (let r = rangeRings; r <= rangeNm + 10; r += rangeRings) {
        const rPx = r * pxPerNm;
        ctx.strokeStyle = `rgba(38, 96, 115, ${0.35 * mapAlpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, rPx, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(68, 154, 179, ${0.6 * mapAlpha})`;
        ctx.font = '9px monospace';
        ctx.fillText(`${r}`, centerX + 4, centerY - rPx + 10);
      }
    }

    // 4. Nav Fixes
    if (mapMode === 'ALL') {
      navFixes.forEach(f => {
        const nm = latLonToNm(f.lat, f.lon);
        const px = centerX + nm.x * pxPerNm;
        const py = centerY - nm.y * pxPerNm;
        ctx.strokeStyle = `rgba(82, 184, 209, ${0.7 * mapAlpha})`;
        ctx.strokeRect(px - 2.5, py - 2.5, 5, 5);
        ctx.fillStyle = `rgba(92, 200, 224, ${0.7 * mapAlpha})`;
        ctx.font = '9px monospace';
        ctx.fillText(f.name, px + 5, py + 3);
      });
    }

    // 5. Runways & ILS Plumes
    sfoRunways.forEach(rwy => {
      const nm1 = latLonToNm(rwy.p1[0], rwy.p1[1]);
      const nm2 = latLonToNm(rwy.p2[0], rwy.p2[1]);
      const p1 = { x: centerX + nm1.x * pxPerNm, y: centerY - nm1.y * pxPerNm };
      const p2 = { x: centerX + nm2.x * pxPerNm, y: centerY - nm2.y * pxPerNm };

      if (rwy.hasLoc) {
        const recRad = ((rwy.trueHdg + 180) * Math.PI) / 180;
        const endX = nm1.x + Math.sin(recRad) * 20;
        const endY = nm1.y + Math.cos(recRad) * 20;
        const pEnd = { x: centerX + endX * pxPerNm, y: centerY - endY * pxPerNm };

        ctx.strokeStyle = `rgba(92, 230, 230, ${0.4 * mapAlpha})`;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(pEnd.x, pEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });

    // 6. Aircraft Tracks & Data Blocks
    tracks.forEach(t => {
      if (filterSfo && !t.isSfoInbound && t.dest !== 'SFO') return;

      const px = centerX + t.x * pxPerNm;
      const py = centerY - t.y * pxPerNm;
      const isSelected = t.id === selectedTrackId;
      const symColor = isSelected ? '#ffaa00' : (t.isSfoInbound ? '#5ce6e6' : '#76e076');

      // History trail
      if (historyDots > 0 && t.history) {
        t.history.slice(0, historyDots).forEach((h, idx) => {
          const hx = centerX + h.x * pxPerNm;
          const hy = centerY - h.y * pxPerNm;
          ctx.fillStyle = `rgba(92, 230, 230, ${Math.max(0.2, 0.6 - idx * 0.12)})`;
          ctx.fillRect(hx - 1.5, hy - 1.5, 3, 3);
        });
      }

      // PTL Vector
      if (ptlMins > 0) {
        const ptlDist = (t.speed / 60) * ptlMins * pxPerNm;
        const rad = (t.heading * Math.PI) / 180;
        ctx.strokeStyle = symColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.sin(rad) * ptlDist, py - Math.cos(rad) * ptlDist);
        ctx.stroke();
      }

      // Target symbol
      ctx.fillStyle = symColor;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.squawk === '1200' ? 'V' : 'S', px, py);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      if (isSelected) {
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 11, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Data Block Leader & Text
      const offset = t.customOffset || ldrDirections[t.ldrIdx] || ldrDirections[1];
      const bx = px + offset.dx;
      const by = py + offset.dy;

      ctx.strokeStyle = symColor;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(bx - 2, by - 3);
      ctx.stroke();

      const line1 = `${t.callsign}${t.wake ? ' ' + t.wake : ''}`;
      const altHundreds = String(Math.max(0, Math.round(t.altitude / 100))).padStart(3, '0');
      const arrow = t.vRateFpm > 250 ? '↑' : (t.vRateFpm < -250 ? '↓' : ' ');
      const spdTens = String(Math.round(t.speed / 10)).padStart(2, '0');
      const line2 = `${altHundreds}${arrow}${spdTens}`;
      const line3 = `${t.type} ${t.assignedRwy || t.dest}`;

      ctx.fillStyle = symColor;
      ctx.font = isSelected ? 'bold 11px monospace' : '11px monospace';
      ctx.fillText(line1, bx, by);
      ctx.fillText(line2, bx, by + 11);
      ctx.fillText(line3, bx, by + 22);
    });
  };

  // --- Canvas Mouse Handlers for Selection & Dragging ---
  const handleCanvasMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const centerX = canvas.width / (2 * (window.devicePixelRatio || 1));
    const centerY = canvas.height / (2 * (window.devicePixelRatio || 1));
    const pxPerNm = Math.min(centerX * 2, centerY * 2) / (rangeNm * 2);

    let clickedTrack = null;
    let isDataBlock = false;

    tracks.forEach(t => {
      const px = centerX + t.x * pxPerNm;
      const py = centerY - t.y * pxPerNm;
      const offset = t.customOffset || ldrDirections[t.ldrIdx] || ldrDirections[1];
      const bx = px + offset.dx;
      const by = py + offset.dy;

      if (mx >= bx - 5 && mx <= bx + 65 && my >= by - 12 && my <= by + 26) {
        clickedTrack = t;
        isDataBlock = true;
      } else if (Math.hypot(mx - px, my - py) < 18) {
        clickedTrack = t;
      }
    });

    if (clickedTrack) {
      setSelectedTrackId(clickedTrack.id);
      setCmdHdg(Math.round(clickedTrack.targetHeading));
      setCmdAlt(Math.min(14000, Math.max(1500, Math.round(clickedTrack.targetAltitude / 500) * 500)));
      setCmdSpd(Math.min(280, Math.max(135, Math.round(clickedTrack.targetSpeed / 5) * 5)));

      if (isDataBlock) {
        draggingRef.current = clickedTrack;
        const px = centerX + clickedTrack.x * pxPerNm;
        const py = centerY - clickedTrack.y * pxPerNm;
        const offset = clickedTrack.customOffset || ldrDirections[clickedTrack.ldrIdx] || ldrDirections[1];
        dragOffsetRef.current = { x: mx - (px + offset.dx), y: my - (py + offset.dy) };
      }
    } else {
      setSelectedTrackId(null);
    }
  };

  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const centerX = canvas.width / (2 * (window.devicePixelRatio || 1));
    const centerY = canvas.height / (2 * (window.devicePixelRatio || 1));
    const pxPerNm = Math.min(centerX * 2, centerY * 2) / (rangeNm * 2);

    if (draggingRef.current) {
      const t = draggingRef.current;
      const px = centerX + t.x * pxPerNm;
      const py = centerY - t.y * pxPerNm;
      t.customOffset = {
        dx: mx - px - dragOffsetRef.current.x,
        dy: my - py - dragOffsetRef.current.y
      };
      return;
    }

    const nmX = (mx - centerX) / pxPerNm;
    const nmY = (centerY - my) / pxPerNm;
    const ll = nmToLatLon(nmX, nmY);
    const dist = Math.hypot(nmX, nmY);
    let brg = Math.round((Math.atan2(nmX, nmY) * 180) / Math.PI);
    if (brg <= 0) brg += 360;

    setCursorInfo({ lat: ll.lat, lon: ll.lon, dist, brg });
  };

  const handleCanvasMouseUp = () => {
    draggingRef.current = null;
  };

  // --- Actions ---
  const handleVectorTransmit = () => {
    if (!selectedTrackId) return;
    setTracks(tracks.map(t => {
      if (t.id === selectedTrackId) {
        return { ...t, targetHeading: cmdHdg, targetAltitude: cmdAlt, targetSpeed: cmdSpd };
      }
      return t;
    }));
    setStatusMsg(`VECTOR TX: FLY HDG ${String(cmdHdg).padStart(3, '0')}°, ALT ${cmdAlt}, SPD ${cmdSpd}KT`);
  };

  const handleAssignRwy = (rwy) => {
    if (!selectedTrackId) return;
    setTracks(tracks.map(t => {
      if (t.id === selectedTrackId) {
        return { ...t, assignedRwy: rwy, isSfoInbound: true };
      }
      return t;
    }));
    setStatusMsg(`ASSIGNED KSFO RWY ${rwy}`);
  };

  const selectedTrack = tracks.find(t => t.id === selectedTrackId);
  const arrivalList = tracks.filter(t => t.isSfoInbound || t.dest === 'SFO');

  return (
    <div className="h-screen w-screen flex flex-col bg-black text-[#d8f3f3] font-mono select-none overflow-hidden">
      
      {/* --- TOP DISPLAY CONTROL BAR (DCB) --- */}
      <header className="bg-[#071014] border-b border-[#235363] px-2 py-1 flex flex-wrap items-center justify-between gap-1.5 shrink-0 z-30">
        <div className="flex flex-wrap items-center gap-1">
          <button 
            onClick={() => setRangeNm(r => r === 60 ? 10 : r + 10)}
            className="dcb-btn active"
            title="Cycle Range"
          >
            <span className="text-[9px] text-[#9ad8e6]">RANGE</span>
            <span className="text-white font-bold">{rangeNm} NM</span>
          </button>

          <button 
            onClick={() => setRangeRings(r => r === 5 ? 10 : (r === 10 ? 0 : 5))}
            className="dcb-btn active"
            title="Range Rings"
          >
            <span className="text-[9px] text-[#9ad8e6]">RR</span>
            <span className="text-white font-bold">{rangeRings === 0 ? 'OFF' : `${rangeRings} NM`}</span>
          </button>

          <button 
            onClick={() => setMapMode(m => m === 'ALL' ? 'GEO+FIX' : (m === 'GEO+FIX' ? 'MINIMAL' : 'ALL'))}
            className="dcb-btn active"
          >
            <span className="text-[9px] text-[#9ad8e6]">MAP</span>
            <span className="text-white font-bold">{mapMode}</span>
          </button>

          <button 
            onClick={() => setLdrDir(d => (d + 1) % ldrDirections.length)}
            className="dcb-btn active"
          >
            <span className="text-[9px] text-[#9ad8e6]">LDR</span>
            <span className="text-white font-bold">{ldrDirections[ldrDir].name}</span>
          </button>

          <button 
            onClick={() => setHistoryDots(h => h === 5 ? 0 : h + 2)}
            className="dcb-btn active"
          >
            <span className="text-[9px] text-[#9ad8e6]">HIST</span>
            <span className="text-white font-bold">{historyDots}</span>
          </button>

          <button 
            onClick={() => setPtlMins(p => p === 1 ? 2 : (p === 2 ? 4 : (p === 4 ? 0 : 1)))}
            className="dcb-btn active"
          >
            <span className="text-[9px] text-[#9ad8e6]">PTL</span>
            <span className="text-white font-bold">{ptlMins} MIN</span>
          </button>

          <button 
            onClick={() => setWxEnabled(!wxEnabled)}
            className={`dcb-btn ${wxEnabled ? 'active' : ''}`}
          >
            <span className="text-[9px] text-[#9ad8e6]">WX</span>
            <span className="text-white font-bold">{wxEnabled ? 'L1-6' : 'OFF'}</span>
          </button>

          <button 
            onClick={() => setBrightness(b => b === 0.72 ? 1.0 : (b === 1.0 ? 0.45 : 0.72))}
            className="dcb-btn active"
          >
            <span className="text-[9px] text-[#9ad8e6]">BRITE</span>
            <span className="text-white font-bold">{brightness === 1.0 ? 'H 95%' : (brightness === 0.45 ? 'L 40%' : 'M 65%')}</span>
          </button>

          <button 
            onClick={() => setFilterSfo(!filterSfo)}
            className={`dcb-btn ${filterSfo ? 'amber-active bg-[#4a3208] text-[#ffaa00] border-[#ffaa00]' : 'active'}`}
          >
            <span className="text-[9px] text-[#9ad8e6]">FILTER</span>
            <span className="font-bold">{filterSfo ? 'SFO INB' : 'ALL BAY'}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setDataFeedMode(m => m === 'LIVE' ? 'SIM' : 'LIVE')}
            className="dcb-btn active"
          >
            <span className="text-[9px] text-[#9ad8e6]">FEED</span>
            <span className="text-[#5ce6e6] font-bold">{dataFeedMode}</span>
          </button>
          <button 
            onClick={fetchLiveOpenSky}
            className="dcb-btn active"
            title="Poll Now"
          >
            <span className="text-[9px] text-[#9ad8e6]">POLL</span>
            <span className="text-white font-bold">{pollCountdown}S</span>
          </button>
        </div>
      </header>

      {/* --- MAIN WORKSTATION BODY --- */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">

        {/* RADAR SCOPE CANVAS */}
        <main ref={containerRef} className="flex-1 relative bg-black overflow-hidden cursor-crosshair">
          <canvas 
            ref={canvasRef}
            width={1200}
            height={900}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="w-full h-full block"
          />

          {/* Top-Left SSA System Status */}
          <div className="absolute top-2.5 left-2.5 pointer-events-none text-[11px] leading-tight text-[#5ce6e6] z-20">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">NCT / SFO_APP</span>
              <span className="text-white font-bold">{utcTime}</span>
              <span className="text-[#76e076]">QNH {qnh}</span>
            </div>
            <div className="text-[#9ad8e6]">WEST PLAN: ARR 28L/28R | DEP 1L/1R</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="px-1.5 py-0.2 text-[10px] font-bold bg-[#0c2b36] border border-[#5ce6e6]">
                {feedStatus === 'LIVE' ? 'LIVE OPENSKY ADS-B' : 'SIMULATED BAY FEED'}
              </span>
              <span className="text-[#9ad8e6] text-[10px]">TRK: {tracks.length} | SFO INB: {arrivalList.length}</span>
            </div>
            <div className="text-[10px] text-[#76e076] mt-1 max-w-sm truncate">{metarText}</div>
          </div>

          {/* Bottom-Left Cursor Readout */}
          <div className="absolute bottom-2.5 left-2.5 pointer-events-none text-[10px] text-[#4da6bd] bg-black/80 px-2 py-1 border border-[#1a3e4a] z-20">
            <div>{cursorInfo.lat.toFixed(4)}°N {Math.abs(cursorInfo.lon).toFixed(4)}°W</div>
            <div>SFO {String(cursorInfo.brg).padStart(3, '0')}° / {cursorInfo.dist.toFixed(1)} NM</div>
          </div>

          {/* Bottom-Center Scratchpad Message */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 pointer-events-none hidden sm:block z-20">
            <div className="bg-[#061318]/90 border border-[#235363] px-3 py-1 text-[11px] text-[#5ce6e6] tracking-wide">
              {statusMsg}
            </div>
          </div>
        </main>

        {/* RIGHT CONTROLLER CONSOLE & TBFM */}
        <aside className="w-full lg:w-[370px] bg-[#050c0f] border-t lg:border-t-0 lg:border-l border-[#235363] flex flex-col shrink-0 z-20 max-h-[45vh] lg:max-h-full text-xs">
          
          {/* Selected Track Inspection Panel */}
          <div className="p-2.5 border-b border-[#235363] bg-[#071217]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-[#5ce6e6]">STARS TRACK INSPECTOR</span>
              <span className="text-[10px] px-1.5 bg-[#0e2630] border border-[#2b6375] text-[#9ad8e6]">
                {selectedTrack ? selectedTrack.callsign : 'NO SELECTION'}
              </span>
            </div>

            {!selectedTrack ? (
              <div className="py-4 px-2 text-center text-[#4da6bd] border border-dashed border-[#1c4452] text-[11px]">
                Click any radar target or arrival strip to inspect telemetry, assign runways, or issue vectors.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-black p-2 border border-[#2b6375]">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-[#ffaa00]">{selectedTrack.callsign}</span>
                      <span className="text-[10px] px-1 bg-[#1b3a47] text-white font-bold">{selectedTrack.wake || 'L'}</span>
                      <span className="text-[11px] text-[#5ce6e6]">{selectedTrack.type}</span>
                    </div>
                    <div className="text-[10px] text-[#76e076] mt-0.5">ICAO: {selectedTrack.icao24} • SQK: {selectedTrack.squawk}</div>
                  </div>
                  <div className="text-right text-[10px]">
                    <div className="text-white font-bold">{Math.hypot(selectedTrack.x, selectedTrack.y).toFixed(1)} NM</div>
                    <div className="text-[#5ce6e6]">HDG {Math.round(selectedTrack.heading)}°</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 text-[10px] bg-[#040a0c] p-1.5 border border-[#193b47]">
                  <div>
                    <span className="text-[#4da6bd] block">ALTITUDE</span>
                    <span className="text-white font-bold">{Math.round(selectedTrack.altitude).toLocaleString()} FT</span>
                  </div>
                  <div>
                    <span className="text-[#4da6bd] block">GND SPD</span>
                    <span className="text-white font-bold">{Math.round(selectedTrack.speed)} KTS</span>
                  </div>
                  <div>
                    <span className="text-[#4da6bd] block">VERT RATE</span>
                    <span className="text-[#76e076] font-bold">{selectedTrack.vRateFpm} FPM</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#4da6bd]">RWY:</span>
                    <button onClick={() => handleAssignRwy('28L')} className="px-2 py-0.5 text-[10px] font-bold bg-[#0e2630] hover:bg-[#194354] border border-[#2b6375] text-[#5ce6e6]">28L</button>
                    <button onClick={() => handleAssignRwy('28R')} className="px-2 py-0.5 text-[10px] font-bold bg-[#0e2630] hover:bg-[#194354] border border-[#2b6375] text-[#5ce6e6]">28R</button>
                    <button onClick={() => handleAssignRwy(null)} className="px-1.5 py-0.5 text-[10px] bg-[#1a1a1a] border border-[#3a3a3a] text-gray-300">CLR</button>
                  </div>
                </div>

                <div className="pt-1 border-t border-[#183945] space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#4da6bd]">VECTOR COMMANDS:</span>
                    <span className="text-[#ffaa00] font-bold">HDG {cmdHdg}° • {cmdAlt} • {cmdSpd}KT</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="text-[9px] text-[#4da6bd] block">HDG ({cmdHdg}°)</label>
                      <input type="range" min="1" max="360" value={cmdHdg} onChange={e => setCmdHdg(Number(e.target.value))} className="w-full h-1 bg-[#102830]" />
                    </div>
                    <div>
                      <label className="text-[9px] text-[#4da6bd] block">ALT ({cmdAlt})</label>
                      <input type="range" min="1500" max="14000" step="500" value={cmdAlt} onChange={e => setCmdAlt(Number(e.target.value))} className="w-full h-1 bg-[#102830]" />
                    </div>
                    <div>
                      <label className="text-[9px] text-[#4da6bd] block">SPD ({cmdSpd})</label>
                      <input type="range" min="135" max="280" step="5" value={cmdSpd} onChange={e => setCmdSpd(Number(e.target.value))} className="w-full h-1 bg-[#102830]" />
                    </div>
                  </div>
                  <button onClick={handleVectorTransmit} className="w-full py-1 bg-[#143d4d] hover:bg-[#1c5469] border border-[#5ce6e6] text-[#5ce6e6] font-bold text-[10px]">
                    TX VECTOR / INTERCEPT
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* TBFM Arrival Meter */}
          <div className="flex-1 flex flex-col overflow-hidden p-2.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#5ce6e6] mb-1.5">
              <span>TBFM ARRIVAL METER // KSFO</span>
              <span className="text-[#76e076]">AAR: 36/HR</span>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-2 overflow-hidden">
              {['28L', '28R'].map(rwy => {
                const list = arrivalList.filter(t => (t.assignedRwy || '28R') === rwy);
                return (
                  <div key={rwy} className="flex flex-col bg-[#03080a] border border-[#1a3e4a] overflow-hidden">
                    <div className="px-2 py-1 bg-[#0b2028] border-b border-[#1a3e4a] flex justify-between items-center text-[10px] font-bold">
                      <span className="text-[#5ce6e6]">RWY {rwy}</span>
                      <span className="text-white">{list.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-1 space-y-1">
                      {list.map(ac => {
                        const isSel = ac.id === selectedTrackId;
                        const dist = Math.hypot(ac.x, ac.y);
                        return (
                          <div 
                            key={ac.id} 
                            onClick={() => setSelectedTrackId(ac.id)}
                            className={`px-1.5 py-1 border text-[10px] cursor-pointer flex items-center justify-between ${
                              isSel ? 'bg-[#2b1d04] border-[#ffaa00] text-[#ffaa00]' : 'bg-[#061116] border-[#163642] text-[#d8f3f3]'
                            }`}
                          >
                            <span className="font-bold">{ac.callsign}</span>
                            <span>{dist.toFixed(1)}m</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}              <X className="w-4 h-4" />
            </button>
          </div>

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
              <div className={`font-bold ${['7500', '7600', '7700'].includes(selectedAircraft.squawk) ? 'text-red-400' : 'text-[#24f06b]'}`}> {selectedAircraft.squawk} </div> </div> </div>  <div className="grid grid-cols-2 gap-2 py-2.5 text-xs"> <div className="bg-[#051c0c] border border-[#146630] p-2 rounded"> <div className="text-[10px] text-[#158f40] flex items-center gap-1"><ArrowUpDown className="w-3 h-3" /> BARO ALT</div> <div className="font-bold text-sm text-[#55ffff] mt-0.5"> {selectedAircraft.alt <= 50 && selectedAircraft.gs < 40 ? 'GROUND' : `${Math.round(selectedAircraft.alt).toLocaleString()} FT`}
              </div>
            </div>
            <div className="bg-[#051c0c] border border-[#146630] p-2 rounded">
              <div className="text-[10px] text-[#158f40] flex items-center gap-1"><Gauge className="w-3 h-3" /> GROUNDSPEED</div>
              <div className="font-bold text-sm text-[#55ffff] mt-0.5">{Math.round(selectedAircraft.gs)} KTS</div>
            </div>
            <div className="bg-[#051c0c] border border-[#146630] p-2 rounded">
              <div className="text-[10px] text-[#158f40] flex items-center gap-1"><Compass className="w-3 h-3" /> TRUE TRACK</div>
              <div className="font-bold text-sm text-[#24f06b] mt-0.5">{String(Math.round(selectedAircraft.track)).padStart(3, '0')}°</div>
            </div>
            <div className="bg-[#051c0c] border border-[#146630] p-2 rounded">
              <div className="text-[10px] text-[#158f40] flex items-center gap-1"><Activity className="w-3 h-3" /> VERT RATE</div>
              <div className="font-bold text-sm text-[#24f06b] mt-0.5">{selectedAircraft.vs > 0 ? '+' : ''}{Math.round(selectedAircraft.vs)} FPM</div>
            </div>
          </div>

          <div className="bg-[#051c0c] border border-[#146630] p-2.5 rounded text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[#158f40] flex items-center gap-1"><Navigation className="w-3 h-3" /> KSFO RELATIVE</span>
              <span className="font-bold text-[#24f06b]">
                {Math.hypot(selectedAircraft.x, selectedAircraft.y).toFixed(1)} NM @ {String(Math.round(bearingFromSFO(selectedAircraft.x, selectedAircraft.y))).padStart(3, '0')}°
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-[#146630]/60">
              <span className="text-[#158f40]">PHASE</span>
              <span className="font-bold text-[#55ffff]">{getFlightPhase(selectedAircraft)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 text-[10.5px] text-[#158f40] bg-[#020804]/85 px-2.5 py-1 rounded border border-[#104f25] pointer-events-none flex items-center gap-1.5">
        <Radio className="w-3 h-3 text-[#18b852]" />
        <span>KSFO 37.6213°N 122.3790°W • SCROLL: ZOOM • DRAG: PAN • CLICK TARGET: TELEMETRY</span>
      </div>
    </div>
  );
}
