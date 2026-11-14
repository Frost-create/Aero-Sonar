// constants.js
export const CONSTANTS = {
  GRAVITY: 9.80665,         // g (m/s²) - Standard gravitational acceleration
  AIR_DENSITY_ISA: 1.225,   // ρ (kg/m³) - ISA sea-level air density
  SPACING_FACTOR: Math.PI / 4, // π/4 ≈ 0.785398 (Elliptic lift load factor)
  CORE_RADIUS_RATIO: 0.04,  // Typical viscous core radius (3% to 5% of wingspan)
  GROUND_HEIGHT_RATIO: 1.0  // Height where ground effect halts sinking (~b₀)
};