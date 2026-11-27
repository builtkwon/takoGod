// 손님 4명 나란히: 머리 위 라벨이 서로 겹치지 않고 칸 안에 든다.
import { describe, expect, it } from 'vitest';
import { overlaps } from '../../layout';
import { badgeRect, layoutBadges, MIN_BADGE_SCALE, type BadgeEntry, type BadgeItem } from '../customer-badges';

const order: BadgeItem = { kind: 'order', ingredient: 'octopus', text: '모두 마시멜로' };
const vip: BadgeItem = { kind: 'vip', text: 'VIP' };
const four = (xs: number[]): BadgeEntry[] => xs.map((x, i) => ({ id: `c${i}`, at: { x, y: 200 }, items: i % 2 ? [order, vip] : [order] }));

describe('layoutBadges', () => {
  for (const [name, left, right, xs] of [
    ['320 폭', 0, 320, [50, 110, 170, 230]],
    ['390 폭', 0, 390, [80, 150, 220, 290]],
    ['1280 칸(340~940)', 340, 940, [450, 600, 700, 850]],
    ['한쪽에 몰림', 0, 320, [150, 160, 170, 180]],
  ] as const) {
    it(`${name}: 4명 라벨이 겹치지 않고 칸 안에 든다`, () => {
      const p = layoutBadges(four([...xs]), 100, left, right);
      p.forEach((a, i) => {
        expect(a.x).toBeGreaterThanOrEqual(left);
        expect(a.x + a.w).toBeLessThanOrEqual(right);
        p.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false));
      });
    });
  }
  it('4명이면 줄이되 하한(MIN_BADGE_SCALE) 아래로 내려가지 않는다', () => {
    const p = layoutBadges(four([50, 110, 170, 230]), 100, 0, 320);
    p.forEach((a) => {
      expect(a.scale).toBeLessThan(1);
      expect(a.scale).toBeGreaterThanOrEqual(MIN_BADGE_SCALE);
    });
  });
  it('한 명이면 badgeRect와 같다', () => {
    const e = four([200]).slice(0, 1);
    const [p] = layoutBadges(e, 100, 0, 390);
    expect(p).toMatchObject({ ...badgeRect(e[0]!.at, e[0]!.items, 100, 390), scale: 1 });
  });
});
