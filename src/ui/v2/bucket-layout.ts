import { overlaps, type Rect } from '../layout';

/** 버터·반죽 통 크기(CSS px). 최소는 터치 영역 44px. */
export const BUCKET_SIZE = 64;
export const BUCKET_MIN = 44;
const GAP = 6;
/** 트레이 맨 끝 칸 중심에서 칸 가장자리까지(아이콘 반폭 근사). */
const TRAY_HALF = 18;

export interface BucketInput {
  /** UI 칸(layer 좌표). */
  readonly col: { readonly left: number; readonly width: number };
  readonly layerH: number;
  /** 구이판 사각형(구멍 네 모서리 + 여백, layer 좌표). 앵커가 없으면 null. */
  readonly grill: Rect | null;
  /** 트레이 줄: 맨 끝 칸 중심 x와 줄 중심 y. 칸이 없으면 null. */
  readonly tray: { readonly minX: number; readonly maxX: number; readonly y: number } | null;
}

/**
 * 버터(왼쪽)·반죽(오른쪽) 통 자리. 구이판 사각형과는 어떤 경우에도 겹치지 않는다.
 * ① 구이판 바깥 좌우 여백에 들어가면(여백이 통보다 좁으면 줄여서, 최소 44px) 구이판 세로 가운데에 놓는다.
 * ② 여백이 44px 미만이면 트레이 줄 양끝(구이판 아래)으로 옮긴다. ③ 그래도 구이판과 겹치면 구이판 바로 아래로 내린다.
 */
export function bucketLayout(i: BucketInput): { readonly margarine: Rect; readonly batter: Rect } {
  const { col, grill, tray } = i;
  const right = col.left + col.width;
  const side = (isLeft: boolean): Rect => {
    if (!grill) {
      const x = isLeft ? col.left + GAP : right - GAP - BUCKET_SIZE;
      return { x, y: i.layerH * 0.42, w: BUCKET_SIZE, h: BUCKET_SIZE };
    }
    const space = isLeft ? grill.x - col.left - 2 * GAP : right - (grill.x + grill.w) - 2 * GAP;
    if (space >= BUCKET_MIN) {
      const s = Math.min(BUCKET_SIZE, Math.floor(space));
      return { x: isLeft ? col.left + GAP : right - GAP - s, y: grill.y + grill.h / 2 - s / 2, w: s, h: s };
    }
    // 트레이 줄 양끝. 줄 끝 칸 바깥 공간에 맞춰 줄이되 44px 밑으로는 줄이지 않는다.
    const edge = tray ? (isLeft ? tray.minX - TRAY_HALF - col.left : right - (tray.maxX + TRAY_HALF)) - 2 * GAP : BUCKET_MIN;
    const s = Math.min(BUCKET_SIZE, Math.max(BUCKET_MIN, Math.floor(edge)));
    const r: Rect = { x: isLeft ? col.left + GAP : right - GAP - s, y: (tray ? tray.y : grill.y + grill.h + s / 2) - s / 2, w: s, h: s };
    return overlaps(r, grill) ? { ...r, y: grill.y + grill.h + GAP } : r;
  };
  return { margarine: side(true), batter: side(false) };
}
