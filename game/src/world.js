// EMBERLINE: Costa Verde — world.js
// One job: build the city of Costa Verde (streets, buildings, beach, ocean,
// plaza, docks, marina) and answer collision / road questions about it.
// The layout is seeded, so every load builds the same city.

import * as THREE from 'three';
import { WORLD, PALETTE, mulberry32 } from './config.js';

const ROAD_XS = [-320, -240, -160, -80, 0, 80, 160, 240, 320];
const ROAD_ZS = [-320, -240, -160, -80, 0, 80, 160, 240];

function makeWindowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#20242c';
  g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      const lit = rng() < 0.45;
      g.fillStyle = lit ? (rng() < 0.7 ? '#ffd27a' : '#9fd8ff') : '#2c3e55';
      g.fillRect(x, y, 8, 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm(rng) {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 5.5, 6), trunkMat);
  trunk.position.y = 2.75;
  trunk.rotation.z = (rng() - 0.5) * 0.16;
  palm.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.9), leafMat);
    leaf.position.y = 5.6;
    leaf.rotation.y = (i / 6) * Math.PI * 2;
    leaf.rotation.x = -0.7;
    leaf.translateZ(1.2);
    palm.add(leaf);
  }
  return palm;
}

function makeStreetlight() {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333338 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), poleMat);
  pole.position.y = 3;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), poleMat);
  arm.position.set(0.8, 5.9, 0);
  g.add(arm);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lamp.position.set(1.6, 5.85, 0);
  g.add(lamp);
  return g;
}

export function buildCity(scene) {
  const rng = mulberry32(20261118);
  const colliders = [];
  const buildings = [];
  const palms = [];

  // Sky, sun, fog — a low orange sun over a warm haze.
  scene.background = new THREE.Color(PALETTE.skyHorizon);
  scene.fog = new THREE.Fog(PALETTE.fog, 120, 620);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sun.position.set(-260, 62, -420);
  sun.lookAt(0, 40, 0);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x3a4a5a, 1.05);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffb36b, 1.8);
  sunLight.position.set(-180, 140, -120);
  scene.add(sunLight);

  // Ground base, then road ribbons, then block slabs.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size + 260, WORLD.size + 260),
    new THREE.MeshLambertMaterial({ color: 0x9a8f7a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  scene.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  for (const x of ROAD_XS) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, 700), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.02, 0);
    scene.add(road);
  }
  for (const z of ROAD_ZS) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(700, WORLD.roadWidth), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, z);
    scene.add(road);
  }
  // Centre dashes.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c86a });
  for (const x of ROAD_XS) {
    for (let z = -320; z <= 320; z += 16) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.04, z);
      scene.add(dash);
    }
  }

  // Beach sand and ocean to the south.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 70),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, 315);
  scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 220),
    new THREE.MeshLambertMaterial({ color: PALETTE.ocean }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.0, 460);
  scene.add(ocean);

  // Block slabs + buildings.
  const slabMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const winTex = makeWindowTexture(rng);
  const plazaBlock = { x: 0, z: 0 };
  for (let ix = 0; ix < ROAD_XS.length - 1; ix++) {
    for (let iz = 0; iz < ROAD_ZS.length - 1; iz++) {
      const bx0 = ROAD_XS[ix] + WORLD.roadWidth / 2;
      const bx1 = ROAD_XS[ix + 1] - WORLD.roadWidth / 2;
      const bz0 = ROAD_ZS[iz] + WORLD.roadWidth / 2;
      const bz1 = ROAD_ZS[iz + 1] - WORLD.roadWidth / 2;
      const cx = (bx0 + bx1) / 2;
      const cz = (bz0 + bz1) / 2;
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(bx1 - bx0, bz1 - bz0), slabMat);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(cx, 0.05, cz);
      scene.add(slab);
      // Sol Plaza: keep the middle block open, with a fountain.
      if (cx === plazaBlock.x && cz === plazaBlock.z) {
        const fountain = new THREE.Mesh(
          new THREE.CylinderGeometry(7, 8, 1.2, 20),
          new THREE.MeshLambertMaterial({ color: 0x7fa8c7 }),
        );
        fountain.position.set(0, 0.6, 0);
        scene.add(fountain);
        const jet = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 1.6, 3.4, 8),
          new THREE.MeshLambertMaterial({ color: 0xbfe3ff }),
        );
        jet.position.set(0, 2.6, 0);
        scene.add(jet);
        continue;
      }
      if (cz > 250) continue; // beach blocks stay open
      const n = 1 + Math.floor(rng() * 3);
      for (let b = 0; b < n; b++) {
        const w = 14 + rng() * 22;
        const d = 14 + rng() * 22;
        const h = 8 + rng() * rng() * 52;
        const px = bx0 + WORLD.blockInset + rng() * Math.max(1, (bx1 - bx0 - 2 * WORLD.blockInset - w));
        const pz = bz0 + WORLD.blockInset + rng() * Math.max(1, (bz1 - bz0 - 2 * WORLD.blockInset - d));
        const color = PALETTE.building[Math.floor(rng() * PALETTE.building.length)];
        const mat = new THREE.MeshLambertMaterial({ color, map: h > 18 ? winTex : null });
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        building.position.set(px + w / 2, h / 2, pz + d / 2);
        scene.add(building);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.7, d + 0.6),
          new THREE.MeshLambertMaterial({ color: 0x4a4038 }),
        );
        roof.position.set(px + w / 2, h + 0.35, pz + d / 2);
        scene.add(roof);
        colliders.push({ minX: px, maxX: px + w, minZ: pz, maxZ: pz + d });
        buildings.push(building);
      }
    }
  }

  // Rico's garage — a low workshop with a yellow sign board.
  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(24, 7, 16),
    new THREE.MeshLambertMaterial({ color: 0xc25a3a }),
  );
  garage.position.set(-120, 3.5, -40);
  scene.add(garage);
  colliders.push({ minX: -132, maxX: -108, minZ: -48, maxZ: -32 });
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(20, 2.4, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  );
  sign.position.set(-120, 8.2, -31.8);
  scene.add(sign);

  // Marina compound wall (mission 8) and dock crates (mission 5).
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x8a7a66 });
  for (let i = 0; i < 5; i++) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(16, 5, 1), wallMat);
    wall.position.set(200 + i * 17, 2.5, 208);
    scene.add(wall);
    colliders.push({ minX: 192 + i * 17, maxX: 208 + i * 17, minZ: 207.5, maxZ: 208.5 });
  }
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xa8763e });
  for (let i = 0; i < 10; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), crateMat);
    crate.position.set(228 + (rng() - 0.5) * 26, 1.5, 148 + (rng() - 0.5) * 20);
    crate.rotation.y = rng() * Math.PI;
    scene.add(crate);
    colliders.push({
      minX: crate.position.x - 1.6, maxX: crate.position.x + 1.6,
      minZ: crate.position.z - 1.6, maxZ: crate.position.z + 1.6,
    });
  }

  // Palms along the beach and the avenues.
  for (let x = -320; x <= 320; x += 40) {
    const palm = makePalm(rng);
    palm.position.set(x + (rng() - 0.5) * 8, 0, 272 + (rng() - 0.5) * 6);
    scene.add(palm);
    palms.push(palm);
  }
  for (let z = -240; z <= 160; z += 80) {
    const palm = makePalm(rng);
    palm.position.set(52, 0, z + 20);
    scene.add(palm);
    palms.push(palm);
  }

  // Streetlights at every other intersection.
  for (const x of ROAD_XS) {
    for (const z of ROAD_ZS) {
      if ((x + z) % 160 !== 0) continue;
      const light = makeStreetlight();
      light.position.set(x + 8, 0, z + 8);
      scene.add(light);
    }
  }

  // Clouds: flat pale slabs drifting slowly (animated in main.js). Unlit so
  // they stay pale against the sunset sky.
  const clouds = [];
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffd9c2, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Mesh(new THREE.BoxGeometry(30 + rng() * 40, 3, 12 + rng() * 10), cloudMat);
    cloud.position.set((rng() - 0.5) * 700, 90 + rng() * 40, (rng() - 0.5) * 700);
    scene.add(cloud);
    clouds.push(cloud);
  }

  return { colliders, buildings, palms, clouds, roadXs: ROAD_XS, roadZs: ROAD_ZS };
}

// Circle (player / car) vs building AABBs. Pushes the circle out and reports hit.
export function resolveCircleCollision(pos, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pl = pos.x - c.minX; const pr = c.maxX - pos.x;
        const pt = pos.z - c.minZ; const pb = c.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.minX - radius;
        else if (m === pr) pos.x = c.maxX + radius;
        else if (m === pt) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
  return hit;
}

export function clampToWorld(pos, margin = 8) {
  const lim = WORLD.size / 2 - margin;
  pos.x = Math.max(-lim, Math.min(lim, pos.x));
  pos.z = Math.max(-lim, Math.min(lim, pos.z));
}

export function isOnRoad(x, z) {
  const w = WORLD.roadWidth / 2 + 1;
  const onX = ROAD_XS.some((rx) => Math.abs(x - rx) < w);
  const onZ = ROAD_ZS.some((rz) => Math.abs(z - rz) < w);
  return onX || onZ;
}

export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    const x = ROAD_XS[Math.floor(rng() * ROAD_XS.length)] + (rng() - 0.5) * 6;
    const z = (rng() - 0.5) * 640;
    return { x, z };
  }
  const z = ROAD_ZS[Math.floor(rng() * ROAD_ZS.length)] + (rng() - 0.5) * 6;
  const x = (rng() - 0.5) * 640;
  return { x, z };
}

export function nearestRoadPoint(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { x: 0, z: 0, axis: 'z' };
  let best = null; let bestD = Infinity;
  for (const rx of ROAD_XS) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, z, axis: 'z' }; }
  }
  for (const rz of ROAD_ZS) {
    const d = Math.abs(z - rz);
    if (d < bestD) { bestD = d; best = { x, z: rz, axis: 'x' }; }
  }
  return best;
}
