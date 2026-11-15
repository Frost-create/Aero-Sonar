import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import { Server } from "socket.io";
import { OpenSkyClient } from "./opensky.js";
import { normalizeState } from "./normalize.js";
import { createAtcAgentResponse } from "./atcAgent.js";
import { AIRPORT_CENTERS, buildDemoFlights, distanceNm } from "./liveFlights.js";

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const bounds = {
  lamin: numberFromEnv("LAMIN", 36.5),
  lamax: numberFromEnv("LAMAX", 38.5),
  lomin: numberFromEnv("LOMIN", -123.5),
  lomax: numberFromEnv("LOMAX", -121.0)
};

if (bounds.lamin >= bounds.lamax || bounds.lomin >= bounds.lomax) {
  throw new Error("Invalid bounding box: require LAMIN < LAMAX and LOMIN < LOMAX.");
}

const openSky = new OpenSkyClient({
  clientId: process.env.OPENSKY_CLIENT_ID,
  clientSecret: process.env.OPENSKY_CLIENT_SECRET,
  bounds
});

const authenticated = openSky.authenticated;
const defaultPollMs = authenticated ? 25_000 : 240_000;
const pollIntervalMs = Math.max(
  authenticated ? 5_000 : 60_000,
  numberFromEnv("POLL_INTERVAL_MS", defaultPollMs)
);
const trackTtlMs = numberFromEnv("TRACK_TTL_SECONDS", 90) * 1000;
const port = numberFromEnv("PORT", 3001);
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const logSummary = process.env.LOG_POLL_SUMMARY !== "false";

const app = express();
app.use(cors({ origin: clientOrigin === "*" ? true : clientOrigin }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: clientOrigin === "*" ? true : clientOrigin, methods: ["GET", "POST"] }
});

const aircraftById = new Map();
let lastFetchAt = null;
let lastSuccessAt = null;
let lastError = null;
let openSkyTime = null;
let polling = false;
let pollTimer = null;
let nextPollDelayMs = pollIntervalMs;

function currentSnapshot() {
  return {
    type: "snapshot",
    source: "OpenSky Network",
    generatedAt: new Date().toISOString(),
    openSkyTime,
    aircraft: [...aircraftById.values()].filter((a) => a.hasPosition),
    count: [...aircraftById.values()].filter((a) => a.hasPosition).length,
    bounds
  };
}

app.get("/health", (_req, res) => {
  res.json({
    status: lastError && !lastSuccessAt ? "degraded" : "ok",
    source: "OpenSky Network",
    authenticated,
    pollIntervalMs,
    lastFetchAt,
    lastSuccessAt,
    lastError,
    aircraftTracked: aircraftById.size,
    bounds
  });
});

app.get("/api/aircraft", (_req, res) => {
  res.json(currentSnapshot());
});

app.get("/api/live-flights", (req, res) => {
  const airport = String(req.query.airport || "").toUpperCase();
  if (!Object.hasOwn(AIRPORT_CENTERS, airport)) {
    return res.status(400).json({
      error: "Unsupported or missing airport. Supported airports: KSFO, EGLL, VIDP, OMDB, KJFK, RJTT."
    });
  }

  const center = AIRPORT_CENTERS[airport];
  const aircraft = [...aircraftById.values()].filter(
    (item) =>
      item.hasPosition &&
      item.latitude != null &&
      item.longitude != null &&
      distanceNm(center, { latitude: item.latitude, longitude: item.longitude }) <= 100
  );
  const flights = buildDemoFlights(aircraft, airport);

  res.json({
    airport,
    source: "OpenSky Network",
    generatedAt: new Date().toISOString(),
    coverage: bounds,
    dataQuality: "MIXED_ACTUAL_AND_DEMO",
    flightQueueAvailable: flights.length >= 2,
    estimatedFields: [
      "acType",
      "wakeClass",
      "opType",
      "runway",
      "arrivalMinutes",
      "icaoSepNm"
    ],
    flights,
    crosswind_kts: null,
    aircraft
  });
});

app.post("/api/atc-agent", (req, res) => {
  try {
    res.json(createAtcAgentResponse(req.body));
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/weather", async (req, res, next) => {
  const airport = String(req.query.airport || "").toUpperCase();
  if (!/^[A-Z]{4}$/.test(airport)) {
    return res.status(400).json({ error: "airport must be a four-letter ICAO code." });
  }

  try {
    const url = new URL("https://aviationweather.gov/api/data/metar");
    url.searchParams.set("ids", airport);
    url.searchParams.set("format", "json");
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      return res.status(502).json({ error: `Aviation Weather upstream returned HTTP ${response.status}.` });
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return res.status(502).json({ error: "Aviation Weather returned an unexpected response." });
    }
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

app.get("/api/config", (_req, res) => {
  res.json({
    source: "OpenSky Network",
    units: { altitude: "ft", groundspeed: "kt", verticalRate: "ft/min", heading: "degrees true" },
    pollIntervalMs,
    bounds
  });
});

io.on("connection", (socket) => {
  socket.emit("surveillance:snapshot", currentSnapshot());
  socket.emit("surveillance:status", {
    connected: true,
    lastSuccessAt,
    lastError,
    pollIntervalMs
  });
});

function pruneExpired(now) {
  const removed = [];
  for (const [icao24, aircraft] of aircraftById) {
    const lastSeenMs = (aircraft.lastContact || aircraft.timePosition || 0) * 1000;
    // Use fetch time as a fallback if the source timestamps are absent.
    const effectiveLastSeen = lastSeenMs || Date.parse(aircraft.fetchedAt);
    if (now - effectiveLastSeen > trackTtlMs) {
      aircraftById.delete(icao24);
      removed.push(icao24);
    }
  }
  return removed;
}

async function pollOpenSky() {
  if (polling) return;
  polling = true;
  const startedAt = Date.now();
  lastFetchAt = new Date(startedAt).toISOString();

  try {
    const result = await openSky.getStates();
    const fetchedAt = Date.now();
    const states = Array.isArray(result.states) ? result.states : [];
    const changed = [];

    openSkyTime = result.time || null;

    for (const rawState of states) {
      const aircraft = normalizeState(rawState, fetchedAt);
      if (!aircraft) continue;

      const previous = aircraftById.get(aircraft.icao24);
      // Retain last known coordinates if a new vector lacks position.
      if (!aircraft.hasPosition && previous?.hasPosition) {
        aircraft.latitude = previous.latitude;
        aircraft.longitude = previous.longitude;
        aircraft.hasPosition = true;
      }
      aircraftById.set(aircraft.icao24, aircraft);
      if (aircraft.hasPosition) changed.push(aircraft);
    }

    const removed = pruneExpired(fetchedAt);
    lastSuccessAt = new Date(fetchedAt).toISOString();
    lastError = null;

    const update = {
      type: "update",
      source: "OpenSky Network",
      generatedAt: lastSuccessAt,
      openSkyTime,
      aircraft: changed,
      removed,
      count: [...aircraftById.values()].filter((a) => a.hasPosition).length,
      bounds
    };

    io.emit("surveillance:update", update);
    io.emit("surveillance:status", {
      connected: true, lastSuccessAt, lastError: null, pollIntervalMs
    });

    if (logSummary) {
      console.log(`[OpenSky] ${states.length} vectors; ${update.count} tracked; ${removed.length} expired; ${Date.now() - startedAt}ms`);
    }
  } catch (error) {
    lastError = {
      message: error.message,
      status: error.status || null,
      retryAfterSeconds: error.retryAfterSeconds || null,
      at: new Date().toISOString()
    };
    console.error("[OpenSky]", error.message);

    io.emit("surveillance:status", {
      connected: false, lastSuccessAt, lastError, pollIntervalMs
    });

    // On a rate limit, honor OpenSky's suggested retry time.
    if (error.status === 429 && error.retryAfterSeconds) {
      nextPollDelayMs = Math.max(error.retryAfterSeconds * 1000, pollIntervalMs);
    }
  } finally {
    polling = false;
  }
}

function scheduleNextPoll() {
  clearTimeout(pollTimer);
  const delay = nextPollDelayMs;
  nextPollDelayMs = pollIntervalMs;
  pollTimer = setTimeout(async () => {
    await pollOpenSky();
    scheduleNextPoll();
  }, delay);
}

server.listen(port, async () => {
  console.log(`ATC surveillance backend listening on http://localhost:${port}`);
  console.log(`OpenSky mode: ${authenticated ? "OAuth2 authenticated" : "anonymous (very limited credits)"}`);
  console.log(`Polling every ${Math.round(pollIntervalMs / 1000)}s; bounds:`, bounds);
  await pollOpenSky();
  scheduleNextPoll();
});

function shutdown() {
  clearTimeout(pollTimer);
  io.close();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
