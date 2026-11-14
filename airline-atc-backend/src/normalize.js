// OpenSky state vector array indexes:
// 0 icao24, 1 callsign, 2 origin_country, 3 time_position, 4 last_contact,
// 5 longitude, 6 latitude, 7 baro_altitude(m), 8 on_ground, 9 velocity(m/s),
// 10 true_track(deg), 11 vertical_rate(m/s), 12 sensors, 13 geo_altitude(m),
// 14 squawk, 15 spi, 16 position_source.
const metersToFeet = (m) => (m == null ? null : Math.round(m * 3.28084));
const metersPerSecondToKnots = (v) => (v == null ? null : Math.round(v * 1.943844));
const metersPerSecondToFpm = (v) => (v == null ? null : Math.round(v * 196.8504));

export function normalizeState(state, fetchedAt) {
  if (!Array.isArray(state) || state.length < 17) return null;

  const [
    icao24, rawCallsign, originCountry, timePosition, lastContact,
    longitude, latitude, baroAltitudeM, onGround, velocityMps,
    headingDeg, verticalRateMps, _sensors, geoAltitudeM, squawk,
    spi, positionSource
  ] = state;

  if (!icao24) return null;

  const hasPosition = Number.isFinite(latitude) && Number.isFinite(longitude);

  return {
    icao24: String(icao24).toLowerCase(),
    callsign: String(rawCallsign || "").trim() || null,
    originCountry: originCountry || null,

    // Coordinates are null when OpenSky has no current position.
    latitude: hasPosition ? latitude : null,
    longitude: hasPosition ? longitude : null,
    hasPosition,

    baroAltitudeM: Number.isFinite(baroAltitudeM) ? baroAltitudeM : null,
    baroAltitudeFt: metersToFeet(baroAltitudeM),
    geoAltitudeM: Number.isFinite(geoAltitudeM) ? geoAltitudeM : null,
    geoAltitudeFt: metersToFeet(geoAltitudeM),

    onGround: Boolean(onGround),
    velocityMps: Number.isFinite(velocityMps) ? velocityMps : null,
    groundspeedKt: metersPerSecondToKnots(velocityMps),
    headingDeg: Number.isFinite(headingDeg) ? headingDeg : null,
    verticalRateMps: Number.isFinite(verticalRateMps) ? verticalRateMps : null,
    verticalRateFpm: metersPerSecondToFpm(verticalRateMps),

    squawk: squawk || null,
    spi: Boolean(spi),
    positionSource,
    timePosition: timePosition || null,
    lastContact: lastContact || null,
    fetchedAt: new Date(fetchedAt).toISOString()
  };
}
