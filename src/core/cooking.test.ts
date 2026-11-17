import { describe, expect, it } from 'vitest';
import { createDonenessJudge, gaugeValue, rollPosition } from './cooking';

describe('익음 게이지 (GDD §굽기)', () => {
  const main = createDonenessJudge(false);

  it('초당 20씩 증가해 100에서 정지', () => {
    expect(gaugeValue('cook-1', 0)).toBe(0);
    expect(gaugeValue('cook-1', 3)).toBeCloseTo(0.6, 12);
    expect(gaugeValue('cook-2', 5)).toBeCloseTo(1, 12);
    expect(gaugeValue('cook-2', 99)).toBe(1);
  });

  it('덜익음 0~59 / 적정 60~85 / 탐 86 이상', () => {
    expect(main.judge('cook-1', 0)).toBe('under');
    expect(main.judge('cook-1', 0.59)).toBe('under');
    expect(main.judge('cook-1', 0.6)).toBe('perfect');
    expect(main.judge('cook-1', 0.85)).toBe('perfect');
    expect(main.judge('cook-1', 0.86)).toBe('burnt');
    expect(main.judge('cook-1', 1)).toBe('burnt'); // 100에서 정지한 상태도 탐
  });

  it('경계 해석: GDD 정수 구간 "적정 60~85, 탐 86 이상"은 86 미만이 적정(0.855는 적정)', () => {
    expect(main.judge('cook-1', 0.855)).toBe('perfect');
    expect(main.judge('cook-1', 0.8599)).toBe('perfect');
  });

  it('두 번째 익힘도 같은 수치', () => {
    expect(main.judge('cook-2', 0.59)).toBe('under');
    expect(main.judge('cook-2', 0.6)).toBe('perfect');
    expect(main.judge('cook-2', 0.86)).toBe('burnt');
  });

  it('부동소수 누적 오차(3.0초 = 59.99999…)는 적정으로 본다', () => {
    let t = 0;
    for (let i = 0; i < 60; i++) t += 0.05;
    expect(main.judge('cook-1', gaugeValue('cook-1', t))).toBe('perfect');
  });

  it('튜토리얼: 적정 40~100, 탐 없음', () => {
    const tut = createDonenessJudge(true);
    expect(tut.judge('cook-1', 0.39)).toBe('under');
    expect(tut.judge('cook-1', 0.4)).toBe('perfect');
    expect(tut.judge('cook-1', 1)).toBe('perfect');
  });
});

describe('굴리기 타이밍 바 (GDD §굽기)', () => {
  const main = createDonenessJudge(false);

  it('1.2초 주기 왕복: 0 → 1(0.6초) → 0(1.2초)', () => {
    expect(rollPosition(0)).toBe(0);
    expect(rollPosition(0.3)).toBeCloseTo(0.5, 12);
    expect(rollPosition(0.6)).toBeCloseTo(1, 12);
    expect(rollPosition(0.9)).toBeCloseTo(0.5, 12);
    expect(rollPosition(1.2)).toBeCloseTo(0, 9);
    expect(rollPosition(1.5)).toBeCloseTo(0.5, 9);
  });

  it('40~60 구간이 성공', () => {
    for (const step of ['roll-1', 'roll-2', 'roll-3'] as const) {
      expect(main.judge(step, 0.39)).not.toBe('perfect');
      expect(main.judge(step, 0.4)).toBe('perfect');
      expect(main.judge(step, 0.6)).toBe('perfect');
      expect(main.judge(step, 0.61)).not.toBe('perfect');
    }
  });

  it('튜토리얼은 전 구간 성공', () => {
    const tut = createDonenessJudge(true);
    expect(tut.judge('roll-1', 0)).toBe('perfect');
    expect(tut.judge('roll-3', 1)).toBe('perfect');
  });

  it('게이지 없는 단계는 적정', () => {
    expect(main.judge('margarine', 0)).toBe('perfect');
    expect(main.judge('filling', 0)).toBe('perfect');
  });
});
