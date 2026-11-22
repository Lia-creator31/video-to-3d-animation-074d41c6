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
    end: 4.2,
  },
  {
    id: 1,
    key: "sit",
    label: "2. Duduk di Bangku",
    caption: "Tiba dan duduk berdampingan di bangku kayu di bawah lengkungan mawar",
    start: 4.2,
    end: 6.6,
  },
  {
    id: 2,
    key: "animals",
    label: "3. Hewan Berdatangan",
    caption: "Kelinci, anak rusa, dan tupai berdatangan mengelilingi pasangan",
    start: 6.6,
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
  walkZ: number;
  walkYOffset: number;
  walkSway: number;
  emptyBenchOpacity: number;
  seatedOpacity: number;
  seatedYOffset: number;
};

export function evaluateCoupleState(t: number): CoupleTimelineState {
  // Scene 1 (0 - 4.2s): walk forward down the sunlit stone path toward the bench
  const walkP = smoothRange(t, 0, 4.15);
  const walkZ = lerp(-3.8, 0.14, walkP);
  const stepFade = 1 - smoothRange(t, 3.85, 4.35);
  const stepPhase = t * Math.PI * 2.25;
  const walkBob = Math.abs(Math.sin(stepPhase)) * 0.085 * stepFade;
  const walkSway = Math.sin(stepPhase) * 0.016 * stepFade;

  // Empty bench appears smoothly behind them as they approach the rose arch
  const benchIn = smoothRange(t, 2.2, 3.6);

  // Scene 2 (4.2 - 5.45s): couple lowers gently onto the bench and crossfades into couple-bench
  const sitP = smoothRange(t, 4.2, 5.45);
  const walkOpacity = 1 - sitP;
  const seatedOpacity = sitP;
  const emptyBenchOpacity = benchIn * (1 - smoothRange(t, 4.45, 5.4));

  return {
    walkOpacity,
    walkZ,
    walkYOffset: walkBob - sitP * 0.22,
    walkSway,
    emptyBenchOpacity,
    seatedOpacity,
    seatedYOffset: (1 - sitP) * 0.14,
  };
}

export type CameraTimelineState = {
  zOffset: number;
  y: number;
  lookY: number;
  driftX: number;
};

export function evaluateCameraState(t: number, reducedMotion: boolean): CameraTimelineState {
  // Scene 1: starts close & warm facing the walking couple, glides back to reveal bench & arch
  const pWalk = smoothRange(t, 0, 4.2);
  // Scene 2 -> 3: gently pulls wider to reveal all arriving woodland animals
  const pWide = smoothRange(t, 6.4, 11.2);
  // Scene 4 -> 5: subtly leans in and tilts slightly upward toward swirling butterflies & finale
  const pFly = smoothRange(t, 11.6, 16.4);

  const zOffset = lerp(-2.2, -0.35, pWalk) + lerp(0, 1.35, pWide) + lerp(0, -0.95, pFly);
  const y = lerp(0.18, 0.08, pWalk) + lerp(0, 0.22, pWide) + lerp(0, 0.08, pFly);
  const lookY = lerp(-0.32, -0.48, pWalk) + lerp(0, -0.06, pWide) + lerp(0, 0.24, pFly);
  const driftX = reducedMotion ? 0 : Math.sin(t * 0.35) * 0.22;

  return { zOffset, y, lookY, driftX };
}

export type AnimalEntranceSpec = {
  kind: "rabbit" | "fawn" | "squirrel";
  startX: number;
  endX: number;
  startZ: number;
  endZ: number;
  height: number;
  mirror: boolean;
  enterAt: number;
  arriveAt: number;
  hops: number;
};

export const ANIMAL_SPECS: readonly AnimalEntranceSpec[] = [
  // First peekers near the end of Scene 2 (matches video frame 6-7)
  { kind: "fawn", startX: -7.8, endX: -3.05, startZ: -1.7, endZ: -1.35, height: 2.05, mirror: false, enterAt: 5.5, arriveAt: 8.4, hops: 0 },
  { kind: "rabbit", startX: 7.0, endX: 2.5, startZ: 1.4, endZ: 1.15, height: 0.92, mirror: true, enterAt: 5.8, arriveAt: 8.1, hops: 5 },
  // Main wave in Scene 3 (matches video frame 8-14)
  { kind: "rabbit", startX: -7.0, endX: -1.95, startZ: 1.7, endZ: 1.45, height: 0.96, mirror: false, enterAt: 6.5, arriveAt: 8.8, hops: 5 },
  { kind: "squirrel", startX: 7.5, endX: 3.55, startZ: 0.45, endZ: 0.25, height: 0.92, mirror: true, enterAt: 7.0, arriveAt: 9.4, hops: 6 },
  { kind: "fawn", startX: 8.2, endX: 4.35, startZ: -2.25, endZ: -2.0, height: 1.72, mirror: true, enterAt: 7.3, arriveAt: 10.1, hops: 0 },
  { kind: "rabbit", startX: -6.8, endX: -3.7, startZ: 2.35, endZ: 2.15, height: 0.82, mirror: false, enterAt: 7.7, arriveAt: 9.9, hops: 4 },
  { kind: "rabbit", startX: 6.6, endX: 1.05, startZ: 2.3, endZ: 2.05, height: 0.78, mirror: true, enterAt: 8.2, arriveAt: 10.4, hops: 5 },
  { kind: "rabbit", startX: -6.4, endX: -0.65, startZ: 2.55, endZ: 2.3, height: 0.8, mirror: false, enterAt: 8.7, arriveAt: 10.9, hops: 5 },
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