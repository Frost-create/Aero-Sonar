import test from "node:test";
import assert from "node:assert/strict";
import { createAtcAgentResponse } from "./atcAgent.js";
import { buildDemoFlights } from "./liveFlights.js";

test("advisory response flags modeled limited spacing", () => {
  const response = createAtcAgentResponse({
    lead_category: "SUPER",
    follower_category: "MEDIUM",
    separation_nm: 4,
    crosswind_kts: 8,
    offline_edge_mode: false
  });

  assert.equal(response.mode, "SIMULATION_DECISION_SUPPORT");
  assert.equal(response.recommended_lateral_offset_m, 50);
  assert.equal(response.recommended_altitude_offset_ft, 180);
  assert.ok(Array.isArray(response.tool_trace));
});

test("advisory response returns zero offsets when inputs are outside modeled concern", () => {
  const response = createAtcAgentResponse({
    lead_category: "MEDIUM",
    follower_category: "MEDIUM",
    separation_nm: 8,
    crosswind_kts: 10,
    offline_edge_mode: true
  });

  assert.equal(response.recommended_lateral_offset_m, 0);
  assert.equal(response.recommended_altitude_offset_ft, 0);
});

test("invalid advisory input is rejected", () => {
  assert.throws(
    () =>
      createAtcAgentResponse({
        lead_category: "UNKNOWN",
        follower_category: "MEDIUM",
        separation_nm: 2,
        crosswind_kts: 3,
        offline_edge_mode: false
      }),
    /lead_category/
  );
});

test("demo flight enrichment preserves observed fields and stays stable", () => {
  const observedAircraft = [
    {
      icao24: "a0c412",
      callsign: "UAL863",
      hasPosition: true,
      latitude: 37.586,
      longitude: -122.332,
      groundspeedKt: 148
    }
  ];

  const first = buildDemoFlights(observedAircraft, "KSFO");
  const second = buildDemoFlights(observedAircraft, "KSFO");

  assert.equal(first.length, 1);
  assert.equal(first[0].callsign, "UAL863");
  assert.equal(first[0].speedKts, 148);
  assert.equal(first[0].isEstimated, true);
  assert.deepEqual(first, second);
});
