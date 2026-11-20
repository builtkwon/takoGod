import { describe, expect, it } from 'vitest';
import type { FuneItem } from '../../contracts';
import { commentBucket, darkCapRange, isPerfectPlate, plateChanges, plateDefects, shopPlateScore } from '../scoring-v2';

const good: FuneItem = { rolledPerfectly: true, filling: 'octopus', noFilling: false, dark: false };
const plate = (...over: Partial<FuneItem>[]): FuneItem[] =>
  Array.from({ length: 6 }, (_, i) => ({ ...good, ...(over[i] ?? {}) }));

describe('접시 결함(PlateDefect)', () => {
  it('결함 없는 접시는 빈 배열이고 완벽이다', () => {
    expect(plateDefects(plate())).toEqual([]);
    expect(isPerfectPlate(plate())).toBe(true);
  });

  it('굴리기 빗나감 1개 → roll-miss, 완벽 아님', () => {
    const p = plate({ rolledPerfectly: false });
    expect(plateDefects(p)).toEqual(['roll-miss']);
    expect(isPerfectPlate(p)).toBe(false);
  });

  it('속 없음·함정·어두움·빗나감은 종류당 한 번, 고정된 순서로 나온다', () => {
    const p = plate(
      { noFilling: true, filling: null, rolledPerfectly: false },
      { filling: 'wasabi' },
      { filling: 'chili' },
      { dark: true },
      { dark: true },
    );
    expect(plateDefects(p)).toEqual(['no-filling', 'trap', 'dark', 'roll-miss']);
  });

  it('완벽 조건: 6개 모두 굴리기 2회 적중 + 문어 + 어두워짐 0개', () => {
    expect(isPerfectPlate(plate({ dark: true }))).toBe(false);
    expect(isPerfectPlate(plate({ filling: 'eraser' }))).toBe(false);
    expect(isPerfectPlate(plate({ filling: null, noFilling: true }))).toBe(false);
  });
});

describe('접시 만족도 변화(적용 순서)', () => {
  it('완벽 +20', () => {
    expect(plateChanges(plate())).toEqual([20]);
  });
  it('속 없음 -20, 함정 -20: 개수와 무관하게 접시당 한 번씩', () => {
    expect(plateChanges(plate({ noFilling: true, filling: null }, { noFilling: true, filling: null }))).toEqual([-20]);
    expect(plateChanges(plate({ filling: 'wasabi' }, { filling: 'chili' }))).toEqual([-20]);
    expect(plateChanges(plate({ noFilling: true, filling: null }, { filling: 'wasabi' }))).toEqual([-20, -20]);
  });
  it('굴리기 빗나감·어두움만으로는 만족도가 변하지 않는다(어두움은 별점 상한)', () => {
    expect(plateChanges(plate({ rolledPerfectly: false }))).toEqual([]);
    expect(plateChanges(plate({ dark: true }))).toEqual([]);
  });
});

describe('어두워짐 별점 상한 표(GDD §점수)', () => {
  it.each([
    [0, null],
    [1, { min: 3.5, max: 4 }],
    [2, { min: 3, max: 3.5 }],
    [3, { min: 3, max: 3.5 }],
    [4, { min: 2.5, max: 3 }],
    [5, { min: 2.5, max: 3 }],
    [6, { min: 2, max: 2.5 }],
  ] as const)('어두워진 %i개 → %j', (count, range) => {
    expect(darkCapRange(count)).toEqual(range);
  });
});

describe('리뷰 코멘트 구간', () => {
  it.each([
    [5, 5],
    [4.5, 4],
    [3.5, 3],
    [2, 2],
    [1.5, 1],
    [1, 1],
    [0.5, 1],
    [0, 1],
  ] as const)('별점 %f → 구간 %i(0.5는 내림, 0~1점은 1 구간)', (stars, bucket) => {
    expect(commentBucket(stars)).toBe(bucket);
  });
});

describe('접시 가게 점수(GDD §가게 점수)', () => {
  it('완벽 접시 연속 1·2·3번째: (100 + 12×5) × 1.0·1.2·1.4 = 160·192·224', () => {
    const a = shopPlateScore(100, 12, true, 0);
    expect(a).toEqual({ points: 160, multiplier: 1, combo: 1 });
    const b = shopPlateScore(100, 12, true, a.combo);
    expect(b).toEqual({ points: 192, multiplier: 1.2, combo: 2 });
    expect(shopPlateScore(100, 12, true, b.combo)).toEqual({ points: 224, multiplier: 1.4, combo: 3 });
  });

  it('배수는 최대 2.0이다(n=6부터)', () => {
    expect(shopPlateScore(100, 12, true, 4)).toMatchObject({ multiplier: 1.8, combo: 5, points: 288 });
    expect(shopPlateScore(100, 12, true, 5)).toMatchObject({ multiplier: 2, combo: 6, points: 320 });
    expect(shopPlateScore(100, 12, true, 9)).toMatchObject({ multiplier: 2, combo: 10, points: 320 });
  });

  it('완벽이 아니면 ×1.0이고 콤보가 0으로 돌아간다', () => {
    expect(shopPlateScore(80, 9, false, 4)).toEqual({ points: 125, multiplier: 1, combo: 0 });
  });

  it('반올림한다', () => {
    expect(shopPlateScore(83, 11, true, 1)).toMatchObject({ points: Math.round((83 + 55) * 1.2) });
  });
});
