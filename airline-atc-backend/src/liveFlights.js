export const AIRPORT_CENTERS = {
  EGLL: { latitude: 51.47, longitude: -0.4543 },
  KJFK: { latitude: 40.6413, longitude: -73.7781 },
  KSFO: { latitude: 37.6213, longitude: -122.379 },
  OMDB: { latitude: 25.2532, longitude: 55.3657 },
  RJTT: { latitude: 35.5494, longitude: 139.7798 },
  VIDP: { latitude: 28.5562, longitude: 77.1 }
};

const runwayOptions = {
  EGLL: ["27L", "27R", "09L", "09R"],
  KJFK: ["31L", "31R", "13L", "13R", "04L", "04R", "22L", "22R"],
  KSFO: ["28R", "28L", "01R", "01L"],
  OMDB: ["30R", "30L", "12R", "12L"],
  RJTT: ["34L", "34R", "16L", "16R"],
  VIDP: ["29R", "29L", "11R", "11L"]
};

const typesByWakeClass = {
  SUPER: ["A388", "B748"],
  HEAVY: ["B77W", "B789", "B763"],
  MEDIUM: ["A320", "A321", "B738", "B38M"]
};

const separationByWakeClass = {
  SUPER: 6,
  HEAVY: 5,
  MEDIUM: 3
};

const estimatedFields = [
  "acType",
  "wakeClass",
  "opType",
  "runway",
  "arrivalMinutes",
  "icaoSepNm"
];

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function choose(values, seed, offset = 0) {
  return values[(seed + offset) % values.length];
}

export function distanceNm(from, to) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = radians(to.longitude - from.longitude);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 3440.065 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function buildDemoFlights(aircraft, airport) {
  const center = AIRPORT_CENTERS[airport];
  if (!center) return [];

  return aircraft
    .filter((item) => item.hasPosition && item.latitude != null && item.longitude != null)
    .filter((item) => distanceNm(center, { latitude: item.latitude, longitude: item.longitude }) <= 100)
    .map((item) => {
      const callsign = item.callsign || item.icao24;
      const seed = stableHash(`${airport}:${item.icao24}`);
      const wakeClass = choose(["SUPER", "HEAVY", "MEDIUM"], seed);
      const hasObservedSpeed = Number.isFinite(item.groundspeedKt) && item.groundspeedKt > 0;
      const speedKts = hasObservedSpeed ? item.groundspeedKt : 130 + (seed % 91);
      const flightEstimatedFields = hasObservedSpeed
        ? estimatedFields
        : [...estimatedFields, "speedKts"];

      return {
        callsign,
        acType: choose(typesByWakeClass[wakeClass], seed, 1),
        wakeClass,
        opType: choose(["ARR", "DEP"], seed, 2),
        runway: choose(runwayOptions[airport], seed, 3),
        arrivalMinutes: Math.round((1 + (seed % 141) / 10) * 10) / 10,
        speedKts,
        icaoSepNm: separationByWakeClass[wakeClass],
        isEstimated: true,
        estimatedFields: flightEstimatedFields
      };
    })
    .sort((a, b) => a.arrivalMinutes - b.arrivalMinutes);
}
