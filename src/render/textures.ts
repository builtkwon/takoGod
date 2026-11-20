// 코드로 만드는 64px 이하 절차 텍스처. 외부 에셋 금지(GDD §제품). 툰 전환 후에는 나무결·옷감 체크·소스 줄무늬·후네 결만 남기고 모두 플랫 컬러다.
import { DataTexture, LinearFilter, NearestFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three';

export const MAX_TEX_SIZE = 64;

type Rgb = readonly [number, number, number];

function make(size: number, filter: typeof NearestFilter | typeof LinearFilter, px: (x: number, y: number) => Rgb): DataTexture {
  if (size > MAX_TEX_SIZE) throw new RangeError(`텍스처는 ${MAX_TEX_SIZE}px 이하: ${size}`);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [R, G, B] = px(x, y);
      const i = (y * size + x) * 4;
      data[i] = R;
      data[i + 1] = G;
      data[i + 2] = B;
      data[i + 3] = 255;
    }
  }
  const t = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  t.magFilter = filter;
  t.minFilter = filter;
  t.generateMipmaps = false;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

export interface Textures {
  readonly wood: DataTexture;
  readonly sauce: DataTexture;
  readonly fabric: DataTexture;
  readonly fune: DataTexture;
  /** 모든 텍스처. dispose용. */
  readonly all: readonly DataTexture[];
}

export function createTextures(): Textures {
  // 나무 카운터: 가로 결 줄무늬(플랫 2색).
  const wood = make(32, NearestFilter, (_x, y) => (y % 8 < 2 ? [168, 104, 58] : [196, 128, 72]));
  // 소스: 완성 볼의 대각선 줄무늬(갈색 소스 + 금빛 겉면). 줄 가장자리가 부드럽게 보이도록 Linear.
  const sauce = make(32, LinearFilter, (x, y) => ((x + y) % 10 < 3 ? [120, 58, 28] : [246, 176, 72]));
  // 옷감: 큰 체크 직조(뒷벽 천).
  const fabric = make(16, NearestFilter, (x, y) => ((x >> 1) % 2 === (y >> 1) % 2 ? [255, 255, 255] : [226, 226, 226]));
  // 후네: 연한 나무 + 가로 결 줄.
  const fune = make(32, NearestFilter, (_x, y) => (y % 6 === 1 ? [236, 186, 120] : [255, 214, 150]));
  return { wood, sauce, fabric, fune, all: [wood, sauce, fabric, fune] };
}
