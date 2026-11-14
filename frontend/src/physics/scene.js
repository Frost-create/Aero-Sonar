// scene.js (Three.js Render Loop)
import * as THREE from 'three';
import { leadAircraftState, followerAircraftState } from './simulationState.js';
import { WakeVortexSystem } from './vortexDynamics.js';
import { getVortexInducedWind } from './velocityField.js';

// Setup simulation instance
const wakeSystem = new WakeVortexSystem(leadAircraftState);

// Particle buffer (e.g., 3000 particles)
const PARTICLE_COUNT = 3000;
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);

// Animation Tick
export function animateFrame(deltaTime) {
  // 1. Advance vortex system physics
  const { gamma_t } = wakeSystem.update(deltaTime);

  // 2. Advect each particle: pos_new = pos_old + velocity * dt
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const idx = i * 3;
    const py = positions[idx + 1]; // Y is lateral
    const pz = positions[idx + 2]; // Z is altitude

    const wind = getVortexInducedWind(py, pz, wakeSystem, gamma_t);

    // Update positions
    positions[idx + 1] += wind.vy * deltaTime;
    positions[idx + 2] += wind.vz * deltaTime;

    // Color particles dynamically based on velocity magnitude (Heatmap)
    // Red for severe shear (>10 m/s), Yellow for moderate (>4 m/s), Blue for safe
    if (wind.speed > 10.0) {
      colors[idx] = 1.0; colors[idx + 1] = 0.1; colors[idx + 2] = 0.1; // Red
    } else if (wind.speed > 4.0) {
      colors[idx] = 1.0; colors[idx + 1] = 0.8; colors[idx + 2] = 0.0; // Yellow
    } else {
      colors[idx] = 0.2; colors[idx + 1] = 0.5; colors[idx + 2] = 1.0; // Blue
    }
  }

  // 3. Mark Three.js geometry buffers as needing update
  // particleGeometry.attributes.position.needsUpdate = true;
  // particleGeometry.attributes.color.needsUpdate = true;
}