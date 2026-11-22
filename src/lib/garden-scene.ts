import * as THREE from "three";

import {
  ASPECT,
  ASSET_URLS,
  createArticulatedWings,
  createCutoutCard,
  createProceduralTextures,
  type CutoutCard,
} from "@/lib/garden-assets";
import {
  ANIMAL_SPECS,
  STORY_DURATION,
  STORY_SCENES,
  clamp01,
  easeInOut,
  evaluateCameraState,
  evaluateCoupleState,
  evaluateHeroButterflyProgress,
  getSceneIndexAt,
  lerp,
  smoothRange,
  wrapStoryTime,
  type AnimalEntranceSpec,
} from "@/lib/story-timeline";

export type GardenStateSnapshot = {
  time: number;
  duration: number;
  sceneIndex: number;
  playing: boolean;
};

export type GardenHandle = {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  restart: () => void;
  seek: (seconds: number) => void;
  jumpToScene: (sceneIndex: number) => void;
  dispose: () => void;
};

export type GardenOptions = {
  onReady?: () => void;
  onStateChange?: (state: GardenStateSnapshot) => void;
  reducedMotion?: boolean;
};

const GROUND = -2.4;
const BG_Z = -12;
const FOV = 35;

const lerpAngle = (a: number, b: number, t: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export function createGardenScene(container: HTMLElement, opts: GardenOptions = {}): GardenHandle {
  const reduced = !!opts.reducedMotion;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x1c2a17);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

  const manager = new THREE.LoadingManager();
  manager.onLoad = () => opts.onReady?.();
  const loader = new THREE.TextureLoader(manager);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const load = (url: string) => {
    const t = loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };

  const tex = {
    bg: load(ASSET_URLS.bg),
    coupleBench: load(ASSET_URLS.coupleBench),
    coupleWalking: load(ASSET_URLS.coupleWalking),
    woodenBench: load(ASSET_URLS.woodenBench),
    red: load(ASSET_URLS.red),
    blue: load(ASSET_URLS.blue),
    rabbit: load(ASSET_URLS.rabbit),
    fawn: load(ASSET_URLS.fawn),
    squirrel: load(ASSET_URLS.squirrel),
    bush: load(ASSET_URLS.bush),
  };
  const proc = createProceduralTextures();

  // Background rose-arch garden
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex.bg, toneMapped: false, depthWrite: false }),
  );
  bg.position.set(0, -0.58, BG_Z);
  bg.renderOrder = -10;
  scene.add(bg);

  // Warm golden-hour sunbeams
  const rays: THREE.Mesh[] = [];
  [
    { x: -6.2, w: 2.3, r: 0.55, o: 0.22 },
    { x: -3.6, w: 1.4, r: 0.48, o: 0.16 },
    { x: -1.1, w: 2.8, r: 0.44, o: 0.12 },
  ].forEach((cfg, i) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(cfg.w, 16),
      new THREE.MeshBasicMaterial({
        map: proc.ray,
        transparent: true,
        opacity: cfg.o,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    m.position.set(cfg.x, 3, -7 + i * 0.6);
    m.rotation.z = cfg.r;
    m.renderOrder = -5;
    m.userData["base"] = cfg.o;
    rays.push(m);
    scene.add(m);
  });

  // Scene 1 -> 2 actors: empty wooden bench aligned pixel-for-pixel with couple-bench
  const emptyBench = createCutoutCard(tex.woodenBench, proc.shadow, ASPECT.woodenBench, 2.22, 0.9);
  emptyBench.mesh.scale.x = 1.21;
  emptyBench.holder.position.set(0, GROUND + 0.14, -0.06);
  scene.add(emptyBench.holder);

  const walkingCouple = createCutoutCard(tex.coupleWalking, proc.shadow, ASPECT.coupleWalking, 3.54, 0.86);
  walkingCouple.holder.position.set(0, GROUND, -2.9);
  scene.add(walkingCouple.holder);

  const seatedCouple = createCutoutCard(tex.coupleBench, proc.shadow, ASPECT.coupleBench, 3.3, 0.92);
  seatedCouple.holder.position.set(0, GROUND, 0);
  scene.add(seatedCouple.holder);

  // Grounded rose bushes firmly rooted into the garden lawn (no floating edges)
  const bushes: { holder: THREE.Group; phase: number }[] = [];
  const addBush = (x: number, y: number, z: number, h: number, mirror = false, shadow = 0.95) => {
    const c = createCutoutCard(tex.bush, proc.shadow, ASPECT.bush, h, shadow);
    c.holder.position.set(x, y, z);
    if (mirror) c.mesh.scale.x = -1;
    scene.add(c.holder);
    bushes.push({ holder: c.holder, phase: Math.random() * 6 });
  };
  // Side garden bushes rooted deeply below the lawn line behind the fawns (zero floating bottom edges)
  addBush(-5.55, GROUND - 1.08, -2.05, 2.05, false, 1.05);
  addBush(5.65, GROUND - 1.08, -2.05, 2.05, true, 1.05);
  // Outer foreground corner bushes anchored below the frame bottom edge
  addBush(-6.05, GROUND - 1.72, 2.6, 2.05, false, 0);
  addBush(6.15, GROUND - 1.72, 2.65, 2.05, true, 0);

  // Scene 3 animals
  type AnimalActor = {
    card: CutoutCard;
    spec: AnimalEntranceSpec;
    phase: number;
    tapHopAt: number;
  };
  const animals: AnimalActor[] = ANIMAL_SPECS.map((spec, idx) => {
    const card = createCutoutCard(
      tex[spec.kind],
      proc.shadow,
      ASPECT[spec.kind],
      spec.height,
      spec.kind === "fawn" ? 1.25 : 1.1,
    );
    if (spec.mirror) card.mesh.scale.x = -1;
    card.holder.position.set(spec.startX, GROUND + spec.groundOffset, spec.startZ);
    card.holder.visible = false;
    scene.add(card.holder);
    const actor: AnimalActor = { card, spec, phase: idx * 1.37, tapHopAt: -10 };
    card.mesh.userData["animal"] = actor;
    return actor;
  });

  // Scene 4 & 5 butterflies (articulated left/right 3D wings)
  type ButterflyActor = {
    group: THREE.Group;
    tilt: THREE.Group;
    left: THREE.Mesh;
    right: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    isHero: boolean;
    enterAt: number;
    spawn: THREE.Vector3;
    center: THREE.Vector3;
    amp: THREE.Vector3;
    freq: THREE.Vector3;
    phase: THREE.Vector3;
    flapSpeed: number;
    flapPhase: number;
    yaw: number;
    boostUntil: number;
  };

  const butterflies: ButterflyActor[] = [];
  const addButterfly = (
    kind: "blue" | "red",
    size: number,
    enterAt: number,
    spawn: [number, number, number],
    center: [number, number, number],
    amp: [number, number, number],
    freq: [number, number, number],
    isHero = false,
  ) => {
    const wings = createArticulatedWings(tex[kind], ASPECT[kind], size);
    wings.group.visible = false;
    if (isHero) {
      wings.left.renderOrder = 20;
      wings.right.renderOrder = 20;
    }
    scene.add(wings.group);
    const b: ButterflyActor = {
      ...wings,
      isHero,
      enterAt,
      spawn: new THREE.Vector3(...spawn),
      center: new THREE.Vector3(...center),
      amp: new THREE.Vector3(...amp),
      freq: new THREE.Vector3(...freq),
      phase: new THREE.Vector3(enterAt * 1.7, enterAt * 2.3, enterAt * 0.9),
      flapSpeed: isHero ? 12.5 : 14 + (butterflies.length % 5),
      flapPhase: butterflies.length * 0.9,
      yaw: 0,
      boostUntil: -10,
    };
    wings.left.userData["butterfly"] = b;
    wings.right.userData["butterfly"] = b;
    butterflies.push(b);
    return b;
  };

  // Blue morpho swarm entering in Scene 4 (left, right, and canopy)
  const blueConfigs: Array<[number, number, [number, number, number], [number, number, number]]> = [
    [0.5, 11.2, [-7.2, 1.4, 1.2], [-2.2, 0.9, 1.2]],
    [0.46, 11.45, [-6.8, 2.4, 0.5], [-1.5, 1.5, 1.8]],
    [0.48, 11.7, [7.2, 1.8, 0.8], [2.1, 1.2, 1.4]],
    [0.42, 11.95, [-5.5, 4.4, -1.0], [-0.9, 1.8, 0.8]],
    [0.52, 12.15, [6.6, 2.9, 1.5], [1.6, 0.7, 2.1]],
    [0.44, 12.35, [0.4, 5.2, -1.5], [0.2, 1.6, 1.5]],
    [0.45, 12.55, [-7.0, 0.7, 2.4], [-2.8, 0.4, 2.4]],
    [0.48, 12.75, [7.0, 1.0, 2.5], [2.6, 0.5, 2.5]],
  ];
  blueConfigs.forEach(([size, enterAt, spawn, center], i) => {
    if (reduced && i >= 4) return;
    addButterfly(
      "blue",
      size,
      enterAt,
      spawn,
      center,
      [1.4 + (i % 3) * 0.45, 0.55 + (i % 2) * 0.3, 0.9 + (i % 3) * 0.3],
      [0.45 + i * 0.04, 0.85 + i * 0.06, 0.5 + i * 0.03],
    );
  });

  // Supporting maroon-gold-blue butterflies descending from above the rose arch
  addButterfly("red", 0.62, 12.9, [5.8, 4.6, -1.0], [1.8, 1.4, 1.2], [1.5, 0.65, 1.1], [0.42, 0.72, 0.48]);
  addButterfly("red", 0.56, 13.3, [-5.6, 4.8, -0.8], [-1.7, 1.5, 1.0], [1.6, 0.6, 1.0], [0.38, 0.68, 0.52]);

  // Hero giant maroon-gold-blue butterfly for Scene 4 descent & Scene 5 full-frame finale
  const heroButterfly = addButterfly(
    "red",
    1.05,
    12.6,
    [2.6, 5.5, -1.6],
    [0.2, 1.65, 1.4],
    [1.1, 0.45, 0.65],
    [0.52, 0.82, 0.45],
    true,
  );

  // Drifting rose petals
  const PETALS = reduced ? 50 : 130;
  const petals = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshBasicMaterial({
      map: proc.petal,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
    PETALS,
  );
  const petalColors = [0xf4a6b0, 0xe96a7a, 0xb3263c, 0xfbd0d5, 0x8d1f33];
  const petalData = Array.from({ length: PETALS }, (_, i) => {
    petals.setColorAt(i, new THREE.Color(petalColors[i % petalColors.length]));
    return {
      x: (Math.random() - 0.5) * 18,
      y: Math.random() * 10 - 3,
      z: Math.random() * 11 - 6,
      speed: 0.28 + Math.random() * 0.34,
      sway: Math.random() * 6,
      spin: new THREE.Vector3(Math.random() * 2, Math.random() * 2, Math.random() * 2),
      s: 0.7 + Math.random() * 0.8,
    };
  });
  scene.add(petals);

  // Golden sunlit dust motes
  const DUST = reduced ? 80 : 210;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 16;
    dustPos[i * 3 + 1] = Math.random() * 7 - 2.5;
    dustPos[i * 3 + 2] = Math.random() * 10 - 7;
    dustSeed[i] = Math.random() * 100;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    map: proc.dot,
    size: 0.09,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);
  const dustBase = dustPos.slice();

  // Floating hearts on tapping the couple
  type Heart = { sprite: THREE.Sprite; t: number; life: number; vx: number; x0: number; active: boolean };
  const hearts: Heart[] = Array.from({ length: 20 }, () => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: proc.heart, transparent: true, depthWrite: false, opacity: 0 }),
    );
    sprite.visible = false;
    scene.add(sprite);
    return { sprite, t: 0, life: 2.4, vx: 0, x0: 0, active: false };
  });
  const burstHearts = (zPos: number) => {
    let n = 0;
    for (const h of hearts) {
      if (h.active) continue;
      h.active = true;
      h.t = -n * 0.08;
      h.life = 2.1 + Math.random() * 1.0;
      h.x0 = (Math.random() - 0.5) * 1.5;
      h.vx = (Math.random() - 0.5) * 0.35;
      h.sprite.position.set(h.x0, GROUND + 2.8, zPos + 0.35);
      h.sprite.visible = true;
      if (++n >= 8) break;
    }
  };

  // Responsive camera sizing
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let baseZ = 10;
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    const aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    baseZ = aspect < 0.85 ? Math.min(18.5, Math.max(12.2, 3.2 / (tanHalf * aspect))) : Math.max(9.8, 2.75 / (tanHalf * aspect));
    bg.position.y = aspect < 0.85 ? -0.22 : -0.58;
    const dist = baseZ + 2.5 - BG_Z;
    const visH = 2 * dist * tanHalf;
    const visW = visH * aspect;
    const H = Math.max(visH * 1.26, (visW * 1.22) / ASPECT.bg);
    bg.scale.set(H * ASPECT.bg, H, 1);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // Pointer parallax & tap interactions
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables = () => [
    ...(walkingCouple.holder.visible ? [walkingCouple.mesh] : []),
    ...(seatedCouple.holder.visible ? [seatedCouple.mesh] : []),
    ...animals.filter((a) => a.card.holder.visible).map((a) => a.card.mesh),
    ...butterflies.filter((b) => b.group.visible).flatMap((b) => [b.left, b.right]),
  ];
  const pick = (cx: number, cy: number) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(pickables(), false)[0]?.object;
  };

  let liveClock = 0;
  let storyTime = 0;
  let playing = true;
  let lastEmitAt = -1;
  let lastEmittedScene = -1;
  let lastEmittedPlaying = playing;

  const emitState = (force = false) => {
    const sceneIndex = getSceneIndexAt(storyTime);
    if (
      force ||
      sceneIndex !== lastEmittedScene ||
      playing !== lastEmittedPlaying ||
      liveClock - lastEmitAt >= 0.08
    ) {
      lastEmitAt = liveClock;
      lastEmittedScene = sceneIndex;
      lastEmittedPlaying = playing;
      opts.onStateChange?.({ time: storyTime, duration: STORY_DURATION, sceneIndex, playing });
    }
  };

  const onMove = (e: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
    if (e.pointerType === "mouse") {
      renderer.domElement.style.cursor = pick(e.clientX, e.clientY) ? "pointer" : "default";
    }
  };
  let downAt = { x: 0, y: 0 };
  const onDown = (e: PointerEvent) => {
    downAt = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return;
    const obj = pick(e.clientX, e.clientY);
    if (!obj) return;
    if (obj === seatedCouple.mesh) burstHearts(0);
    if (obj === walkingCouple.mesh) burstHearts(walkingCouple.holder.position.z);
    const animal = obj.userData["animal"] as AnimalActor | undefined;
    if (animal && liveClock - animal.tapHopAt > 0.6) animal.tapHopAt = liveClock;
    const bf = obj.userData["butterfly"] as ButterflyActor | undefined;
    if (bf) bf.boostUntil = liveClock + 1.4;
  };

  const el = renderer.domElement;
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointerup", onUp);

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const dummy = new THREE.Object3D();
  let last = performance.now();

  const orbitPos = (b: ButterflyActor, t: number, out: THREE.Vector3) =>
    out.set(
      b.center.x + b.amp.x * Math.sin(t * b.freq.x + b.phase.x),
      b.center.y + b.amp.y * Math.sin(t * b.freq.y + b.phase.y),
      b.center.z + b.amp.z * Math.sin(t * b.freq.z + b.phase.z),
    );

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    liveClock += dt;
    if (playing) {
      storyTime = wrapStoryTime(storyTime + dt);
    }
    emitState();

    const st = storyTime;
    const t = liveClock;

    // Camera choreography from Scene 1 to Scene 5 + gentle pointer parallax
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2.8);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2.8);
    const cam = evaluateCameraState(st, reduced);
    camera.position.set(
      pointer.x * 1.15 + cam.driftX,
      cam.y + pointer.y * 0.45,
      baseZ + cam.zOffset,
    );
    camera.lookAt(pointer.x * 0.28, cam.lookY, 0);
    bg.position.z = camera.position.z - (baseZ - BG_Z);

    // Sunbeams shimmer
    rays.forEach((r, i) => {
      (r.material as THREE.MeshBasicMaterial).opacity =
        (r.userData["base"] as number) * (0.72 + 0.28 * Math.sin(t * 0.65 + i * 1.7));
    });

    // Scene 1 -> 2: Walking couple, empty wooden bench, and seated couple on bench
    const coupleState = evaluateCoupleState(st);
    emptyBench.holder.visible = coupleState.emptyBenchOpacity > 0.01;
    emptyBench.material.opacity = coupleState.emptyBenchOpacity;
    if (emptyBench.shadowMaterial) emptyBench.shadowMaterial.opacity = coupleState.emptyBenchOpacity;

    walkingCouple.holder.visible = coupleState.walkOpacity > 0.01;
    walkingCouple.holder.position.set(coupleState.walkX, GROUND + coupleState.walkYOffset, coupleState.walkZ);
    walkingCouple.mesh.scale.set(1, coupleState.walkScaleY, 1);
    walkingCouple.mesh.rotation.z = coupleState.walkSway;
    walkingCouple.material.opacity = coupleState.walkOpacity;
    if (walkingCouple.shadowMaterial) walkingCouple.shadowMaterial.opacity = coupleState.walkOpacity;

    seatedCouple.holder.visible = coupleState.seatedOpacity > 0.01;
    seatedCouple.holder.position.set(0, GROUND + coupleState.seatedYOffset, 0);
    seatedCouple.mesh.scale.y = coupleState.seatedScaleY + Math.sin(t * 1.6) * 0.004;
    seatedCouple.material.opacity = coupleState.seatedOpacity;
    if (seatedCouple.shadowMaterial) seatedCouple.shadowMaterial.opacity = coupleState.seatedOpacity;

    // Rose bushes sway gently in the breeze
    for (const b of bushes) {
      b.holder.rotation.z = Math.sin(t * 0.85 + b.phase) * 0.01;
    }

    // Scene 2 tail & Scene 3: woodland animals hop/walk in and gather around the bench
    for (const a of animals) {
      const { spec } = a;
      if (st < spec.enterAt - 0.05) {
        a.card.holder.visible = false;
        continue;
      }
      a.card.holder.visible = true;
      const rawP = clamp01((st - spec.enterAt) / Math.max(0.1, spec.arriveAt - spec.enterAt));
      const moveP = easeInOut(rawP);
      const fadeIn = smoothRange(st, spec.enterAt, spec.enterAt + 0.45);
      a.card.material.opacity = fadeIn;
      if (a.card.shadowMaterial) a.card.shadowMaterial.opacity = fadeIn;

      const x = lerp(spec.startX, spec.endX, moveP);
      const z = lerp(spec.startZ, spec.endZ, moveP);
      const baseY = GROUND + spec.groundOffset;
      const sign = spec.mirror ? -1 : 1;

      let yOffset = 0;
      let scaleX = 1;
      let scaleY = 1;
      let rotZ = 0;

      if (rawP < 1) {
        if (spec.kind === "fawn") {
          // Graceful grounded walk for fawns so hooves stay planted on the grass
          const step = rawP * Math.PI * 5;
          yOffset = Math.abs(Math.sin(step)) * 0.035;
          rotZ = Math.sin(step) * 0.018;
        } else {
          // Lively parabolic hops for rabbits & squirrel
          const hopArc = Math.abs(Math.sin(rawP * spec.hops * Math.PI));
          yOffset = hopArc * (spec.kind === "squirrel" ? 0.38 : 0.32);
          const stretch = 0.92 + hopArc * 0.15;
          scaleY = stretch;
          scaleX = 2 - stretch;
        }
      } else {
        // Arrived: gentle breathing + interactive tap hop or occasional cheerful bunny hop
        const tapP = (t - a.tapHopAt) / 0.55;
        const autoHopPhase = ((st - spec.arriveAt + a.phase) % 4.6) / 0.55;
        const activeHop =
          tapP >= 0 && tapP <= 1
            ? tapP
            : !reduced && spec.kind !== "fawn" && autoHopPhase >= 0 && autoHopPhase <= 1
              ? autoHopPhase
              : -1;

        if (activeHop >= 0) {
          const up = Math.sin(Math.PI * activeHop);
          yOffset = up * (spec.kind === "fawn" ? 0.22 : 0.34);
          const sq = activeHop < 0.15 || activeHop > 0.85 ? 0.93 : 1.05;
          scaleY = sq;
          scaleX = 2 - sq;
        } else {
          const br = Math.sin(t * 2.2 + a.phase) * 0.014;
          scaleY = 1 + br;
          scaleX = 1 - br * 0.5;
          rotZ = spec.kind === "fawn" ? Math.sin(t * 0.8 + a.phase) * 0.016 : 0;
        }
      }

      a.card.holder.position.set(x, baseY + yOffset, z);
      a.card.mesh.scale.set(sign * scaleX, scaleY, 1);
      a.card.mesh.rotation.z = rotZ;
    }

    // Scene 4 & 5: blue & red-gold butterflies enter, dance, and hero approaches the lens
    camera.getWorldDirection(fwd);
    const heroProg = evaluateHeroButterflyProgress(st);

    for (const b of butterflies) {
      if (st < b.enterAt) {
        b.group.visible = false;
        continue;
      }
      b.group.visible = true;
      const enterP = smoothRange(st, b.enterAt, b.enterAt + 1.7);
      const isBoosted = t < b.boostUntil;
      let flapSpeed = isBoosted ? b.flapSpeed * 1.45 : b.flapSpeed;
      let faceWeight = 0;
      let opacity = Math.min(1, enterP * 1.8) * heroProg.loopFade;

      orbitPos(b, st, tmp);
      orbitPos(b, st + 0.06, tmp2);

      if (!b.isHero) {
        b.group.position.lerpVectors(b.spawn, tmp, enterP);
        b.group.position.y += Math.sin(enterP * Math.PI) * 0.45;
      } else {
        // Hero butterfly: swoops down in Scene 4, then glides directly into camera lens in Scene 5
        const orbitCur = tmp.clone();
        const swoopPos = new THREE.Vector3().lerpVectors(b.spawn, orbitCur, heroProg.enterProgress);
        swoopPos.y += Math.sin(heroProg.enterProgress * Math.PI) * 0.4;

        const lensTarget = camera.position
          .clone()
          .addScaledVector(fwd, 1.42)
          .add(new THREE.Vector3(0, -0.02, 0));

        if (heroProg.approachProgress > 0) {
          b.group.position.lerpVectors(swoopPos, lensTarget, heroProg.approachProgress);
          b.group.position.y += Math.sin(heroProg.approachProgress * Math.PI) * 0.42;
          if (heroProg.hoverProgress > 0) {
            b.group.position.y += Math.sin(t * 2.1) * 0.035;
            b.group.position.x += Math.sin(t * 1.4) * 0.025;
            flapSpeed = 4.6;
          } else {
            flapSpeed = 10.5;
          }
          faceWeight = heroProg.approachProgress;
        } else {
          b.group.position.copy(swoopPos);
        }
        opacity = Math.min(1, heroProg.enterProgress * 2.2) * heroProg.loopFade;
      }

      b.material.opacity = opacity;
      const vx = tmp2.x - tmp.x;
      const vz = tmp2.z - tmp.z;
      const wanderYaw = Math.atan2(-vx, -vz);
      b.yaw = lerpAngle(b.yaw, wanderYaw, Math.min(1, dt * 4.5));
      const faceYaw = Math.atan2(camera.position.x - b.group.position.x, camera.position.z - b.group.position.z);
      b.group.rotation.y = lerpAngle(b.yaw, faceYaw, faceWeight);
      b.tilt.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2 + 0.55, -0.04, faceWeight);

      b.flapPhase += dt * flapSpeed;
      const wingAngle =
        b.isHero && heroProg.hoverProgress > 0.1
          ? 0.08 + 0.24 * Math.sin(b.flapPhase)
          : 0.4 + 0.72 * Math.sin(b.flapPhase);
      b.left.rotation.y = wingAngle;
      b.right.rotation.y = -wingAngle;
    }

    // Falling rose petals (richer drift once butterflies dance)
    const petalBoost = 1 + smoothRange(st, 11.4, 15.0) * 0.45;
    for (let i = 0; i < PETALS; i++) {
      const p = petalData[i]!;
      p.y -= p.speed * petalBoost * dt;
      if (p.y < -3.6) {
        p.y = 7;
        p.x = (Math.random() - 0.5) * 18;
      }
      dummy.position.set(p.x + Math.sin(t * 0.8 + p.sway) * 0.45, p.y, p.z);
      dummy.rotation.set(t * p.spin.x, t * p.spin.y, t * p.spin.z);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      petals.setMatrixAt(i, dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;

    // Golden dust motes
    for (let i = 0; i < DUST; i++) {
      const s = dustSeed[i]!;
      dustPos[i * 3] = dustBase[i * 3]! + Math.sin(t * 0.3 + s) * 0.3;
      dustPos[i * 3 + 1] = dustBase[i * 3 + 1]! + Math.sin(t * 0.22 + s * 1.3) * 0.35;
    }
    dustGeo.attributes["position"]!.needsUpdate = true;
    dustMat.opacity = 0.65 + Math.sin(t * 1.3) * 0.15;

    // Interactive floating hearts
    for (const h of hearts) {
      if (!h.active) continue;
      h.t += dt;
      if (h.t < 0) continue;
      const p = h.t / h.life;
      if (p >= 1) {
        h.active = false;
        h.sprite.visible = false;
        continue;
      }
      h.sprite.position.set(
        h.x0 + Math.sin(h.t * 3) * 0.14 + h.vx * h.t,
        GROUND + 2.8 + h.t * 0.9,
        h.sprite.position.z,
      );
      const s = 0.25 + Math.sin(Math.min(1, p * 4) * Math.PI * 0.5) * 0.12;
      h.sprite.scale.set(s, s, 1);
      (h.sprite.material as THREE.SpriteMaterial).opacity = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
    }

    renderer.render(scene, camera);
  });

  const seekTo = (seconds: number) => {
    storyTime = clamp01(seconds / STORY_DURATION) * STORY_DURATION;
    emitState(true);
  };

  return {
    play: () => {
      playing = true;
      emitState(true);
    },
    pause: () => {
      playing = false;
      emitState(true);
    },
    togglePlay: () => {
      playing = !playing;
      emitState(true);
    },
    restart: () => {
      storyTime = 0;
      playing = true;
      emitState(true);
    },
    seek: seekTo,
    jumpToScene: (sceneIndex: number) => {
      const target = STORY_SCENES[Math.max(0, Math.min(STORY_SCENES.length - 1, sceneIndex))];
      if (!target) return;
      storyTime = target.start + 0.02;
      playing = true;
      emitState(true);
    },
    dispose: () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mat) => {
          (mat as THREE.MeshBasicMaterial).map?.dispose();
          mat.dispose();
        });
      });
      renderer.dispose();
      el.remove();
    },
  };
}