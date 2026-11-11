// Lap and checkpoint logic, sectors, live delta and track limits.

import { RULES } from "../rules";

export const TOTAL_LAPS = RULES.laps;
export const SECTOR_BOUNDS = [1 / 3, 2 / 3];
const TRACE_BINS = 200;

// Track limits, F1-style: the whole car beyond the white line is one strike.
// The number of warnings before a lap is deleted is RULES.trackLimitWarnings (rules.js).
export const TRACK_LIMITS = {
  // The car's centre must be this far past the track edge for all four wheels to be
  // over the line (wheels' inner edges sit ~0.6 m from the centre).
  margin: 0.6,
};

export function createLapTracker() {
  return {
    lap: 1,
    time: 0,
    currentLapTime: 0,
    bestLapTime: null,
    lastLapTime: null,
    lastU: 0,
    checkpointsPassed: new Set([0]),
    topSpeed: 0,
    sector: 0,
    sectorStart: 0,
    sectorTimes: [null, null, null],
    bestSectors: [null, null, null],
    lapStartBestSectors: [null, null, null], // to roll back sectors of a deleted lap
    trace: new Float32Array(TRACE_BINS).fill(-1),
    bestTrace: null,
    delta: null, // seconds vs best lap at the same point, null until a best exists
    lapEvents: 0, // increments on every completed lap (for HUD toasts)
    lapTimes: [], // completed lap times, in order
    lapValid: [], // matches lapTimes: false when the lap was deleted for track limits
    lastSector: null, // { index, time, delta } for the most recently completed sector
    lastLapWasBest: false,
    lastLapDeleted: false,
    onGrid: true, // behind the line at the start, before first crossing it
    // Track limits for the lap in progress.
    strikes: 0,
    lapDeleted: false,
    limitsArmed: true, // re-armed once the car is back on track
    limitEvents: 0, // increments on every strike (for HUD warnings)
    finished: false,
  };
}

/**
 * Advance timers and detect checkpoints, laps and track-limit strikes.
 * input: { u, speed, dt, checkpoints, offset?, halfWidth?, warnings? } where offset is
 * the car centre's distance from the centreline, halfWidth the track's half width, and
 * warnings how many strikes per lap are let off before the lap is deleted
 * (null = track limits off).
 * Returns { lapCompleted, finished, results, strike } for the step.
 */
export function stepLapTracker(
  t,
  { u, speed, dt, checkpoints, offset = 0, halfWidth = Infinity, warnings = RULES.trackLimitWarnings },
) {
  const strikesToDelete = warnings + 1;
  t.time += dt;
  t.currentLapTime += dt;
  if (speed > t.topSpeed) t.topSpeed = speed;
  const out = { lapCompleted: false, finished: false, results: null, strike: false };
  if (t.finished) return out;

  // ---- Track limits ------------------------------------------------------
  const beyond = warnings != null && offset > halfWidth + TRACK_LIMITS.margin;
  if (beyond && t.limitsArmed) {
    t.limitsArmed = false;
    t.strikes += 1;
    t.limitEvents += 1;
    out.strike = true;
    if (t.strikes >= strikesToDelete && !t.lapDeleted) {
      t.lapDeleted = true;
      // Sectors already set as bests earlier in this lap don't count either.
      t.bestSectors = [...t.lapStartBestSectors];
    }
  } else if (!beyond && offset <= halfWidth) {
    t.limitsArmed = true;
  }

  for (const cp of checkpoints) {
    const diff = Math.abs(u - cp.u);
    if (diff < 0.06 || diff > 0.94) t.checkpointsPassed.add(cp.id);
  }

  const completeSector = (index, split) => {
    const prevBest = t.bestSectors[index];
    t.lastSector = { index, time: split, delta: prevBest == null ? null : split - prevBest };
    t.sectorTimes[index] = split;
    // A deleted lap can't set a best sector.
    if (!t.lapDeleted && (prevBest == null || split < prevBest)) t.bestSectors[index] = split;
  };

  // The session starts from a grid box just behind the line (u close to 1). Until the
  // car crosses the line there are no sectors or delta trace to record.
  if (t.onGrid) {
    if (u < 0.5) t.onGrid = false;
    else {
      t.lastU = u;
      return out;
    }
  }

  // Sector splits (display only; lap validity still comes from checkpoints).
  const sector = u < SECTOR_BOUNDS[0] ? 0 : u < SECTOR_BOUNDS[1] ? 1 : 2;
  if (sector === t.sector + 1) {
    completeSector(t.sector, t.currentLapTime - t.sectorStart);
    t.sector = sector;
    t.sectorStart = t.currentLapTime;
  }

  // Live delta: time at each point of the lap vs the best lap.
  const bin = Math.min(TRACE_BINS - 1, Math.floor(u * TRACE_BINS));
  if (t.trace[bin] < 0) t.trace[bin] = t.currentLapTime;
  t.delta = t.bestTrace && t.bestTrace[bin] >= 0 && t.currentLapTime > 1 ? t.currentLapTime - t.bestTrace[bin] : null;

  const crossedLine = t.lastU > 0.85 && u < 0.15;
  if (crossedLine && t.checkpointsPassed.size >= 6 && t.currentLapTime > 8.0 && speed > 5) {
    const lapTime = t.currentLapTime;
    if (t.sector === 2) completeSector(2, lapTime - t.sectorStart);
    const valid = !t.lapDeleted;
    t.lastLapDeleted = !valid;
    t.lastLapWasBest = valid && (!t.bestLapTime || lapTime < t.bestLapTime);
    t.lapTimes.push(lapTime);
    t.lapValid.push(valid);
    if (t.lastLapWasBest) {
      t.bestTrace = Float32Array.from(t.trace);
      t.bestLapTime = lapTime;
    }
    t.lastLapTime = lapTime;
    t.trace.fill(-1);
    t.lapEvents += 1;
    // Fresh slate for the next lap.
    t.strikes = 0;
    t.lapDeleted = false;
    t.lapStartBestSectors = [...t.bestSectors];
    if (t.lap >= TOTAL_LAPS) {
      t.finished = true;
      out.finished = true;
      out.results = {
        totalTime: t.time,
        bestLap: t.bestLapTime, // null if every lap was deleted
        topSpeed: Math.round(t.topSpeed * 3.6),
        deletedLaps: t.lapValid.filter((v) => !v).length,
      };
    } else {
      t.currentLapTime = 0;
      t.lap += 1;
      t.checkpointsPassed.clear();
      t.checkpointsPassed.add(0);
      out.lapCompleted = true;
    }
    t.sector = 0;
    t.sectorStart = 0;
  } else if (crossedLine) {
    // Crossed the line without a valid lap (cut or reset): restart sector timing.
    t.sector = 0;
    t.sectorStart = t.currentLapTime;
  }

  t.lastU = u;
  return out;
}
