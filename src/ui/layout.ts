export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const TRIES = 60;
const STEP = 8;

/**
 * 답 버튼 2개를 area 안 랜덤 위치에 놓는다. 서로·obstacles와 겹치지 않는다(GDD §손님 대화).
 * 랜덤 시도가 실패하면 격자를 훑어 빈 자리를 찾는다. shortcut: 빈 자리가 없으면(화면이 극단적으로 작을 때) 겹침을 허용한다.
 */
export function placeAnswerButtons(
  area: { readonly w: number; readonly h: number },
  size: { readonly w: number; readonly h: number },
  obstacles: readonly Rect[],
  rng: () => number = Math.random,
): [Rect, Rect] {
  const maxX = Math.max(0, area.w - size.w);
  const maxY = Math.max(0, area.h - size.h);
  const placed: Rect[] = [];
  for (let n = 0; n < 2; n++) {
    const blocked = [...obstacles, ...placed];
    const free = (r: Rect): boolean => !blocked.some((o) => overlaps(r, o));
    let pick: Rect | undefined;
    for (let i = 0; i < TRIES && !pick; i++) {
      const r = { x: Math.floor(rng() * (maxX + 1)), y: Math.floor(rng() * (maxY + 1)), w: size.w, h: size.h };
      if (free(r)) pick = r;
    }
    for (let y = 0; y <= maxY && !pick; y += STEP) {
      for (let x = 0; x <= maxX && !pick; x += STEP) {
        const r = { x, y, w: size.w, h: size.h };
        if (free(r)) pick = r;
      }
    }
    placed.push(pick ?? { x: Math.floor(rng() * (maxX + 1)), y: Math.floor(rng() * (maxY + 1)), w: size.w, h: size.h });
  }
  return placed as [Rect, Rect];
}
