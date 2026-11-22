import { useEffect, useRef, useState } from "react";

import type { GardenHandle } from "@/lib/garden-scene";

export function GardenExperience() {
  const mountRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GardenHandle | null>(null);
  const [ready, setReady] = useState(false);

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
        });
      })
      .catch((err) => {
        console.error(err);
      });
    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background text-foreground">
      <div ref={mountRef} className="absolute inset-0" aria-label="Animasi 3D taman mawar" role="img" />
      <div className="garden-vignette pointer-events-none absolute inset-0" />

      <div
        className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background transition-opacity duration-1000 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="loader-petal" />
      </div>
    </main>
  );
}