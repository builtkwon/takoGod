// 코드로 만드는 64px 이하 절차 텍스처. 외부 에셋 금지(GDD §제품).
import { DataTexture, NearestFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three';

export const MAX_TEX_SIZE = 64;

type Rgb = readonly [number, number, number];

/** 결정적 난수(mulberry32). 같은 시드면 같은 텍스처 → 스냅샷 비교 가능. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function make(size: number, seed: number, px: (x: number, y: number, r: () => number) => Rgb): DataTexture {
  if (size > MAX_TEX_SIZE) throw new RangeError(`텍스처는 ${MAX_TEX_SIZE}px 이하: ${size}`);
  const r = rng(seed);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [R, G, B] = px(x, y, r);
      const i = (y * size + x) * 4;
      data[i] = R;
      data[i + 1] = G;
      data[i + 2] = B;
      data[i + 3] = 255;
    }
  }
  const t = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

const jitter = (base: Rgb, amt: number, r: () => number): Rgb => {
  const d = (r() - 0.5) * 2 * amt;
  return [base[0] + d, base[1] + d, base[2] + d];
};

export interface Textures {
  readonly iron: DataTexture;
  readonly wood: DataTexture;
  readonly butter: DataTexture;
  readonly batter: DataTexture;
  readonly crust: DataTexture;
  readonly sauce: DataTexture;
  readonly grain: DataTexture;
  readonly fabric: DataTexture;
  /** 모든 텍스처. dispose용. */
  readonly all: readonly DataTexture[];
}

export function createTextures(): Textures {
  // 철판: 짙은 회색 + 긁힌 자국.
  const iron = make(32, 1, (_x, y, r) => (y % 11 === 3 && r() > 0.3 ? [95, 95, 100] : jitter([62, 62, 68], 8, r)));
  // 나무 카운터: 가로 결 줄무늬.
  const wood = make(32, 2, (_x, y, r) => jitter(y % 8 < 2 ? [92, 60, 34] : [124, 84, 48], 6, r));
  // 마가린: 연노랑 번들거림.
  const butter = make(16, 3, (_x, _y, r) => jitter([246, 214, 96], 10, r));
  // 반죽: 옅은 베이지 + 기포 점.
  const batter = make(32, 4, (_x, _y, r) => (r() > 0.93 ? [205, 170, 110] : jitter([240, 214, 150], 8, r)));
  // 익은 겉면: 금갈색 얼룩.
  const crust = make(32, 5, (_x, _y, r) => (r() > 0.8 ? [150, 88, 34] : jitter([205, 140, 64], 12, r)));
  // 소스: 완성 볼의 대각선 줄무늬(갈색 소스 + 크러스트).
  const sauce = make(32, 6, (x, y, r) => ((x + y) % 10 < 3 ? [92, 44, 22] : jitter([205, 140, 64], 12, r)));
  // 일반 알갱이(속재료·피부·머리카락 공용, 색은 버텍스 컬러가 정한다).
  const grain = make(16, 7, (_x, _y, r) => jitter([225, 225, 225], 25, r));
  // 옷감: 체크 직조.
  const fabric = make(16, 8, (x, y, r) => jitter((x >> 1) % 2 === (y >> 1) % 2 ? [235, 235, 235] : [200, 200, 200], 6, r));
  return { iron, wood, butter, batter, crust, sauce, grain, fabric, all: [iron, wood, butter, batter, crust, sauce, grain, fabric] };
}
