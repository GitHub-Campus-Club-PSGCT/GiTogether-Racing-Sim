// Session rules. Change them here; the sim, HUD and menus all read from this file.
export const RULES = {
  // Laps in a session.
  laps: 5,
  // Track-limit warnings per lap. Every time the whole car crosses the white line is a
  // strike; this many strikes are let off with a warning and the next one deletes the
  // lap time (it still counts towards the session, but not for best lap or sectors).
  // 0 = the first strike deletes the lap. null = track limits off.
  trackLimitWarnings: 5,
};
