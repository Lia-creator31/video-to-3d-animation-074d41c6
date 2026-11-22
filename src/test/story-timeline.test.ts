import { describe, expect, it } from "vitest";

import {
  ANIMAL_SPECS,
  STORY_DURATION,
  STORY_SCENES,
  evaluateCoupleState,
  evaluateHeroButterflyProgress,
  getSceneIndexAt,
  wrapStoryTime,
} from "@/lib/story-timeline";

describe("3D Garden Story Timeline", () => {
  it("covers all 5 scenes continuously from 0s to STORY_DURATION", () => {
    expect(STORY_SCENES).toHaveLength(5);
    expect(STORY_SCENES[0]?.start).toBe(0);
    expect(STORY_SCENES[4]?.end).toBe(STORY_DURATION);
    for (let i = 1; i < STORY_SCENES.length; i++) {
      expect(STORY_SCENES[i]?.start).toBe(STORY_SCENES[i - 1]?.end);
    }
  });

  it("maps timestamps to the matching scene from walking through finale", () => {
    expect(getSceneIndexAt(0.5)).toBe(0); // Berjalan
    expect(getSceneIndexAt(4.8)).toBe(1); // Duduk di Bangku
    expect(getSceneIndexAt(8.5)).toBe(2); // Hewan Berdatangan
    expect(getSceneIndexAt(13.0)).toBe(3); // Kupu-Kupu Menari
    expect(getSceneIndexAt(16.8)).toBe(4); // Penutup
  });

  it("transitions couple from walking forward in Scene 1 to seated on bench in Scene 2", () => {
    const startWalk = evaluateCoupleState(0.2);
    const endWalk = evaluateCoupleState(3.8);
    const seated = evaluateCoupleState(5.8);

    expect(startWalk.walkOpacity).toBe(1);
    expect(startWalk.seatedOpacity).toBe(0);
    expect(endWalk.walkZ).toBeGreaterThan(startWalk.walkZ);
    expect(seated.walkOpacity).toBe(0);
    expect(seated.seatedOpacity).toBe(1);
    expect(seated.emptyBenchOpacity).toBe(0);
  });

  it("brings woodland animals in starting at the end of Scene 2 through Scene 3", () => {
    const earliest = Math.min(...ANIMAL_SPECS.map((a) => a.enterAt));
    const latest = Math.max(...ANIMAL_SPECS.map((a) => a.arriveAt));
    expect(earliest).toBeGreaterThanOrEqual(5.0);
    expect(latest).toBeLessThanOrEqual(STORY_SCENES[2]!.end);
  });

  it("keeps hero butterfly hidden early, enters in Scene 4, and approaches lens in Scene 5", () => {
    expect(evaluateHeroButterflyProgress(4.0).visible).toBe(false);
    const scene4 = evaluateHeroButterflyProgress(14.0);
    expect(scene4.visible).toBe(true);
    expect(scene4.enterProgress).toBeGreaterThan(0.5);
    expect(scene4.approachProgress).toBe(0);

    const finale = evaluateHeroButterflyProgress(17.4);
    expect(finale.approachProgress).toBe(1);
    expect(finale.hoverProgress).toBeGreaterThan(0);
  });

  it("wraps looped playback timestamps cleanly", () => {
    expect(wrapStoryTime(STORY_DURATION + 1.5)).toBeCloseTo(1.5, 5);
    expect(wrapStoryTime(-1)).toBeCloseTo(STORY_DURATION - 1, 5);
  });
});