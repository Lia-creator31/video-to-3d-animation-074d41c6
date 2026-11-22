import { describe, expect, it } from "vitest";

import {
  ANIMAL_SPECS,
  STORY_DURATION,
  STORY_SCENES,
  WALK_END,
  WALK_STEPS,
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
    expect(getSceneIndexAt(0.5)).toBe(0); // Berjalan 8 Langkah
    expect(getSceneIndexAt(5.2)).toBe(1); // Berhadapan
    expect(getSceneIndexAt(8.5)).toBe(2); // Hewan Berdatangan
    expect(getSceneIndexAt(13.0)).toBe(3); // Kupu-Kupu Menari
    expect(getSceneIndexAt(16.8)).toBe(4); // Penutup
  });

  it("walks exactly 8 forward steps in Scene 1 then stops and faces each other in Scene 2", () => {
    expect(WALK_STEPS).toBe(8);
    const startWalk = evaluateCoupleState(0);
    const midWalk = evaluateCoupleState(WALK_END / 2);
    const endWalk = evaluateCoupleState(WALK_END);
    const midTurn = evaluateCoupleState(5.28);
    const facing = evaluateCoupleState(6.0);

    expect(startWalk.stepCount).toBe(0);
    expect(midWalk.stepCount).toBeCloseTo(4, 5);
    expect(endWalk.stepCount).toBe(8);
    expect(startWalk.walkOpacity).toBe(1);
    expect(startWalk.facingOpacity).toBe(0);
    expect(midWalk.walkZ).toBeGreaterThan(startWalk.walkZ);
    expect(endWalk.walkZ).toBeGreaterThan(midWalk.walkZ);

    // Smooth pivot transition right after step 8
    expect(midTurn.walkOpacity).toBeGreaterThan(0);
    expect(midTurn.facingOpacity).toBeGreaterThan(0);
    // Fully standing face-to-face before animals arrive
    expect(facing.walkOpacity).toBe(0);
    expect(facing.facingOpacity).toBe(1);
  });

  it("brings fawns, rabbits, and squirrel in once the couple is standing face-to-face", () => {
    const earliest = Math.min(...ANIMAL_SPECS.map((a) => a.enterAt));
    const latest = Math.max(...ANIMAL_SPECS.map((a) => a.arriveAt));
    expect(earliest).toBeGreaterThanOrEqual(6.0);
    expect(latest).toBeLessThanOrEqual(STORY_SCENES[2]!.end);
    const kinds = new Set(ANIMAL_SPECS.map((a) => a.kind));
    expect(kinds).toEqual(new Set(["fawn", "rabbit", "squirrel"]));
    for (const fawn of ANIMAL_SPECS.filter((a) => a.kind === "fawn")) {
      expect(fawn.endZ).toBeGreaterThan(0);
      expect(fawn.groundOffset).toBeLessThan(0);
    }
  });

  it("keeps hero butterfly hidden early, enters in Scene 4, and stays dancing in the garden through Scene 5 without zooming into the lens", () => {
    expect(evaluateHeroButterflyProgress(4.0).visible).toBe(false);
    const scene4 = evaluateHeroButterflyProgress(14.0);
    expect(scene4.visible).toBe(true);
    expect(scene4.enterProgress).toBeGreaterThan(0.5);
    expect(scene4.approachProgress).toBe(0);

    const finale = evaluateHeroButterflyProgress(17.4);
    expect(finale.approachProgress).toBe(0);
    expect(finale.hoverProgress).toBe(0);
  });

  it("wraps looped playback timestamps cleanly", () => {
    expect(wrapStoryTime(STORY_DURATION + 1.5)).toBeCloseTo(1.5, 5);
    expect(wrapStoryTime(-1)).toBeCloseTo(STORY_DURATION - 1, 5);
  });
});