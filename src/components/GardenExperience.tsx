import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { GardenHandle, GardenStateSnapshot } from "@/lib/garden-scene";
import { STORY_DURATION, STORY_SCENES } from "@/lib/story-timeline";

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `0:${String(s).padStart(2, "0")}`;
}

export function GardenExperience() {
  const mountRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GardenHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playback, setPlayback] = useState<GardenStateSnapshot>({
    time: 0,
    duration: STORY_DURATION,
    sceneIndex: 0,
    playing: true,
  });

  useEffect(() => {
    let cancelled = false;
    const el = mountRef.current;
    if (!el) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("@/lib/garden-scene")
      .then(({ createGardenScene }) => {
        if (cancelled) return;
        handleRef.current = createGardenScene(el, {
          reducedMotion,
          onReady: () => !cancelled && setReady(true),
          onStateChange: (snap) => !cancelled && setPlayback(snap),
        });
      })
      .catch((err) => {
        console.error(err);
        setFailed(true);
      });
    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  const progressPct = Math.min(100, Math.max(0, (playback.time / playback.duration) * 100));

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background text-foreground">
      <div ref={mountRef} className="absolute inset-0" aria-label="Animasi 3D taman mawar" role="img" />
      <div className="garden-vignette pointer-events-none absolute inset-0" />

      <section
        aria-label="Kontrol adegan animasi 3D"
        className={`absolute inset-x-0 bottom-0 flex justify-center p-2 sm:p-4 transition-all delay-300 duration-[1000ms] ${
          ready ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <div className="glass-panel flex w-full max-w-4xl flex-col gap-2 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3">
          {/* Timeline scrubber */}
          <div className="flex items-center gap-2.5">
            <span className="w-9 font-sans text-xs tabular-nums text-muted-foreground">
              {formatTime(playback.time)}
            </span>
            <div className="relative flex flex-1 items-center">
              <div className="timeline-track relative h-1.5 w-full overflow-hidden rounded-full">
                <div className="timeline-fill h-full rounded-full" style={{ width: `${progressPct}%` }} />
              </div>
              <input
                type="range"
                min={0}
                max={STORY_DURATION}
                step={0.05}
                value={playback.time}
                onChange={(e) => handleRef.current?.seek(Number(e.target.value))}
                aria-label="Garis waktu animasi 3D"
                className="absolute inset-0 h-6 w-full cursor-pointer opacity-0"
              />
            </div>
            <span className="w-9 text-right font-sans text-xs tabular-nums text-muted-foreground">
              {formatTime(playback.duration)}
            </span>
          </div>

          {/* Playback actions + 5 scene jump pills */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="btn-bloom"
                onClick={() => handleRef.current?.togglePlay()}
                aria-label={playback.playing ? "Jeda animasi" : "Putar animasi"}
              >
                {playback.playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                <span>{playback.playing ? "Jeda" : "Putar"}</span>
              </button>
              <button
                type="button"
                className="btn-glass"
                onClick={() => handleRef.current?.restart()}
                aria-label="Ulangi dari adegan pertama"
              >
                <RotateCcw className="size-3.5" />
                <span className="hidden sm:inline">Ulangi</span>
              </button>
            </div>

            <nav className="flex flex-wrap items-center gap-1" aria-label="Pilih adegan">
              {STORY_SCENES.map((scene) => {
                const isActive = scene.id === playback.sceneIndex;
                return (
                  <button
                    key={scene.key}
                    type="button"
                    onClick={() => handleRef.current?.jumpToScene(scene.id)}
                    aria-pressed={isActive}
                    className={`btn-glass ${isActive ? "scene-pill-active" : ""}`}
                  >
                    {scene.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </section>

      <div
        className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background transition-opacity duration-1000 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="loader-petal" />
        {failed ? (
          <p className="font-display text-2xl italic text-muted-foreground">
            Animasi 3D tidak dapat dimuat di perangkat ini.
          </p>
        ) : null}
      </div>
    </main>
  );
}