import { describe, it, expect } from "vitest";
import { GRANDSTANDS, PIT, MOTORHOMES, FLOODLIGHTS, MARSHAL_POSTS, BRAKE_BOARDS, CLEARANCE, minTrackDistance } from "./layout.js";
import { computeTrees, buildTerrainData, TERRAIN_SEGMENTS } from "../world/worldBuild.js";

const TREES = computeTrees();
import { projectToTrack, BARRIER_OFFSET } from "../../circuitDefinition.js";

describe("scenery layout keeps clear of the circuit", () => {
  it("grandstands and buildings sit behind the barriers", () => {
    for (const item of [...GRANDSTANDS, PIT.building, PIT.control, ...MOTORHOMES]) {
      const d = minTrackDistance(item);
      expect(d, item.id ?? JSON.stringify(item)).toBeGreaterThan(CLEARANCE);
    }
  });

  it("small trackside items are outside the barriers", () => {
    for (const item of [...FLOODLIGHTS, ...MARSHAL_POSTS, ...BRAKE_BOARDS]) {
      expect(projectToTrack(item.x, item.z).absDistance).toBeGreaterThan(BARRIER_OFFSET + 0.6);
    }
  });

  it("places brake boards before corners and a few thousand trees", () => {
    expect(BRAKE_BOARDS.length).toBeGreaterThanOrEqual(6);
    expect(BRAKE_BOARDS.length % 3).toBe(0);
    expect(TREES.length).toBeGreaterThan(800);
    expect(TREES.length).toBeLessThan(9000);
    for (const t of TREES) expect(projectToTrack(t.x, t.z).absDistance).toBeGreaterThan(25);
  });
});

it("reports layout counts", () => {
  console.log(`layout: ${TREES.length} trees, ${BRAKE_BOARDS.length} brake boards, ${FLOODLIGHTS.length} floodlights, ${MARSHAL_POSTS.length} marshal posts`);
});

it("builds terrain data with unit normals", () => {
  const t = buildTerrainData();
  const n = TERRAIN_SEGMENTS + 1;
  expect(t.positions.length).toBe(n * n * 3);
  expect(t.indices.length).toBe(TERRAIN_SEGMENTS * TERRAIN_SEGMENTS * 6);
  for (let k = 0; k < t.normals.length; k += 3 * 997) {
    expect(Math.hypot(t.normals[k], t.normals[k + 1], t.normals[k + 2])).toBeCloseTo(1, 4);
    expect(t.normals[k + 1]).toBeGreaterThan(0);
  }
});
