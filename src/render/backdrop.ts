// 밤 도로 배경: 카메라가 아래를 내려다봐 하늘은 안 보이고 먼 바닥(도로)이 화면 위쪽을 채운다.
// 텍스처·조명 없이 버텍스 컬러 그라데이션(MeshBasicMaterial) + 로우폴리 가로등·보케 원판. 전경(철판·손님)보다 어둡고 외곽선은 없다.
import { CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { BufferGeometry } from 'three';
import { merge, part } from './models';

const GROUND_Y = -2;
type Rgb = readonly [number, number, number];

/** 가로등: 뒷벽 천 양옆 띠(x 3.5~7, z -4~-13)에서 보이는 자리. */
const LAMPS: readonly { x: number; z: number; rgb: Rgb }[] = [
  { x: -5.4, z: -5, rgb: [1, 0.55, 0.2] },
  { x: -6.4, z: -10.5, rgb: [1, 0.5, 0.25] },
  { x: 5.4, z: -7, rgb: [1, 0.6, 0.3] },
  { x: 6.2, z: -12, rgb: [1, 0.5, 0.2] },
];
/** 흐린 불빛 점(보케): 멀수록 어둡다. 양옆 띠 안에 흩는다. */
const BOKEH: readonly { p: [number, number]; r: number; hex: number }[] = [
  { p: [-4.6, -8], r: 0.4, hex: 0x8a5a3a },
  { p: [-6.8, -7], r: 0.5, hex: 0x6a4a78 },
  { p: [-5.2, -13], r: 0.6, hex: 0x4a6a8a },
  { p: [-7.2, -13.5], r: 0.5, hex: 0x7a4a6a },
  { p: [4.7, -4.5], r: 0.3, hex: 0x4a7a8a },
  { p: [4.9, -10], r: 0.5, hex: 0x8a5a3a },
  { p: [6.6, -9], r: 0.45, hex: 0x6a4a78 },
  { p: [5.4, -14], r: 0.6, hex: 0x4a7a8a },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 위치별 바닥색: 먼 곳은 짙은 남색, 가까울수록 보라, 가로등 아래는 주황 빛 웅덩이. */
function groundColor(x: number, z: number): Rgb {
  const t = Math.min(1, Math.max(0, (z + 16) / 14));
  let c: [number, number, number] = [lerp(0.04, 0.17, t), lerp(0.06, 0.1, t), lerp(0.15, 0.22, t)];
  for (const l of LAMPS) {
    const g = Math.exp(-((x - l.x) ** 2 + (z - l.z) ** 2) / 10) * 0.45;
    c = [c[0] + l.rgb[0] * g, c[1] + l.rgb[1] * g, c[2] + l.rgb[2] * g];
  }
  return c;
}

export function buildBackdrop(): Group {
  const g = new Group();
  const ground = new PlaneGeometry(64, 40, 32, 20);
  ground.rotateX(-Math.PI / 2);
  ground.translate(0, GROUND_Y, -20);
  const pos = ground.getAttribute('position');
  const col: number[] = [];
  for (let i = 0; i < pos.count; i++) col.push(...groundColor(pos.getX(i), pos.getZ(i)));
  ground.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.add(new Mesh(ground, new MeshBasicMaterial({ vertexColors: true })));

  const parts: BufferGeometry[] = [];
  for (const l of LAMPS) {
    parts.push(part(new CylinderGeometry(0.08, 0.1, 3.4, 5), 0x24203a, [l.x, GROUND_Y + 1.7, l.z]));
    parts.push(part(new CylinderGeometry(0.32, 0.32, 0.12, 6), 0xffb060, [l.x, GROUND_Y + 3.45, l.z])); // 등
  }
  for (const b of BOKEH) parts.push(part(new CylinderGeometry(b.r, b.r, 0.01, 8), b.hex, [b.p[0], GROUND_Y + 0.03, b.p[1]]));
  g.add(new Mesh(merge(parts), new MeshBasicMaterial({ vertexColors: true })));
  return g;
}
