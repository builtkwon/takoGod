// 로우폴리 모델: 철판·볼 단계별 상태·속재료 6종·손님. 모든 지오메트리는 플랫 셰이딩 + 버텍스 컬러.
import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { DataTexture } from 'three';
import type { CookStep, Doneness, IngredientId, Personality } from '../contracts';
import { ps1Material } from './ps1';
import type { Textures } from './textures';

import { FUNE_Z, HOLE_POS, PLATE_TOP, TRAY_TOP, TRAY_X, TRAY_Z } from './layout';
import type { V3 } from './layout';

/** 변환 후 플랫 노멀 + 단색 버텍스 컬러를 입힌 파트. */
function part(g: BufferGeometry, hex: number, at: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], rot: V3 = [0, 0, 0]): BufferGeometry {
  const n = g.toNonIndexed();
  n.scale(...scale);
  n.rotateX(rot[0]);
  n.rotateY(rot[1]);
  n.rotateZ(rot[2]);
  n.translate(...at);
  n.computeVertexNormals();
  const count = n.getAttribute('position').count;
  const rgb = [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  n.setAttribute('color', new Float32BufferAttribute(Array.from({ length: count * 3 }, (_, i) => rgb[i % 3] ?? 1), 3));
  return n;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts);
  if (g === null) throw new Error('지오메트리 병합 실패');
  return g;
}

// --- 철판 레이아웃 -----------------------------------------------------------

export { FUNE_Z, HOLE_POS, PLATE_TOP, TRAY_TOP, TRAY_X, TRAY_Z };
export const CUSTOMER_POS: readonly V3[] = [
  [-1.5, 0, -2.3],
  [1.5, 0, -2.3],
];

/** 카운터는 뒤쪽 끝(z=-2.5)을 고정하고 후네 앞까지 늘렸다. */
const COUNTER_BACK = -2.5;
const COUNTER_FRONT = 4.6;
const COUNTER_DEPTH = COUNTER_FRONT - COUNTER_BACK;
const COUNTER_Z = (COUNTER_FRONT + COUNTER_BACK) / 2;

/** 정적 장면: 카운터·철판·구멍·트레이판·뒷벽. */
export function buildStatic(tex: Textures): Group {
  const g = new Group();
  const add = (geo: BufferGeometry, map: DataTexture, bias = 0) => g.add(new Mesh(geo, ps1Material(map, undefined, bias)));
  add(merge([part(new BoxGeometry(6, 0.2, COUNTER_DEPTH), 0xffffff, [0, -0.1, COUNTER_Z])]), tex.wood);
  add(merge([part(new BoxGeometry(3.7, PLATE_TOP, 2.5), 0xffffff, [0, PLATE_TOP / 2, 0])]), tex.iron);
  // 구멍 테두리·바닥은 철판 윗면 위 데칼이라 깊이 보정을 단계별로 준다.
  add(merge(HOLE_POS.map(([x, y, z]) => part(new CylinderGeometry(0.52, 0.52, 0.012, 12), 0x55555c, [x, y + 0.004, z]))), tex.iron, 0.00005);
  add(merge(HOLE_POS.map(([x, y, z]) => part(new CylinderGeometry(0.45, 0.45, 0.012, 12), 0x141416, [x, y + 0.01, z]))), tex.iron, 0.0001);
  add(merge([part(new BoxGeometry(3.5, 0.1, 0.55), 0xffffff, [0, TRAY_TOP / 2, TRAY_Z])]), tex.wood);
  add(merge([part(new BoxGeometry(6, 3, 0.2), 0xd8423a, [0, 1.5, -3.2])]), tex.fabric);
  return g;
}

// --- 후네(나룻배 모양 용기) ---------------------------------------------------

const FUNE_FLOOR = 0.06;
/** 후네에 담기는 타코야끼 반지름. 철판 위 완성품(0.42)보다 작게 줄여 6개가 2줄로 들어간다. */
export const FUNE_BALL_R = 0.3;
/** 후네 슬롯 6개: 2줄(z) x 3개(x), 인덱스 = 행 우선. 바닥(y)은 포함하지 않는다. */
export const FUNE_SLOTS: readonly V3[] = Array.from({ length: 6 }, (_, i): V3 => [(i % 3 - 1) * 0.72, FUNE_FLOOR, FUNE_Z + (Math.floor(i / 3) - 0.5) * 0.62]);

/** 6각형 바닥(양 끝이 뾰족한 배 모양) + 변마다 바깥으로 기울어진 옆판 6장. 나무 텍스처 1장. */
export function buildFune(tex: Textures): Group {
  const rx = 1.55;
  const rz = 0.75;
  const corner = (k: number): [number, number] => [rx * Math.cos((k * Math.PI) / 3), rz * Math.sin((k * Math.PI) / 3)];
  const parts = [part(new CylinderGeometry(1, 1, FUNE_FLOOR, 6), 0xa8743c, [0, FUNE_FLOOR / 2, FUNE_Z], [rz, 1, rx], [0, Math.PI / 2, 0])];
  for (let k = 0; k < 6; k++) {
    const [ax, az] = corner(k);
    const [bx, bz] = corner(k + 1);
    const [dx, dz] = [bx - ax, bz - az];
    const [mx, mz] = [(ax + bx) / 2, (az + bz) / 2];
    const yaw = -Math.atan2(dz, dx);
    // 박스 로컬 +z가 월드에서 향하는 쪽(-dz, dx)이 바깥(중심→변 중점)이 되게 기울기 부호를 정한다.
    const lean = -dz * mx + dx * mz >= 0 ? 0.4 : -0.4;
    parts.push(part(new BoxGeometry(Math.hypot(dx, dz), 0.3, 0.06), k % 3 === 0 ? 0xd9a866 : 0xc8924f, [mx * 1.03, 0.16, FUNE_Z + mz * 1.03], [1, 1, 1], [lean, yaw, 0]));
  }
  const g = new Group();
  g.add(new Mesh(merge(parts), ps1Material(tex.fune)));
  return g;
}

// --- 볼(굽기 단계) ----------------------------------------------------------

export type DoughTex = 'butter' | 'batter' | 'crust' | 'sauce';

/** 단계별 반죽·볼 모양. disc는 높이 h, ball은 y 눌림 비율 h. */
export interface DoughLook {
  readonly kind: 'disc' | 'ball';
  readonly r: number;
  readonly h: number;
  readonly tex: DoughTex;
}

/** HoleState.step은 "다음에 수행할 단계"라, 이미 끝난 작업의 결과가 보인다. */
export const DOUGH_LOOKS: Readonly<Record<CookStep, DoughLook | null>> = {
  margarine: null, // 아무것도 안 함: 빈 구멍
  batter: { kind: 'disc', r: 0.32, h: 0.02, tex: 'butter' }, // 마가린만 바름
  'cook-1': { kind: 'disc', r: 0.42, h: 0.06, tex: 'batter' }, // 반죽 부음
  filling: { kind: 'disc', r: 0.42, h: 0.07, tex: 'batter' }, // 1차 익음 끝, 속재료 대기
  'cook-2': { kind: 'disc', r: 0.42, h: 0.1, tex: 'batter' }, // 속재료 들어감
  'roll-1': { kind: 'ball', r: 0.32, h: 0.55, tex: 'crust' },
  'roll-2': { kind: 'ball', r: 0.37, h: 0.8, tex: 'crust' },
  'roll-3': { kind: 'ball', r: 0.41, h: 0.95, tex: 'crust' },
  done: { kind: 'ball', r: 0.42, h: 1, tex: 'sauce' },
};

/** 구멍 테두리 링(철판 위 수평). 색은 머티리얼 tint로 준다. */
export const RIM_UNIT = part(new RingGeometry(0.455, 0.54, 12), 0xffffff, [0, 0, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
/** "속 없음" 표시: 얇은 X(바닥이 y=0). */
export const NOFILL_MARK = merge([
  part(new BoxGeometry(0.34, 0.03, 0.07), 0x8a8ae0, [0, 0, 0], [1, 1, 1], [0, Math.PI / 4, 0]),
  part(new BoxGeometry(0.34, 0.03, 0.07), 0x8a8ae0, [0, 0, 0], [1, 1, 1], [0, -Math.PI / 4, 0]),
]);

export const DISC_UNIT = part(new CylinderGeometry(1, 1, 1, 10), 0xffffff);
export const BALL_UNIT = part(new SphereGeometry(1, 8, 6), 0xffffff);

/**
 * 완성 타코야끼의 색 단계: 보통 완성 / 어두움(진한 갈색) / 탄 것(거의 검정).
 * shortcut: contracts가 굽기 개편으로 바뀌는 중이라 render 로컬 타입이다. 확정되면 contracts 타입에서 이 값으로 매핑한다.
 */
export type BakeStage = 'normal' | 'dark' | 'burnt';

/** 소스 줄무늬 텍스처(205,140,64)에 곱하는 색조. 어두움은 진한 갈색, 탄 것은 거의 검정이 된다. */
const BAKE_TINT: Readonly<Record<BakeStage, V3>> = { normal: [1, 1, 1], dark: [0.5, 0.4, 0.42], burnt: [0.14, 0.12, 0.12] };
export const bakeTint = (stage: BakeStage): V3 => BAKE_TINT[stage];

/** 구멍 상태에서 반죽 색조(곱셈)를 만든다. 익음 게이지는 cook 단계에서만 색으로 쓴다. stage는 완성 이후 색 단계다. */
export function doughTint(step: CookStep, gauge: number, judgements: readonly Doneness[], stage: BakeStage = 'normal'): V3 {
  let t: V3 = [1, 1, 1];
  if (step === 'cook-1' || step === 'cook-2') {
    const k = Math.min(Math.max(gauge, 0), 1);
    t = [1 - 0.15 * k, 1 - 0.38 * k, 1 - 0.6 * k];
  } else if (step === 'filling') {
    t = [0.92, 0.8, 0.62];
  }
  // judgements 0~1은 익음 게이지, 2~4는 굴리기(GDD §굽기). 굴리기 실패는 시각 표시하지 않는다.
  if (stage !== 'normal') {
    const b = BAKE_TINT[stage];
    return [t[0] * b[0], t[1] * b[1], t[2] * b[2]];
  }
  return judgements.slice(0, 2).includes('burnt') ? [t[0] * 0.45, t[1] * 0.45, t[2] * 0.45] : t;
}

// --- 속재료 ------------------------------------------------------------------

/** 바닥이 y=0인 속재료 모델. 키 6개가 IngredientId와 1:1. */
export const FILLING_GEO: Readonly<Record<IngredientId, BufferGeometry>> = {
  octopus: merge([
    part(new SphereGeometry(0.13, 6, 4), 0xd4574b, [0, 0.12, 0]),
    part(new BoxGeometry(0.05, 0.05, 0.16), 0xe9d6cf, [-0.08, 0.03, 0.1]),
    part(new BoxGeometry(0.05, 0.05, 0.16), 0xe9d6cf, [0.08, 0.03, 0.1]),
    part(new BoxGeometry(0.05, 0.05, 0.16), 0xe9d6cf, [0, 0.03, -0.12]),
  ]),
  wasabi: merge([part(new BoxGeometry(0.22, 0.12, 0.22), 0x7bbf3a, [0, 0.06, 0]), part(new SphereGeometry(0.08, 5, 4), 0xa6dc5f, [0.04, 0.14, 0])]),
  'raw-garlic': merge([part(new SphereGeometry(0.13, 6, 5), 0xf1ead6, [0, 0.1, 0], [1, 0.85, 1]), part(new ConeGeometry(0.04, 0.1, 5), 0xd9cfae, [0, 0.24, 0])]),
  eraser: merge([part(new BoxGeometry(0.3, 0.1, 0.14), 0xe8a0b4, [0, 0.05, 0]), part(new BoxGeometry(0.1, 0.105, 0.145), 0x3a5ea8, [0, 0.0525, 0])]),
  marshmallow: merge([part(new CylinderGeometry(0.1, 0.1, 0.14, 8), 0xffffff, [0, 0.07, 0])]),
  chili: merge([
    part(new ConeGeometry(0.06, 0.34, 6), 0xd8281c, [0, 0.06, 0], [1, 1, 1], [0, 0, Math.PI / 2]),
    part(new SphereGeometry(0.04, 5, 4), 0x2f8a2a, [-0.19, 0.06, 0]),
  ]),
};

// --- 손님 --------------------------------------------------------------------

export type CustomerModel = 'salaryman' | 'grandma';

/** shortcut: 성격 4종 중 모델은 2종(직장인·할머니)만 있다. 미식가·관광객은 가까운 모델을 재사용한다. 성격별 모델이 필요하면 CustomerModel을 늘린다. */
export const MODEL_OF: Readonly<Record<Personality, CustomerModel>> = {
  salaryman: 'salaryman',
  grandma: 'grandma',
  gourmet: 'salaryman',
  tourist: 'grandma',
};

const SKIN = 0xf0c8a0;

/** 몸(옷감 텍스처)과 머리(알갱이 텍스처)를 나눠 만든 두 지오메트리. */
function customerGeos(kind: CustomerModel): { body: BufferGeometry; head: BufferGeometry } {
  const eyes = [-0.1, 0.1].map((x) => part(new BoxGeometry(0.05, 0.05, 0.03), 0x1a1a1a, [x, 1.34, 0.27]));
  if (kind === 'salaryman') {
    return {
      body: merge([
        part(new CylinderGeometry(0.38, 0.42, 1, 6), 0x2f3b66, [0, 0.5, 0]),
        part(new BoxGeometry(0.14, 0.7, 0.05), 0xf2f2f2, [0, 0.62, 0.34]),
        part(new BoxGeometry(0.07, 0.5, 0.05), 0xc8302a, [0, 0.58, 0.37]),
        part(new BoxGeometry(0.15, 0.7, 0.15), 0x2f3b66, [-0.5, 0.55, 0]),
        part(new BoxGeometry(0.15, 0.7, 0.15), 0x2f3b66, [0.5, 0.55, 0]),
      ]),
      head: merge([
        part(new SphereGeometry(0.28, 8, 6), SKIN, [0, 1.3, 0]),
        part(new SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0x222222, [0, 1.34, -0.02]),
        ...eyes,
      ]),
    };
  }
  return {
    body: merge([
      part(new CylinderGeometry(0.34, 0.48, 1, 6), 0x8a5fb0, [0, 0.5, 0]),
      part(new BoxGeometry(0.9, 0.14, 0.55), 0xc9a6e0, [0, 0.98, 0]),
      part(new BoxGeometry(0.15, 0.65, 0.15), 0x8a5fb0, [-0.5, 0.6, 0]),
      part(new BoxGeometry(0.15, 0.65, 0.15), 0x8a5fb0, [0.5, 0.6, 0]),
    ]),
    head: merge([
      part(new SphereGeometry(0.28, 8, 6), SKIN, [0, 1.3, 0]),
      part(new SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0xcfcfd4, [0, 1.34, -0.02]),
      part(new SphereGeometry(0.12, 6, 5), 0xcfcfd4, [0, 1.66, -0.08]),
      part(new SphereGeometry(0.05, 5, 4), 0xf0a0a0, [-0.17, 1.22, 0.22]),
      part(new SphereGeometry(0.05, 5, 4), 0xf0a0a0, [0.17, 1.22, 0.22]),
      part(new TorusGeometry(0.07, 0.015, 4, 8), 0x333333, [-0.1, 1.34, 0.27]),
      part(new TorusGeometry(0.07, 0.015, 4, 8), 0x333333, [0.1, 1.34, 0.27]),
      ...eyes,
    ]),
  };
}

export function buildCustomer(kind: CustomerModel, tex: Textures): Group {
  const { body, head } = customerGeos(kind);
  const g = new Group();
  g.add(new Mesh(body, ps1Material(tex.fabric)), new Mesh(head, ps1Material(tex.grain)));
  return g;
}
