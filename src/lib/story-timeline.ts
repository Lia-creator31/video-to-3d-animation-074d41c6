export type StorySceneDef = {
  id: number;
  key: "walk" | "face" | "animals" | "butterflies" | "finale";
  label: string;
  caption: string;
  start: number;
  end: number;
};

export const STORY_DURATION = 18;
export const WALK_STEPS = 8;
export const WALK_END = 4.8;

export const STORY_SCENES: readonly StorySceneDef[] = [
  {
    id: 0,
    key: "walk",
    label: "1. Berjalan 8 Langkah",
    caption: "Pengantin berjalan 8 langkah menghadap ke depan menyusuri jalan taman mawar",
    start: 0,
    end: WALK_END,
  },
  {
    id: 1,
    key: "face",
    label: "2. Berhadapan",
    caption: "Keduanya berhenti setelah 8 langkah lalu saling berhadapan di tengah taman",
    start: WALK_END,
    end: 6.8,
  },
  {
    id: 2,
    key: "animals",
    label: "3. Hewan Berdatangan",
    caption: "Kijang, kelinci, dan tupai berdatangan mengelilingi pengantin yang saling berhadapan",
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
  walkScaleX: number;
  walkScaleY: number;
  walkSway: number;
  stepCount: number;
  facingOpacity: number;
  facingScaleX: number;
  facingScaleY: number;
};

export function evaluateCoupleState(t: number): CoupleTimelineState {
  // Scene 1 (0 - 4.8s): exactly 8 natural grounded footsteps facing forward along the stone path
  const rawStepProgress = clamp01(t / WALK_END);
  const stepCount = rawStepProgress * WALK_STEPS;
  // Monotonic forward travel with subtle push-off cadence on each of the 8 steps
  const strideImpulse = -Math.sin(stepCount * Math.PI * 2) * (0.014 / WALK_STEPS);
  const walkProgress = clamp01(rawStepProgress + strideImpulse * smoothRange(t, 0, 0.35) * (1 - smoothRange(t, 4.45, WALK_END)));
  const walkZ = lerp(-3.1, 0, walkProgress);

  // Smooth fade-in on step 1 and natural halt right after step 8
  const strideEnvelope = smoothRange(t, 0, 0.35) * (1 - smoothRange(t, 4.4, WALK_END));
  const stepPhase = stepCount * Math.PI; // 8 half-cycles = 8 distinct alternating steps
  // Grounded footfall: subtle weight dip + left-right transfer + gentle sway, never floating
  const walkDip = -Math.pow(Math.sin(stepPhase), 2) * 0.024 * strideEnvelope;
  const walkX = Math.sin(stepPhase) * 0.032 * strideEnvelope;
  const walkSway = Math.sin(stepPhase) * 0.013 * strideEnvelope;

  // Perspective ground slope along the stone path so shoes stay planted at every step
  const pathSlopeY = Math.max(0, -walkZ) * 0.034;

  // Scene 2 (4.8 - 6.8s): stop cleanly after step 8, then gently pivot inward to face each other
  const turnP = smoothRange(t, 4.88, 5.68);
  const settleWave = Math.sin(smoothRange(t, 5.55, 6.25) * Math.PI) * 0.008;

  return {
    walkOpacity: 1 - turnP,
    walkX,
    walkZ,
    walkYOffset: pathSlopeY + walkDip,
    walkScaleX: 1 - turnP * 0.14,
    walkScaleY: 1,
    walkSway,
    stepCount,
    facingOpacity: turnP,
    facingScaleX: 0.9 + turnP * 0.1,
    facingScaleY: 1 - settleWave,
  };
}

export type CameraTimelineState = {
  zOffset: number;
  y: number;
  lookY: number;
  driftX: number;
};

export function evaluateCameraState(t: number, reducedMotion: boolean): CameraTimelineState {
  // Scene 1: starts warm and grounded with the walking couple, glides back to frame the rose arch
  const pWalk = smoothRange(t, 0, WALK_END);
  // Scene 2 -> 3: gently pulls wider while they face each other to reveal all arriving animals
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
  // Animals enter once the couple has stopped and turned to face each other (t >= 6.4s)
  // Fawns planted squarely on the sunlit background lawn with all four hooves visible
  { kind: "fawn", startX: -7.4, endX: -2.75, startZ: 0.95, endZ: 0.85, groundOffset: -0.3, height: 1.82, mirror: false, enterAt: 6.4, arriveAt: 9.0, hops: 0 },
  { kind: "rabbit", startX: 7.0, endX: 1.92, startZ: 1.3, endZ: 1.18, groundOffset: -0.26, height: 0.82, mirror: true, enterAt: 6.6, arriveAt: 8.8, hops: 5 },
  { kind: "rabbit", startX: -7.0, endX: -1.82, startZ: 1.3, endZ: 1.18, groundOffset: -0.26, height: 0.84, mirror: false, enterAt: 7.0, arriveAt: 9.2, hops: 5 },
  { kind: "fawn", startX: 7.6, endX: 2.85, startZ: 0.92, endZ: 0.82, groundOffset: -0.3, height: 1.74, mirror: true, enterAt: 7.3, arriveAt: 10.0, hops: 0 },
  { kind: "squirrel", startX: 7.5, endX: 3.85, startZ: 1.32, endZ: 1.22, groundOffset: -0.3, height: 0.84, mirror: true, enterAt: 7.7, arriveAt: 10.0, hops: 6 },
  { kind: "rabbit", startX: -7.1, endX: -3.78, startZ: 1.35, endZ: 1.25, groundOffset: -0.3, height: 0.8, mirror: false, enterAt: 8.0, arriveAt: 10.2, hops: 4 },
  { kind: "rabbit", startX: 6.8, endX: 0.96, startZ: 1.45, endZ: 1.3, groundOffset: -0.22, height: 0.72, mirror: true, enterAt: 8.4, arriveAt: 10.6, hops: 5 },
  { kind: "rabbit", startX: -6.6, endX: -0.88, startZ: 1.48, endZ: 1.32, groundOffset: -0.22, height: 0.72, mirror: false, enterAt: 8.8, arriveAt: 11.0, hops: 5 },
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