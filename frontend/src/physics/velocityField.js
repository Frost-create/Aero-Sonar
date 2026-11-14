// velocityField.js

/**
 * Calculates Burnham-Hallock tangential velocity magnitude
 * v_θ(r) = (Γ / 2πr) * [r² / (r² + rc²)]
 */
function burnhamHallockMagnitude(gamma, rc, r) {
  if (r < 1e-4) return 0.0; // Core eye singularity protection
  return (gamma / (2 * Math.PI * r)) * ((r * r) / (r * r + rc * rc));
}

/**
 * Calculates net wind vector [vx, vy, vz] at an evaluation point (y, z)
 */
export function getVortexInducedWind(pointY, pointZ, system, currentGamma) {
  const rc = system.baseline.rc;

  // 1. Vector from Left Core (Counter-Clockwise Vortex: +Γ)
  const dyL = pointY - system.leftCore.y;
  const dzL = pointZ - system.leftCore.z;
  const rL = Math.sqrt(dyL * dyL + dzL * dzL);
  const vThetaL = burnhamHallockMagnitude(currentGamma, rc, rL);

  // CCW decomposition: vy = -v_θ * (dz/r), vz = +v_θ * (dy/r)
  const vy_L = rL > 1e-4 ? -vThetaL * (dzL / rL) : 0;
  const vz_L = rL > 1e-4 ? +vThetaL * (dyL / rL) : 0;

  // 2. Vector from Right Core (Clockwise Vortex: -Γ)
  const dyR = pointY - system.rightCore.y;
  const dzR = pointZ - system.rightCore.z;
  const rR = Math.sqrt(dyR * dyR + dzR * dzR);
  const vThetaR = burnhamHallockMagnitude(currentGamma, rc, rR);

  // CW decomposition: vy = +v_θ * (dz/r), vz = -v_θ * (dy/r)
  const vy_R = rR > 1e-4 ? +vThetaR * (dzR / rR) : 0;
  const vz_R = rR > 1e-4 ? -vThetaR * (dyR / rR) : 0;

  // 3. Superposition with ambient crosswind
  const totalVy = vy_L + vy_R + system.aircraft.ambientCrosswindY;
  const totalVz = vz_L + vz_R;
  const totalMagnitude = Math.sqrt(totalVy * totalVy + totalVz * totalVz);

  return {
    vy: totalVy,
    vz: totalVz,
    speed: totalMagnitude
  };
}