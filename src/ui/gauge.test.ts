import { describe, expect, it } from 'vitest';
import type { CookStep } from '../contracts';
import { sessionAverageText } from './format';
import { gaugeBands, judgedText, markerPercent } from './gauge';

const edges = (step: CookStep, tutorial: boolean) => gaugeBands(step, tutorial)?.map((b) => [b.zone, b.from, b.to]);

describe('gaugeBands(GDD §굽기 표시 상수)', () => {
  it('익음: 덜익음 0~60 / 적정 60~86 / 탐 86~100', () => {
    for (const s of ['cook-1', 'cook-2'] as const) {
      expect(edges(s, false)).toEqual([['under', 0, 60], ['perfect', 60, 86], ['burnt', 86, 100]]);
    }
  });
  it('튜토리얼 익음: 적정 40~100, 탐 구간 없음', () => {
    expect(edges('cook-1', true)).toEqual([['under', 0, 40], ['perfect', 40, 100]]);
  });
  it('굴리기: 성공 40~60, 튜토리얼은 전 구간 성공', () => {
    for (const s of ['roll-1', 'roll-2', 'roll-3'] as const) {
      expect(edges(s, false)).toEqual([['fail', 0, 40], ['success', 40, 60], ['fail', 60, 100]]);
      expect(edges(s, true)).toEqual([['success', 0, 100]]);
    }
  });
  it('게이지가 없는 단계는 null', () => {
    for (const s of ['margarine', 'batter', 'filling', 'done'] as const) expect(gaugeBands(s, false)).toBeNull();
  });
  it('구간은 0~100을 빈틈·겹침 없이 덮는다', () => {
    for (const s of ['cook-1', 'roll-2'] as const) {
      for (const t of [false, true]) {
        const bands = gaugeBands(s, t)!;
        expect(bands[0]!.from).toBe(0);
        expect(bands.at(-1)!.to).toBe(100);
        bands.slice(1).forEach((b, i) => expect(b.from).toBe(bands[i]!.to));
      }
    }
  });
});

describe('markerPercent', () => {
  it('0..1 → 0..100, 범위 밖·NaN은 끝으로 붙인다', () => {
    expect(markerPercent(0)).toBe(0);
    expect(markerPercent(0.5)).toBe(50);
    expect(markerPercent(1)).toBe(100);
    expect(markerPercent(-0.2)).toBe(0);
    expect(markerPercent(1.3)).toBe(100);
    expect(markerPercent(NaN)).toBe(0);
  });
});

describe('judgedText', () => {
  it('익음 단계는 덜익음/적정/탐', () => {
    expect(judgedText('cook-1', 'under')).toBe('덜익음');
    expect(judgedText('cook-2', 'perfect')).toBe('적정');
    expect(judgedText('cook-2', 'burnt')).toBe('탐');
  });
  it('굴리기 단계는 성공/실패뿐이고 탐으로 표시하지 않는다', () => {
    for (const s of ['roll-1', 'roll-2', 'roll-3'] as const) {
      expect(judgedText(s, 'perfect')).toBe('성공');
      expect(judgedText(s, 'under')).toBe('실패');
      expect(judgedText(s, 'burnt')).toBe('실패');
    }
  });
  it('판정 대상이 아닌 단계는 빈 문구', () => {
    expect(judgedText('margarine', 'perfect')).toBe('');
  });
});

describe('sessionAverageText', () => {
  it('null이면 표시하지 않고, 값은 소수 한 자리', () => {
    expect(sessionAverageText(null)).toBeNull();
    expect(sessionAverageText(5)).toBe('5.0');
    expect(sessionAverageText(3.5)).toBe('3.5');
    expect(sessionAverageText(2.75)).toBe('2.8');
  });
});
