// simulationState.js
export const leadAircraftState = {
  mass: 280000,             // M (kg) - Heavy aircraft (e.g., B777)
  takeoffSpeed: 80.0,       // V (m/s) - Liftoff speed (~155 kts)
  wingspan: 64.8,           // b (m)
  decayTau: 45.0,           // τ (s) - Atmospheric decay time constant (30s-90s)
  initialAltitude: 50.0,    // Initial z altitude above runway (m)
  ambientCrosswindY: 0.0    // Ambient crosswind component along runway width (m/s)
};

export function createScaledAircraftState(aircraft, scale = 1, ambientCrosswindY = aircraft.ambientCrosswindY) {
  return {
    ...aircraft,
    mass: aircraft.mass * scale,
    wingspan: aircraft.wingspan * scale,
    ambientCrosswindY
  };
}

export const followerAircraftState = {
  wingspan: 34.0,           // b_follower (m) - Medium category (e.g., A320)
  speed: 70.0,              // V_follower (m/s)
  maxRollRateAuthority: 0.26 // p_max (rad/s) - Max aileron roll authority (~15 deg/s)
};