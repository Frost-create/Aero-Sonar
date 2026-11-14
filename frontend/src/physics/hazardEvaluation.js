// hazardEvaluation.js
export function evaluateFollowerHazard(followerPosY, followerPosZ, system, currentGamma, followerAircraft) {
  const halfSpan = followerAircraft.wingspan / 2;

  // Sample vertical velocity at left and right wingtips
  const leftWingWind = getVortexInducedWind(followerPosY - halfSpan, followerPosZ, system, currentGamma);
  const rightWingWind = getVortexInducedWind(followerPosY + halfSpan, followerPosZ, system, currentGamma);

  // Asymmetric differential vertical airflow across wingspan
  const deltaVz = rightWingWind.vz - leftWingWind.vz;

  // Induced roll rate: p_induced = Δvz / b_follower (rad/s)
  const inducedRollRate = Math.abs(deltaVz / followerAircraft.wingspan);

  // Roll-to-Damping Induced Ratio: RDIR = p_induced / p_max
  const rdir = inducedRollRate / followerAircraft.maxRollRateAuthority;

  let hazardLevel = 'SAFE';
  if (rdir >= 1.0) {
    hazardLevel = 'CRITICAL DANGER: ROLL UPSET (Control Exceeded)';
  } else if (rdir >= 0.5) {
    hazardLevel = 'HIGH RISK: SEVERE BUFFETING';
  } else if (rdir >= 0.2) {
    hazardLevel = 'MODERATE CAUTION';
  }

  return { inducedRollRate, rdir, hazardLevel };
}