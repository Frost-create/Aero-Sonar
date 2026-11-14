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
- `GET /api/config` - units, poll interval, and geographic bounds

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
