// vortexDynamics.js
import { CONSTANTS } from './constants.js';

export class WakeVortexSystem {
  constructor(aircraft) {
    this.aircraft = aircraft;
    this.baseline = calculateBaselineVortexProperties(aircraft);

    // Initial 3D positions [x, y, z]
    // x = along runway, y = cross-track (lateral), z = altitude above ground
    this.leftCore = {
      y: -this.baseline.b0 / 2,
      z: aircraft.initialAltitude
    };
    this.rightCore = {
      y: this.baseline.b0 / 2,
      z: aircraft.initialAltitude
    };
    this.elapsedTime = 0;
  }
  // Update core circulation and spatial positions for a time delta dt
  update(dt) {
    this.elapsedTime += dt;

    // 1. Circulation decay: Γ(t) = Γ₀ * exp(-t / τ)
    const gamma_t = this.baseline.gamma0 * Math.exp(-this.elapsedTime / this.aircraft.decayTau);

    // 2. Instantaneous sinking speed: w(t) = Γ(t) / (2π * b₀)
    const currentSinkSpeed = gamma_t / (2 * Math.PI * this.baseline.b0);

    // 3. Ground effect transition (Method of Images)
    const groundThreshold = this.baseline.b0 * CONSTANTS.GROUND_HEIGHT_RATIO;

    if (this.leftCore.z > groundThreshold) {
      // Normal sinking in free air
      this.leftCore.z -= currentSinkSpeed * dt;
      this.rightCore.z -= currentSinkSpeed * dt;
    } else {
      // Ground bounce: vertical descent halts; cores diverge laterally
      const lateralDriftSpeed = currentSinkSpeed; // Divergence rate ≈ w(t)
      this.leftCore.y -= lateralDriftSpeed * dt;   // Drifts outward left
      this.rightCore.y += lateralDriftSpeed * dt;  // Drifts outward right
      this.leftCore.z = Math.max(groundThreshold, this.leftCore.z);
      this.rightCore.z = Math.max(groundThreshold, this.rightCore.z);
    }

    return { gamma_t, currentSinkSpeed };
  }
}