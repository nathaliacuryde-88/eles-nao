/**
 * Bends the head (lexferreira89's, CC BY 4.0) toward a sterner portrait —
 * brows lower and knitted, the face heavier, the hair swept back with more
 * lift — keeping its own texture and colours, and writes the result out as
 * a new GLB. Run with `npm run dev` and open /tools/sculpt.html: it draws
 * before and after from three sides; window.exportHead() returns the GLB.
 *
 * Space: the head as the game holds it — centred, two units tall, facing +z,
 * up +y, its right on −x.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import headUrl from '../src/app/assets/head-original.glb?url';

type V = THREE.Vector3;
/** One change: a smooth bump of displacement round a point. */
interface Move { at: [number, number, number]; radius: number; by: (p: V, w: number) => [number, number, number]; }

function falloff(p: V, at: [number, number, number], radius: number) {
  const d2 = (p.x - at[0]) ** 2 + (p.y - at[1]) ** 2 + (p.z - at[2]) ** 2;
  return Math.exp(-d2 / (radius * radius));
}

/** A move and its mirror on the other side of the face. */
const both = (at: [number, number, number], radius: number, by: (p: V, w: number, side: number) => [number, number, number]): Move[] => [
  { at, radius, by: (p, w) => by(p, w, Math.sign(at[0]) || 1) },
  { at: [-at[0], at[1], at[2]], radius, by: (p, w) => by(p, w, -(Math.sign(at[0]) || 1)) },
];

export const MOVES: Move[] = [
  // The frown: the inner ends of the brows pulled down and together, a
  // little forward, and the skin between them bunched up.
  ...both([0.12, 0.27, 0.58], 0.11, (_p, w, side) => [-side * 0.025 * w, -0.065 * w, 0.035 * w]),
  { at: [0, 0.24, 0.62], radius: 0.07, by: (_p, w) => [0, 0, 0.02 * w] },
  // The whole brow lower and heavier, hooding the eyes.
  ...both([0.27, 0.28, 0.5], 0.17, (_p, w) => [0, -0.035 * w, 0.025 * w]),
  ...both([0.27, 0.17, 0.52], 0.08, (_p, w) => [0, -0.02 * w, 0]),
  // The corners of the mouth down.
  ...both([0.17, -0.37, 0.55], 0.08, (_p, w) => [0, -0.03 * w, -0.01 * w]),
  // A heavier lower face: jowls out and down, the chin broader and less pointed.
  ...both([0.45, -0.55, 0.3], 0.25, (_p, w, side) => [side * 0.06 * w, -0.03 * w, 0]),
  { at: [0, -0.9, 0.35], radius: 0.28, by: (p, w) => [p.x * 0.25 * w, 0.03 * w, 0] },
  // The hair: lifted at the front and swept up toward his left, fuller on
  // top and at the back, a little wider at the sides.
  { at: [0.15, 0.85, 0.3], radius: 0.38, by: (_p, w) => [0.02 * w, 0.13 * w, 0.03 * w] },
  { at: [0, 0.65, -0.35], radius: 0.45, by: (_p, w) => [0, 0.08 * w, -0.08 * w] },
  ...both([0.6, 0.4, -0.1], 0.35, (_p, w, side) => [side * 0.06 * w, 0.02 * w, 0]),
];

function sculpt(p: V): V {
  const out = p.clone();
  for (const m of MOVES) {
    const w = falloff(p, m.at, m.radius);
    if (w < 1e-4) continue;
    const [dx, dy, dz] = m.by(p, w);
    out.x += dx; out.y += dy; out.z += dz;
  }
  return out;
}

async function load() {
  const gltf = await new GLTFLoader().loadAsync(headUrl);
  gltf.scene.updateMatrixWorld(true);
  const parts: { geometry: THREE.BufferGeometry; material: THREE.Material; name: string }[] = [];
  const box = new THREE.Box3();
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox!);
    parts.push({ geometry, material: mesh.material as THREE.Material, name: (mesh.material as THREE.Material).name });
  });
  const c = box.getCenter(new THREE.Vector3());
  const s = 2 / box.getSize(new THREE.Vector3()).y;
  for (const p of parts) { p.geometry.translate(-c.x, -c.y, -c.z); p.geometry.scale(s, s, s); }
  return parts;
}

function bent(parts: Awaited<ReturnType<typeof load>>) {
  return parts.map((p) => {
    const g = p.geometry.clone();
    const pos = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const o = sculpt(v);
      pos.setXYZ(i, o.x, o.y, o.z);
    }
    pos.needsUpdate = true;
    // Lit as its new shape. (The texture seam this opens down the face is
    // closed again by the game's smoothSeams when it loads the head.)
    g.computeVertexNormals();
    g.computeBoundingBox();
    return { ...p, geometry: g };
  });
}

const VIEWS: [string, number][] = [['front', 0], ['three-quarter', -0.6], ['side', -Math.PI / 2]];

async function main() {
  const parts = await load();
  const after = bent(parts);
  const W = 360, H = 400;
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W * VIEWS.length, H * 2);
  renderer.setScissorTest(true);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);
  scene.add(new THREE.HemisphereLight(0xfff4ea, 0x2a2238, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-4, 5, 8); scene.add(key);
  const group = new THREE.Group(); scene.add(group);
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  camera.position.set(0, 0, 5.2);
  const meshesOf = (set: typeof parts) => set.map((p) => new THREE.Mesh(p.geometry, p.material));
  const rows = [meshesOf(parts), meshesOf(after)];
  rows.forEach((meshes, r) => {
    VIEWS.forEach(([, turn], c) => {
      group.clear();
      for (const m of meshes) group.add(m);
      group.rotation.y = turn;
      renderer.setViewport(c * W, (1 - r) * H, W, H);
      renderer.setScissor(c * W, (1 - r) * H, W, H);
      renderer.render(scene, camera);
    });
  });

  (window as unknown as Record<string, unknown>).exportHead = async () => {
    const root = new THREE.Scene();
    for (const p of after) {
      const mat = p.material as THREE.MeshStandardMaterial;
      if (mat.map) mat.map.userData.mimeType = 'image/jpeg';
      root.add(new THREE.Mesh(p.geometry, mat));
    }
    const glb = (await new GLTFExporter().parseAsync(root, { binary: true })) as ArrayBuffer;
    let s = '';
    const bytes = new Uint8Array(glb);
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  // Landmarks, to aim the moves.
  const face = parts.find((p) => p.name.includes('Rosto'))!;
  const pos = face.geometry.attributes.position as THREE.BufferAttribute;
  let tip = new THREE.Vector3(0, 0, -9);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); if (Math.abs(v.x) < 0.15 && v.z > tip.z) tip = v.clone(); }
  (window as unknown as Record<string, unknown>).landmarks = { noseTip: tip.toArray(), faceBox: [face.geometry.boundingBox!.min.toArray(), face.geometry.boundingBox!.max.toArray()], hairBox: (() => { const h = parts.find((p) => !p.name.includes('Rosto'))!; h.geometry.computeBoundingBox(); return [h.geometry.boundingBox!.min.toArray(), h.geometry.boundingBox!.max.toArray()]; })() };
  document.title = 'ready';
}
main();
