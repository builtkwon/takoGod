import { describe, expect, it } from 'vitest';
import { topStack, bubbleTop, overlaps, placeAnswerButtons, type Rect } from '../layout';

// 시드 고정 난수(mulberry32)
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AREA = { w: 360, h: 640 };
const SIZE = { w: 150, h: 52 };
const OBSTACLES: Rect[] = [
  { x: 0, y: 560, w: 360, h: 80 }, // 도구바
  { x: 0, y: 0, w: 360, h: 80 }, // HUD
  { x: 12, y: 120, w: 336, h: 70 }, // 말풍선
];

describe('placeAnswerButtons', () => {
  it('시드 200개 모두 화면 안, 장애물·서로와 겹치지 않는다', () => {
    for (let seed = 0; seed < 200; seed++) {
      const [a, b] = placeAnswerButtons(AREA, SIZE, OBSTACLES, seeded(seed));
      for (const r of [a, b]) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(AREA.w);
        expect(r.y + r.h).toBeLessThanOrEqual(AREA.h);
        for (const o of OBSTACLES) expect(overlaps(r, o)).toBe(false);
      }
      expect(overlaps(a, b)).toBe(false);
    }
  });

  it('랜덤이 항상 장애물에 걸려도 격자 탐색으로 빈 자리를 찾는다', () => {
    const [a, b] = placeAnswerButtons(AREA, SIZE, OBSTACLES, () => 0); // 항상 (0,0) = HUD와 겹침
    for (const r of [a, b]) for (const o of OBSTACLES) expect(overlaps(r, o)).toBe(false);
    expect(overlaps(a, b)).toBe(false);
  });

  it('화면이 버튼보다 작아도 던지지 않는다', () => {
    expect(() => placeAnswerButtons({ w: 100, h: 30 }, SIZE, [], seeded(1))).not.toThrow();
  });
});

describe('bubbleTop: 말풍선은 트레이를 가리지 않는다', () => {
  const tray: Rect = { x: 20, y: 200, w: 300, h: 70 };
  it('트레이가 없으면 자리(120 + slot*60)', () => {
    expect(bubbleTop(0, 390, [])).toBe(120);
    expect(bubbleTop(1, 390, [])).toBe(180);
  });
  it('트레이와 겹치는 자리는 건너뛰고, 어떤 slot도 트레이와 겹치지 않는다', () => {
    for (let slot = 0; slot < 4; slot++) {
      const t = bubbleTop(slot, 390, [tray]);
      expect(overlaps({ x: 0, y: t, w: 390, h: 52 }, tray)).toBe(false);
    }
    expect(bubbleTop(1, 390, [tray])).toBeGreaterThan(bubbleTop(0, 390, [tray]));
  });

  it('작은 화면(320×568)에서 트레이가 자리를 막아도 말풍선은 화면 밖으로 나가지 않는다', () => {
    const tray320: Rect = { x: 10, y: 300, w: 300, h: 98 }; // 트레이+이름표가 가운데를 막음
    for (let slot = 0; slot < 6; slot++) {
      const t = bubbleTop(slot, 320, [tray320], 568);
      expect(t + 52).toBeLessThanOrEqual(568);
      expect(t).toBeGreaterThanOrEqual(0);
    }
    // 아래쪽 자리는 막혀도 트레이 위쪽에서 가장 가까운 자리를 쓴다
    expect(bubbleTop(5, 320, [tray320], 568) + 52).toBeLessThanOrEqual(300);
  });
});

describe('topStack: 상단 묶음 아래에 쌓는다', () => {
  it('묶음 아래쪽이 커져도 안내·경고·카드·말풍선이 그 아래에서 시작하고 서로 겹치지 않는 순서다', () => {
    for (const bottom of [104, 118.4, 140]) {
      const s = topStack(bottom);
      expect(Math.min(s.guide, s.warning, s.reveal, s.bubble)).toBeGreaterThan(bottom);
      expect(s.warning).toBeGreaterThan(s.guide);
    }
    expect(topStack(118.4).guide).toBe(127);
  });
});
