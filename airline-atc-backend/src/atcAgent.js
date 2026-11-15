const wakeSeparationNm = {
  SUPER: 6,
  HEAVY: 5,
  MEDIUM: 3
};

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

export function createAtcAgentResponse(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Request body must be a JSON object.");
  }

  const { lead_category, follower_category, separation_nm, crosswind_kts, offline_edge_mode } = input;
  if (!Object.hasOwn(wakeSeparationNm, lead_category)) {
    throw new TypeError("lead_category must be SUPER, HEAVY, or MEDIUM.");
  }
  if (!Object.hasOwn(wakeSeparationNm, follower_category)) {
    throw new TypeError("follower_category must be SUPER, HEAVY, or MEDIUM.");
  }
  if (!isFiniteNumber(separation_nm) || separation_nm < 0) {
    throw new TypeError("separation_nm must be a non-negative number.");
  }
  if (!isFiniteNumber(crosswind_kts) || crosswind_kts < 0) {
    throw new TypeError("crosswind_kts must be a non-negative number.");
  }
  if (typeof offline_edge_mode !== "boolean") {
    throw new TypeError("offline_edge_mode must be a boolean.");
  }

  const requiredSeparationNm = wakeSeparationNm[lead_category];
  const separationBelowCategoryMinimum = separation_nm < requiredSeparationNm;
  const lowCrosswindWithLimitedSpacing =
    crosswind_kts < 5 && separation_nm < requiredSeparationNm + 1;
  const modeledConcern = separationBelowCategoryMinimum || lowCrosswindWithLimitedSpacing;

  return {
    mode: "SIMULATION_DECISION_SUPPORT",
    tool_trace: [
      `[PAIR] ${lead_category} lead vs ${follower_category} follower`,
      `[INPUT] Separation=${separation_nm} NM; crosswind=${crosswind_kts} kt`,
      `[MODEL] ${modeledConcern ? "Modeled spacing/wake concern" : "No concern from supplied inputs"}`,
      `[MODE] Offline edge mode ${offline_edge_mode ? "enabled" : "disabled"}`
    ],
    recommended_lateral_offset_m: modeledConcern ? 50 : 0,
    recommended_altitude_offset_ft: modeledConcern ? 180 : 0
  };
}
