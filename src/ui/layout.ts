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

const BUBBLE_H = 76;

/**
 * 말풍선 slot번째의 top(layer 좌표). 말풍선은 가로 전체를 쓰므로 속재료 트레이 칸(이름표 포함)을 가리는 자리는 건너뛴다.
 * 말풍선은 안내라 트레이를 가릴 수 없다(답 버튼은 예외: 배치는 placeAnswerButtons가 한다).
 * shortcut: 건너뛸 자리가 계속 막히면 maxTries번 뒤 마지막 후보를 쓴다, 화면이 극단적으로 작을 때만 해당한다.
 */
export function bubbleTop(slot: number, areaW: number, trayRects: readonly Rect[], top = 120, step = 84, maxTries = 24): number {
  let t = top - step;
  for (let n = -1, tries = 0; n < slot && tries < maxTries; tries++) {
    t += step;
    if (!trayRects.some((r) => overlaps({ x: 0, y: t, w: areaW, h: BUBBLE_H }, r))) n++;
  }
  return t;
}
