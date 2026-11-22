export type StorySceneDef = {
  id: number;
  key: "walk" | "sit" | "animals" | "butterflies" | "finale";
  label: string;
  caption: string;
  start: number;
  end: number;
};

export const STORY_DURATION = 18;

export const STORY_SCENES: readonly StorySceneDef[] = [
  {
    id: 0,
    key: "walk",
    label: "1. Berjalan",
    caption: "Pasangan berjalan bergandengan menyusuri jalan taman mawar",
    start: 0,
    end: 4.1,
  },
  {
    id: 1,
    key: "sit",
    label: "2. Duduk di Bangku",
    caption: "Tiba dan duduk berdampingan di bangku kayu di bawah lengkungan mawar",
    start: 4.1,
    end: 6.8,
  },
  {
    id: 2,
    key: "animals",
    label: "3. Hewan Berdatangan",
    caption: "Kelinci, anak rusa, dan tupai berdatangan mengelilingi pasangan",
    start: 6.8,
    end: 11.4,
  },
  {
    id: 3,
    key: "butterflies",
    label: "4. Kupu-Kupu Menari",
    caption: "Kupu-kupu biru dan merah-emas bermunculan lalu menari di udara",
    start: 11.4,
    end: 15.2,
  },
  {
    id: 4,
    key: "finale",
    label: "5. Penutup",
    caption: "Kupu-kupu utama terbang mendekati kamera sebagai penutup kisah",
    start: 15.2,
    end: STORY_DURATION,
  },
] as const;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

export const smoothRange = (t: number, start: number, end: number) =>
  easeInOut((t - start) / Math.max(0.001, end - start));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function wrapStoryTime(t: number): number {
  if (!Number.isFinite(t)) return 0;
  const m = t % STORY_DURATION;
  return m < 0 ? m + STORY_DURATION : m;
}

export function getSceneIndexAt(t: number): number {
  const time = clamp01(t / STORY_DURATION) * STORY_DURATION;
  for (let i = STORY_SCENES.length - 1; i >= 0; i--) {
    if (time >= STORY_SCENES[i]!.start) return i;
  }
  return 0;
}

export type CoupleTimelineState = {
  walkOpacity: number;
  walkX: number;
  walkZ: number;
  walkYOffset: number;
  walkScaleY: number;
  walkSway: number;
  emptyBenchOpacity: number;
  seatedOpacity: number;
  seatedYOffset: number;
  seatedScaleY: number;
};

export function evaluateCoupleState(t: number): CoupleTimelineState {
  // Scene 1 (0 - 4.1s): natural grounded stroll along the stone garden path
  const walkP = smoothRange(t, 0, 4.05);
  const walkZ = lerp(-2.9, 0.06, walkP);
  // Natural deceleration before stopping in front of the wooden bench
  const strideEnvelope = smoothRange(t, 0, 0.45) * (1 - smoothRange(t, 3.45, 4.15));
  const stepPhase = t * Math.PI * 1.95;
  // Grounded walking cadence: subtle downward weight dip & gentle side shift, never floating
  const walkDip = -Math.pow(Math.sin(stepPhase), 2) * 0.022 * strideEnvelope;
  const walkSway = Math.sin(stepPhase) * 0.011 * strideEnvelope;

  // Perspective ground slope along the stone path so shoes stay planted at every depth
  const pathSlopeY = Math.max(0, -walkZ) * 0.032;

  // Empty wooden bench gently appears behind them under the rose arch as they near it
  const benchIn = smoothRange(t, 2.5, 3.85);

  // Scene 2 (4.1 - 6.1s): silky multi-phase sit-down transition
  // Phase A (4.15 - 5.1s): knees gently bend so standing heads descend smoothly to exact seated head height (3.30)
  const bendP = smoothRange(t, 4.15, 5.15);
  // Phase B (4.6 - 5.25s): tight seamless cross-dissolve while heads & shoulders align pixel-for-pixel
  const dissolveP = smoothRange(t, 4.6, 5.25);
  // Phase C (5.15 - 5.95s): subtle cushioned settle onto the wooden seat
  const settleWave = Math.sin(smoothRange(t, 5.15, 5.95) * Math.PI) * 0.022;
  // Gently align horizontal center with couple-bench as they settle onto the wooden seat
  const walkX = Math.sin(stepPhase) * 0.024 * strideEnvelope + bendP * 0.12;

  const walkOpacity = 1 - dissolveP;
  const seatedOpacity = dissolveP;
  // Keep empty bench rock-solid underneath until seated couple reaches full opacity
  const emptyBenchOpacity = benchIn * (1 - smoothRange(t, 4.95, 5.4));

  return {
    walkOpacity,
    walkX,
    walkZ,
    walkYOffset: pathSlopeY + walkDip - bendP * 0.13,
    walkScaleY: 1 - bendP * 0.032,
    walkSway,
    emptyBenchOpacity,
    seatedOpacity,
    seatedYOffset: (1 - dissolveP) * 0.025 - settleWave,
    seatedScaleY: 1 - settleWave * 0.2,
  };
}

export type CameraTimelineState = {
  zOffset: number;
  y: number;
  lookY: number;
  driftX: number;
};

export function evaluateCameraState(t: number, reducedMotion: boolean): CameraTimelineState {
  // Scene 1: starts warm and grounded with the walking couple, glides back to frame arch & bench
  const pWalk = smoothRange(t, 0, 4.1);
  // Scene 2 -> 3: gently pulls wider to reveal all arriving woodland animals
  const pWide = smoothRange(t, 6.6, 11.2);
  // Scene 4 -> 5: subtly leans in and tilts slightly upward toward swirling butterflies & finale
  const pFly = smoothRange(t, 11.6, 16.4);

  const zOffset = lerp(-1.85, -0.15, pWalk) + lerp(0, 1.25, pWide) + lerp(0, -0.9, pFly);
  const y = lerp(0.12, 0.04, pWalk) + lerp(0, 0.16, pWide) + lerp(0, 0.1, pFly);
  const lookY = lerp(-0.46, -0.58, pWalk) + lerp(0, -0.12, pWide) + lerp(0, 0.28, pFly);
  const driftX = reducedMotion ? 0 : Math.sin(t * 0.32) * 0.18;

  return { zOffset, y, lookY, driftX };
}

export type AnimalEntranceSpec = {
  kind: "rabbit" | "fawn" | "squirrel";
  startX: number;
  endX: number;
  startZ: number;
  endZ: number;
  groundOffset: number;
  height: number;
  mirror: boolean;
  enterAt: number;
  arriveAt: number;
  hops: number;
};

export const ANIMAL_SPECS: readonly AnimalEntranceSpec[] = [
  // Fawns planted squarely on the open grass/path floor at the same grounded level as the rabbits
  { kind: "fawn", startX: -7.4, endX: -2.85, startZ: 0.95, endZ: 0.85, groundOffset: -0.34, height: 1.82, mirror: false, enterAt: 5.9, arriveAt: 8.7, hops: 0 },
  { kind: "rabbit", startX: 7.0, endX: 2.02, startZ: 1.3, endZ: 1.18, groundOffset: -0.26, height: 0.82, mirror: true, enterAt: 6.1, arriveAt: 8.3, hops: 5 },
  // Main gathering wave in Scene 3 — cleanly spaced on the lawn & stone path, zero overlap
  { kind: "rabbit", startX: -7.0, endX: -1.85, startZ: 1.3, endZ: 1.18, groundOffset: -0.26, height: 0.84, mirror: false, enterAt: 6.7, arriveAt: 8.9, hops: 5 },
  { kind: "fawn", startX: 7.6, endX: 2.95, startZ: 0.92, endZ: 0.82, groundOffset: -0.34, height: 1.72, mirror: true, enterAt: 7.1, arriveAt: 9.9, hops: 0 },
  { kind: "squirrel", startX: 7.5, endX: 3.92, startZ: 1.32, endZ: 1.22, groundOffset: -0.32, height: 0.84, mirror: true, enterAt: 7.5, arriveAt: 9.8, hops: 6 },
  { kind: "rabbit", startX: -7.1, endX: -3.85, startZ: 1.35, endZ: 1.25, groundOffset: -0.32, height: 0.8, mirror: false, enterAt: 7.8, arriveAt: 10.0, hops: 4 },
  { kind: "rabbit", startX: 6.8, endX: 0.96, startZ: 1.45, endZ: 1.3, groundOffset: -0.22, height: 0.72, mirror: true, enterAt: 8.2, arriveAt: 10.4, hops: 5 },
  { kind: "rabbit", startX: -6.6, endX: -0.85, startZ: 1.48, endZ: 1.32, groundOffset: -0.22, height: 0.72, mirror: false, enterAt: 8.6, arriveAt: 10.8, hops: 5 },
] as const;

export function evaluateHeroButterflyProgress(t: number): {
  visible: boolean;
  enterProgress: number;
  approachProgress: number;
  hoverProgress: number;
  loopFade: number;
} {
  const enterProgress = smoothRange(t, 12.6, 14.3);
  const approachProgress = smoothRange(t, 15.15, 17.1);
  const hoverProgress = clamp01((t - 17.1) / (STORY_DURATION - 17.1));
  const loopFade = 1 - smoothRange(t, 17.72, STORY_DURATION);
  return {
    visible: t >= 12.5,
    enterProgress,
    approachProgress,
    hoverProgress,
    loopFade,
  };
}