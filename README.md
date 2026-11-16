# Aero-Sonar
** Winner: Best UI/UX — UCSC DevFest (Sponsored by Google)**

An interactive 3D aviation safety simulation and live Air Traffic Control (ATC) dashboard designed to visualize aircraft wake turbulence, prevent runway hazards, and safely maximize airport takeoff capacity.

---

## Overview
When an aircraft takes off, it generates powerful, invisible spiraling wind vortices off its wingtips (wake turbulence) that can pose a severe danger to trailing aircraft. Currently, Air Traffic Controllers rely on strict, static time intervals between takeoffs to keep planes safe—often leading to unnecessary runway delays when weather conditions are favorable.

**Areo-Sonar** bridges the gap between complex aerodynamic physics and intuitive air traffic management. By combining real-time 3D particle simulations, live flight tracking, and AI-driven risk analysis, our platform empowers ATC operators to make data-backed decisions that increase flight throughput without compromising safety.

---

## Key Features

### Interactive 3D Wake Vortex Simulation
* **Physics-Driven Particle System:** Uses aerodynamic and fluid dynamics formulas to render 3D particles spiraling off an aircraft's wingtips during takeoff.
* **Color-Coded Velocity Mapping:** Particles dynamically shift color based on wind speed and turbulence intensity:
  * 🔴 **Red:** Extreme wind speeds (High danger zone)
  * 🟡 **Yellow:** Moderate turbulence (Caution zone)
  * 🔵 **Blue:** Safe wind speeds (Clear for takeoff)
* **Real-Time Parameter Sliders:** Users can adjust **wind speed**, **wind direction**, **aircraft size/weight**, and **trailing aircraft distance** to immediately observe how changing conditions impact wake decay and trailing plane safety.

### Air Traffic Control (ATC) View & Live Flight Tracking
* **Runway Radar Dashboard:** Features a dedicated ATC perspective simulating active flight arrivals and departures.
* **Live Flight Data Integration:** Connects to live aviation tracking data to display real-time takeoffs and landings at specific runways.

### Gemini AI Safety Analyst
* **Contextual Risk Assessment:** Integrated **Google Gemini AI** directly into the simulation engine.
* **Actionable Insights:** Analyzes current simulation variables—including aircraft weight, wind speed, crosswind direction, and separation distance—to generate specialized safety briefings on whether a trailing aircraft is at risk of encountering hazardous wake turbulence.

---
## Team
* **Angelina Di Saia** (https://github.com/Frost-create) — Frontend & UI/UX
* **Neola Pinto** (https://github.com/neolapinto) — Frontend & UI/UX
* **Mahii Shah** (https://github.com/mahiishah-code) — Frontend & UI/UX
*  **Siddhesh Kukade** (https://github.com/SiddheshKukade) - Backend and Code Mentor
---
# Aero-Sonar Frontend
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

---
# Airline ATC Surveillance Backend

Node.js backend that polls OpenSky Network state vectors and streams aircraft updates to a React frontend over Socket.IO.

This is a **situational-awareness / visualization feed**, not a certified ATC system. Do not use it for separation, clearances, navigation, or any operational aviation decision.

## Requirements

- Node.js 20+
- OpenSky account and API client credentials (recommended)
- React app (Vite or another React setup) for the frontend example

## 1. Configure OpenSky

1. Sign in to your OpenSky Network account.
2. Create an API client and copy its `client_id` and `client_secret`.
3. Copy `.env.example` to `.env`.
4. Add the credentials:

```env
OPENSKY_CLIENT_ID=your-client-id
OPENSKY_CLIENT_SECRET=your-client-secret
```

Do not put these credentials in React, commit `.env`, or expose them to the browser.

The backend uses OAuth2 client credentials and refreshes access tokens automatically.

## 2. Install and run

```bash
npm install
cp .env.example .env
# Edit .env and add your OpenSky credentials
npm run dev
```

The server starts at `http://localhost:3001`.

Useful endpoints:

- `GET /health` - backend and upstream status
- `GET /api/aircraft` - latest aircraft snapshot
- `GET /api/live-flights?airport=KSFO` - OpenSky aircraft near the requested airport and flight-queue availability
- `POST /api/atc-agent` - deterministic simulation-only advisory for the supplied pair
- `GET /api/weather?airport=KSFO` - Aviation Weather METAR response
- `GET /api/config` - units, poll interval, and geographic bounds

`/api/live-flights` returns tracked OpenSky aircraft in its `aircraft` property and a demo flight queue in `flights`. Callsign and groundspeed come from observed data when available. Aircraft type, wake category, operation type, runway, arrival time, and separation value are stable pseudo-random demo values per aircraft and airport; each flight has `isEstimated: true` and `estimatedFields` to identify them. The response has `dataQuality: "MIXED_ACTUAL_AND_DEMO"`. These values are for visualization only and must not be used for real-world separation, clearance, navigation, or control.

`/api/atc-agent` is a deterministic demonstration heuristic, not a Gemini integration or operational advice. It accepts JSON fields `lead_category`, `follower_category` (`SUPER`, `HEAVY`, or `MEDIUM`), `separation_nm`, `crosswind_kts`, and `offline_edge_mode`. Do not use its offsets for real-world separation or control.

Example request:

```json
{
  "lead_category": "SUPER",
  "follower_category": "MEDIUM",
  "separation_nm": 4.1,
  "crosswind_kts": 4.2,
  "offline_edge_mode": false
}
```

## 3. Connect React

Install the client in your React app:

```bash
npm install socket.io-client
```

Copy `examples/ReactSurveillanceFeed.jsx` into your React app and import `useSurveillanceFeed` or `AircraftList`.

Set the frontend environment variable if the backend is not on localhost:

```env
VITE_ATC_BACKEND_URL=http://localhost:3001
```

### Socket.IO events

- `surveillance:snapshot` - full current snapshot sent on connect
- `surveillance:update` - changed aircraft plus removed ICAO24 IDs
- `surveillance:status` - upstream polling and backend status

An aircraft object includes:
- `icao24`, `callsign`, `originCountry`
- `latitude`, `longitude`, `hasPosition`
- `baroAltitudeFt`, `geoAltitudeFt`
- `groundspeedKt`, `headingDeg`, `verticalRateFpm`
- `onGround`, `squawk`, `spi`
- `timePosition`, `lastContact`, `fetchedAt`

## 4. Set your radar coverage

The default bounding box is the San Francisco Bay Area. Change these values in `.env` to match the airspace you want to visualize:

```env
LAMIN=36.5
LAMAX=38.5
LOMIN=-123.5
LOMAX=-121.0
```

OpenSky bounding-box requests use latitude/longitude bounds. Smaller regional boxes generally cost fewer API credits than global queries.

## 5. Polling and API credits

The default polling interval is:
- Authenticated: 25 seconds
- Anonymous: 240 seconds

You can override it with `POLL_INTERVAL_MS`, but do not set an aggressive interval without checking your account's current OpenSky quota. The server has a minimum of 5 seconds when authenticated and 60 seconds anonymously, and honors the retry-after hint on HTTP 429 responses.

OpenSky's API is not a one-second radar feed. The API's state-vector resolution and quotas vary by authentication and account tier. Data availability depends on ADS-B receiver coverage; some aircraft may have no position, callsign, squawk, or other fields.

## ATC-style UI notes

For a controller-inspired layout, the frontend can use:
- Dark radar-scope background with range rings and a configurable center point
- Track symbols and short history trails (keep history in React or a separate track store)
- Target label: callsign, altitude, groundspeed, and vertical trend
- Selected-target details panel with ICAO24, squawk, country, last contact
- Flight strips sorted by callsign or selected sector
- A clear stale/disconnected indicator based on `lastSuccessAt`

OpenSky does **not** provide clearances, controller annotations, assigned headings/altitudes, coordination status, or authoritative flight plans through this endpoint. Those must be separately sourced or treated as user-entered simulation data.

## Notes

- All altitude values are converted from meters to feet.
- Groundspeed is converted from meters/second to knots.
- Vertical rate is converted from meters/second to feet/minute.
- Heading is degrees clockwise from true north.
- Position may be missing for some state vectors; the example React hook filters those out for map rendering.
