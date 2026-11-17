import { describe, expect, it } from 'vitest';
import { overlaps, placeAnswerButtons, type Rect } from './layout';

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
