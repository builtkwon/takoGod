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

/** 말풍선 폭 비율(화면 폭 대비)과 예약 높이(CSS .ui-bubble의 max-height). 보통은 한두 줄이라 약 40px다. */
export const BUBBLE_W_RATIO = 0.55;
export const BUBBLE_H = 54;
const BUBBLE_GAP = 4;
const BUBBLE_MARGIN = 8;

const overlapArea = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * 말풍선 slot번째 자리(layer 좌표). 말풍선은 안내라 속재료 트레이·손님 주문 라벨(blockers)과 구이판(grill)을 가리지 않는다
 * (답 버튼은 예외: 배치는 placeAnswerButtons가 한다).
 * 우선순위: ① HUD·바·라벨 아래 ~ 구이판 위(손님 영역)의 빈 행 → ② 구이판 아래 빈 행(구이판 바깥)
 * → ③ 그래도 없으면 화면 안에서 구이판·장애물과 겹치는 넓이가 가장 작은 자리. 화면 밖은 어떤 경우에도 쓰지 않는다.
 * 폭이 화면의 55%라 한 행에 둘이 나란히 놓이지 않으므로 행을 위에서 아래로 쌓고 왼쪽·오른쪽을 번갈아 쓴다(후보끼리 겹치지 않는다).
 */
export function bubbleSpot(slot: number, area: { readonly w: number; readonly h: number }, blockers: readonly Rect[], grill: Rect | null, top: number): Rect {
  const w = Math.max(1, Math.floor(area.w * BUBBLE_W_RATIO));
  const left = BUBBLE_MARGIN;
  const right = Math.max(left, area.w - w - BUBBLE_MARGIN);
  const rows: number[] = [];
  for (let y = top, i = 0; y + BUBBLE_H <= area.h && i < 40; y += BUBBLE_H + BUBBLE_GAP, i++) rows.push(y);
  const at = (y: number, x: number): Rect => ({ x, y, w, h: BUBBLE_H });
  const free = (r: Rect): boolean => !blockers.some((o) => overlaps(r, o)) && !(grill && overlaps(r, grill));
  const rowX = rows.map((_, i) => (i % 2 === 0 ? left : right));
  const aboveGrill = (y: number): boolean => !grill || y + BUBBLE_H <= grill.y;
  const list: Rect[] = [];
  const push = (r: Rect): void => {
    if (!list.some((q) => q.x === r.x && q.y === r.y)) list.push(r);
  };
  rows.forEach((y, i) => aboveGrill(y) && free(at(y, rowX[i] ?? left)) && push(at(y, rowX[i] ?? left)));
  rows.forEach((y, i) => !aboveGrill(y) && free(at(y, rowX[i] ?? left)) && push(at(y, rowX[i] ?? left)));
  const chosen = list[slot];
  if (chosen) return chosen;
  // 최후: 화면 안 후보 중 구이판(가중 3)·장애물과 겹침이 가장 작은 자리.
  const cost = (r: Rect): number => (grill ? 3 * overlapArea(r, grill) : 0) + blockers.reduce((sum, o) => sum + overlapArea(r, o), 0);
  const all = rows.flatMap((y) => [at(y, left), at(y, right)]).filter((r) => !list.some((q) => q.x === r.x && q.y === r.y));
  all.sort((a, b) => cost(a) - cost(b));
  const rest = all[slot - list.length];
  return rest ?? all.at(-1) ?? list.at(-1) ?? at(Math.max(0, Math.min(top, area.h - BUBBLE_H)), left);
}

/** 상단 고정 요소(HUD+타이밍 바 묶음) 아래에 쌓는 요소들의 top. bottom은 그 묶음의 실제 아래쪽(layer 좌표)이다. */
export function topStack(bottom: number): { readonly guide: number; readonly warning: number; readonly reveal: number; readonly bubble: number } {
  const b = Math.ceil(bottom);
  return { guide: b + 8, warning: b + 54, reveal: b + 36, bubble: b + 16 };
}
