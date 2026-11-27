import { describe, expect, it } from 'vitest';
import { drawZone, drawZoneAwayFromCenter } from '../cooking-v2';
import { FUMED_LIMIT, MAX_DIFFICULTY_LEVEL, difficulty } from '../levels';
import { phaseConfig, seatCount, targetPlates } from '../phases';
import { createRng } from '../rng';

describe('난이도 곡선(GDD §진행 난이도 곡선)', () => {
  // [단계, 주기, 영역 폭, d, 인내 하한, 인내 상한]
  it.each<[number, number, number, number, number, number]>([
    [1, 2.8, 0.54, 0, 48, 96],
    [2, 2.8, 0.54, 0, 48, 96],
    [3, 2.5, 0.36, 0, 48, 96],
    [5, 2.2, 0.36, 0, 48, 96],
    [6, 2.2, 0.36, 0, 48, 96],
    [13, 1.9, 0.3, 0.075, 42, 84],
    [20, 1.6, 0.24, 0.15, 36, 72],
    [21, 1.6, 0.24, 0.15, 36, 72],
    [50, 1.6, 0.24, 0.15, 36, 72],
  ])('%i단계: 주기 %f, 영역 폭 %f, d %f, 인내 %f~%f', (level, period, width, d, lo, hi) => {
    const x = difficulty(level);
    expect(x.periodSec).toBeCloseTo(period, 9);
    expect(x.width).toBeCloseTo(width, 9);
    expect(x.minCenterDistance).toBeCloseTo(d, 9);
    expect(x.patienceMinSec).toBeCloseTo(lo, 9);
    expect(x.patienceMaxSec).toBeCloseTo(hi, 9);
  });

  it('GDD 참고 표의 10단계·15단계 값과 맞는다', () => {
    // t = (단계 − 6) / 14: 10단계 4/14, 15단계 9/14
    expect(difficulty(10).periodSec).toBeCloseTo(2.2 - (0.6 * 4) / 14, 9);
    expect(difficulty(10).width).toBeCloseTo(0.36 - (0.12 * 4) / 14, 9);
    expect(difficulty(10).minCenterDistance).toBeCloseTo((0.15 * 4) / 14, 9);
    expect(difficulty(15).periodSec).toBeCloseTo(2.2 - (0.6 * 9) / 14, 9);
    expect(difficulty(15).patienceMinSec).toBeCloseTo(40.29, 2);
    expect(difficulty(15).patienceMaxSec).toBeCloseTo(80.57, 2);
  });

  it('6단계부터 주기는 단계마다 0.6/14초씩 줄고 20단계에서 멈춘다', () => {
    for (let l = 6; l < MAX_DIFFICULTY_LEVEL; l++) expect(difficulty(l).periodSec - difficulty(l + 1).periodSec).toBeCloseTo(0.6 / 14, 9);
    expect(difficulty(MAX_DIFFICULTY_LEVEL + 1)).toEqual(difficulty(MAX_DIFFICULTY_LEVEL));
  });

  it('튜토리얼(0단계) 주기는 1단계와 같은 2.8초다', () => {
    expect(difficulty(0).periodSec).toBe(2.8);
  });

  it('패배 기준 화난 손님은 4명이다', () => {
    expect(FUMED_LIMIT).toBe(4);
  });
});

describe('단계 표(GDD §진행)', () => {
  it.each<[number, readonly number[], number, boolean]>([
    [0, [], 1, true],
    [1, [], 1, false],
    [2, [12], 2, true],
    [3, [12, 12], 4, true],
    [4, [6, 12], 4, true],
    [5, [6, 6], 4, true],
    [6, [6, 6, 6], 2, true],
    [9, [6, 6, 6], 2, true],
    [10, [6, 6, 6, 6], 2, true],
    [99, [6, 6, 6, 6], 2, true],
  ])('%i단계: 대화 간격 %j, 전환 접시 %i, 리뷰 집계 %s', (level, intervals, plates, counts) => {
    const c = phaseConfig(level);
    expect(c.level).toBe(level);
    expect(c.dialogueIntervalsSec).toEqual(intervals);
    expect(c.customerCount).toBe(intervals.length);
    expect(c.isTutorial).toBe(level === 0);
    expect(c.countsReviews).toBe(level === 0 ? true : counts);
    expect(targetPlates(level)).toBe(plates);
  });
});

describe('자리 수(동시 손님 상한, GDD §진행)', () => {
  it.each([[0, 0], [1, 0], [2, 1], [3, 2], [5, 2], [6, 3], [9, 3], [10, 4], [99, 4]])('%i단계 → %i자리', (level, seats) => {
    expect(seatCount(level)).toBe(seats);
  });
});

describe('1·2단계 영역(폭 0.54) 뽑기', () => {
  it('영역 전체가 0..1 안에 든다(난수 전 구간, 양 끝값 포함)', () => {
    const w = difficulty(1).width;
    expect(w).toBeCloseTo(0.54, 9);
    for (const v of [0, 0.25, 0.5, 0.75, 0.999999]) {
      const z = drawZone(w, () => v);
      expect(z.from).toBeGreaterThanOrEqual(0);
      expect(z.to).toBeLessThanOrEqual(1 + 1e-12);
      expect(z.to - z.from).toBeCloseTo(0.54, 9);
    }
    expect(drawZone(w, () => 0)).toEqual({ from: 0, to: w });
  });
});

describe('영역 중심 최소 거리 뽑기', () => {
  const widths = [0.24, 0.2, 0.14, 0.1];
  const distances = [0, 0.086, 0.15, 0.3];

  it('영역은 0..1 안이고 중심이 가운데에서 d 이상 떨어진다(난수 전 구간)', () => {
    const rng = createRng(7);
    for (const w of widths) {
      for (const d of distances) {
        for (let i = 0; i < 400; i++) {
          const z = drawZoneAwayFromCenter(w, d, rng);
          expect(z.from).toBeGreaterThanOrEqual(-1e-12);
          expect(z.to).toBeLessThanOrEqual(1 + 1e-12);
          expect(z.to - z.from).toBeCloseTo(w, 9);
          expect(Math.abs((z.from + z.to) / 2 - 0.5)).toBeGreaterThanOrEqual(d - 1e-9);
        }
      }
    }
  });

  it('난수 한 개를 쓰고 양 끝값에서 가장자리 구간 끝을 낸다(d 0.3, 폭 0.14)', () => {
    let n = 0;
    const at = (v: number) => drawZoneAwayFromCenter(0.14, 0.3, () => (n++, v));
    const lo = at(0);
    expect((lo.from + lo.to) / 2).toBeCloseTo(0.07, 9); // 왼쪽 끝
    const mid = at(0.5); // 왼쪽 구간 끝(중심 0.2)을 지나 오른쪽 구간 시작(중심 0.8)
    expect((mid.from + mid.to) / 2).toBeCloseTo(0.8, 9);
    const hi = at(0.999999);
    expect((hi.from + hi.to) / 2).toBeCloseTo(0.93, 3);
    expect(n).toBe(3);
  });

  it('d=0이면 영역 전체가 안에 드는 모든 위치에서 균등하다(양 끝 ~ 가운데)', () => {
    const lo = drawZoneAwayFromCenter(0.24, 0, () => 0);
    expect(lo.from).toBeCloseTo(0, 9);
    const hi = drawZoneAwayFromCenter(0.24, 0, () => 0.999999);
    expect(hi.to).toBeCloseTo(1, 4);
    const mid = drawZoneAwayFromCenter(0.24, 0, () => 0.5);
    expect((mid.from + mid.to) / 2).toBeCloseTo(0.5, 9);
  });

  it('양쪽 구간이 같은 확률이다(d 0.3에서 중심이 왼쪽·오른쪽에 절반씩)', () => {
    const rng = createRng(3);
    let left = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const z = drawZoneAwayFromCenter(0.14, 0.3, rng);
      if ((z.from + z.to) / 2 < 0.5) left++;
    }
    expect(left / n).toBeGreaterThan(0.45);
    expect(left / n).toBeLessThan(0.55);
  });
});
