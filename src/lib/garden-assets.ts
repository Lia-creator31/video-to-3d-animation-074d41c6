import * as THREE from "three";

import bgUrl from "@/assets/garden-bg.webp";
import coupleBenchUrl from "@/assets/couple-bench.webp";
import coupleWalkingUrl from "@/assets/couple-walking.webp";
import woodenBenchUrl from "@/assets/wooden-bench.webp";
import butterflyRedUrl from "@/assets/butterfly-red.webp";
import butterflyBlueUrl from "@/assets/butterfly-blue.webp";
import rabbitUrl from "@/assets/rabbit.webp";
import fawnUrl from "@/assets/fawn.webp";
import squirrelUrl from "@/assets/squirrel.webp";
import roseBushUrl from "@/assets/rose-bush.webp";

export const ASSET_URLS = {
  bg: bgUrl,
  coupleBench: coupleBenchUrl,
  coupleWalking: coupleWalkingUrl,
  woodenBench: woodenBenchUrl,
  red: butterflyRedUrl,
  blue: butterflyBlueUrl,
  rabbit: rabbitUrl,
  fawn: fawnUrl,
  squirrel: squirrelUrl,
  bush: roseBushUrl,
} as const;

export const ASPECT = {
  bg: 1920 / 1088,
  coupleBench: 1083 / 910,
  coupleWalking: 782 / 1009,
  woodenBench: 1023 / 705,
  red: 900 / 857,
  blue: 900 / 784,
  rabbit: 826 / 900,
  fawn: 553 / 900,
  squirrel: 786 / 900,
  bush: 900 / 380,
} as const;

export function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (ctx) draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createProceduralTextures() {
  const shadow = canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(20,25,10,0.52)");
    g.addColorStop(1, "rgba(20,25,10,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  const ray = canvasTexture(256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, "rgba(255,226,160,0.9)");
    g.addColorStop(1, "rgba(255,226,160,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.globalCompositeOperation = "destination-in";
    const h = ctx.createLinearGradient(0, 0, s, 0);
    h.addColorStop(0, "rgba(0,0,0,0)");
    h.addColorStop(0.5, "rgba(0,0,0,1)");
    h.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = h;
    ctx.fillRect(0, 0, s, s);
  });

  const petal = canvasTexture(64, (ctx, s) => {
    ctx.translate(s / 2, s / 2);
    const g = ctx.createRadialGradient(-4, -6, 2, 0, 0, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(235,225,225,0.95)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.42);
    ctx.bezierCurveTo(s * 0.42, -s * 0.3, s * 0.32, s * 0.32, 0, s * 0.42);
    ctx.bezierCurveTo(-s * 0.32, s * 0.32, -s * 0.42, -s * 0.3, 0, -s * 0.42);
    ctx.fill();
  });

  const dot = canvasTexture(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,236,180,1)");
    g.addColorStop(0.4, "rgba(255,220,140,0.45)");
    g.addColorStop(1, "rgba(255,220,140,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  const heart = canvasTexture(128, (ctx, s) => {
    ctx.translate(s / 2, s / 2 + 6);
    const g = ctx.createLinearGradient(0, -40, 0, 40);
    g.addColorStop(0, "#ff8fa3");
    g.addColorStop(1, "#c81d45");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(255,180,190,0.9)";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, 34);
    ctx.bezierCurveTo(-60, -6, -30, -58, 0, -26);
    ctx.bezierCurveTo(30, -58, 60, -6, 0, 34);
    ctx.fill();
  });

  return { shadow, ray, petal, dot, heart };
}

export type CutoutCard = {
  holder: THREE.Group;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  shadowMaterial?: THREE.MeshBasicMaterial;
};

export function createCutoutCard(
  map: THREE.Texture,
  shadowTex: THREE.Texture,
  aspect: number,
  height: number,
  shadowScale = 0.9,
): CutoutCard {
  const holder = new THREE.Group();
  const geo = new THREE.PlaneGeometry(height * aspect, height);
  geo.translate(0, height / 2, 0);
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    alphaTest: 0.03,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  holder.add(mesh);

  if (shadowScale > 0) {
    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(height * aspect * shadowScale, height * 0.34),
      shadowMaterial,
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.01;
    sh.renderOrder = -1;
    holder.add(sh);
    return { holder, mesh, material, shadowMaterial };
  }
  return { holder, mesh, material };
}

export function createArticulatedWings(
  map: THREE.Texture,
  aspect: number,
  size: number,
): { group: THREE.Group; tilt: THREE.Group; left: THREE.Mesh; right: THREE.Mesh; material: THREE.MeshBasicMaterial } {
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    alphaTest: 0.04,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const group = new THREE.Group();
  const tilt = new THREE.Group();
  group.add(tilt);
  const w = size;
  const h = size / aspect;

  const makeWing = (side: -1 | 1) => {
    const geo = new THREE.PlaneGeometry(w / 2, h);
    geo.translate((side * w) / 4, 0, 0);
    const uv = geo.attributes["uv"] as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      uv.setX(i, side < 0 ? u * 0.5 : 0.5 + u * 0.5);
    }
    return new THREE.Mesh(geo, material);
  };

  const left = makeWing(-1);
  const right = makeWing(1);
  tilt.add(left, right);
  return { group, tilt, left, right, material };
}