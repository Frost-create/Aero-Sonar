// vortexPhysics.js
import { CONSTANTS } from './constants.js';

export function calculateBaselineVortexProperties(aircraft) {
  // 1. Initial vortex spacing: b₀ = (π / 4) * b
  const b0 = CONSTANTS.SPACING_FACTOR * aircraft.wingspan;

  // 2. Viscous core radius: r_c ≈ 0.04 * b
  const rc = CONSTANTS.CORE_RADIUS_RATIO * aircraft.wingspan;

  // 3. Initial circulation strength: Γ₀ = (M * g) / (ρ * V * b₀)
  const gamma0 = (aircraft.mass * CONSTANTS.GRAVITY) /
                 (CONSTANTS.AIR_DENSITY_ISA * aircraft.takeoffSpeed * b0);

  // 4. Initial mutual downward sink velocity: w₀ = Γ₀ / (2π * b₀)
  const w0 = gamma0 / (2 * Math.PI * b0);

  return { b0, rc, gamma0, w0 };
}