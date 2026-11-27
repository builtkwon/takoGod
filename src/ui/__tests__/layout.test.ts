import { describe, expect, it } from 'vitest';
import { topStack, bubbleSpot, overlaps, type Rect } from '../layout';

describe('bubbleSpot: 말풍선은 구이판·트레이·라벨을 피하고 화면 밖으로 나가지 않는다', () => {
  const inside = (r: Rect, w: number, h: number): boolean => r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;
  const cases = [
    { name: '390x844', w: 390, h: 844, top: 124 + 16, slots: 3, grill: { x: 30, y: 312, w: 330, h: 190 }, tray: { x: 70, y: 510, w: 250, h: 70 }, label: { x: 90, y: 128, w: 130, h: 30 } },
    { name: '320x568', w: 320, h: 568, top: 104 + 16, slots: 2, grill: { x: 20, y: 250, w: 280, h: 150 }, tray: { x: 50, y: 410, w: 220, h: 70 }, label: { x: 70, y: 108, w: 120, h: 30 } },
  ];
  for (const c of cases) {
    it(`${c.name}: 손님 영역(HUD·바·라벨 아래 ~ 구이판 위)에 놓이고 구이판·트레이·라벨과 겹치지 않는다`, () => {
      for (let slot = 0; slot < c.slots; slot++) {
        const r = bubbleSpot(slot, { w: c.w, h: c.h }, [c.tray, c.label], c.grill, c.top);
        expect(inside(r, c.w, c.h)).toBe(true);
        for (const o of [c.grill, c.tray, c.label]) expect(overlaps(r, o)).toBe(false);
        expect(r.w).toBeLessThanOrEqual(Math.floor(c.w * 0.55));
      }
    });
    it(`${c.name}: 자리가 모자라도 화면 밖으로 나가지 않고 구이판 가운데를 최대한 피한다`, () => {
      for (let slot = 0; slot < 12; slot++) {
        const r = bubbleSpot(slot, { w: c.w, h: c.h }, [c.tray, c.label], c.grill, c.top);
        expect(inside(r, c.w, c.h)).toBe(true);
      }
    });
  }
  it('구이판이 없으면(앵커 없음) 위에서부터 행을 쌓고 같은 slot은 같은 자리', () => {
    const a = bubbleSpot(0, { w: 390, h: 844 }, [], null, 120);
    expect(a.y).toBe(120);
    expect(bubbleSpot(1, { w: 390, h: 844 }, [], null, 120).y).toBeGreaterThan(a.y);
    expect(bubbleSpot(0, { w: 390, h: 844 }, [], null, 120)).toEqual(a);
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
