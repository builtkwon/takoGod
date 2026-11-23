import { describe, expect, it } from 'vitest';
import { BalanceSimulatorV2, averageShopScore, measureSurvival, playSessionV2 } from '../sim';

describe('BalanceSimulatorV2 (굽기 개편 봇)', () => {
  it('전정답+완벽 봇은 5단계까지 패배 없이 가고 평균 5.0이다(GDD §밸런스 목표)', () => {
    const r = playSessionV2('perfect', 1);
    expect(r.finished).toBe(false);
    expect(r.level).toBe(6); // 5단계가 끝나 6단계가 시작되는 시점에서 자른다
    // 튜토리얼 1 + 2단계 2 + 3단계 4 + 4단계 4 + 5단계 4
    expect(r.reviews).toHaveLength(15);
    expect(r.average).toBe(5);
    expect(BalanceSimulatorV2.run({ kind: 'perfect', sessions: 5, seed: 7 })).toBe(5);
  });

  it('무작위 봇은 5단계까지 가거나 그 전에 패배해 판이 끝난다', () => {
    const r = playSessionV2('random', 1);
    if (r.finished) expect(r.saved?.finished).toBe(true);
    else expect([r.level, r.reviews.length]).toEqual([6, 15]); // 튜토리얼 1 + 접시 14. 다시해줘 접시는 리뷰가 없어 개수가 늘지 않는다
  });

  it('무작위 봇 평균은 2~3점대다(GDD §밸런스 목표). 측정값을 출력한다', () => {
    const avg = BalanceSimulatorV2.run({ kind: 'random', sessions: 30, seed: 1 });
    console.info(`[sim-v2] random 30 sessions seed 1: 평균 ${avg.toFixed(3)}★ (목표 2~3점대)`);
    expect(avg).toBeGreaterThanOrEqual(2);
    expect(avg).toBeLessThan(4);
  });

  it('순서를 모르고 아무 조작이나 하는 극단 봇(chaos)도 세션을 끝내며 평균이 더 낮다', () => {
    const chaos = Array.from({ length: 5 }, (_, i) => playSessionV2('chaos', i + 1));
    const avg = chaos.reduce((sum, r) => sum + (r.average ?? 0), 0) / chaos.length;
    console.info(`[sim-v2] chaos 5 sessions: 평균 ${avg.toFixed(3)}★`);
    expect(avg).toBeLessThan(BalanceSimulatorV2.run({ kind: 'random', sessions: 5, seed: 1 }));
  });

  it('같은 시드는 같은 결과(재현성)', () => {
    const a = BalanceSimulatorV2.run({ kind: 'random', sessions: 4, seed: 42 });
    const b = BalanceSimulatorV2.run({ kind: 'random', sessions: 4, seed: 42 });
    expect(a).toBe(b);
  });

  it('sessions가 1 미만이면 던진다', () => {
    expect(() => BalanceSimulatorV2.run({ kind: 'perfect', sessions: 0, seed: 1 })).toThrow();
  });

  it('가게 점수 평균을 봇별로 출력한다(참고용, 목표 없음). 전정답 봇이 무작위 봇보다 높다', () => {
    const perfect = averageShopScore('perfect', 10, 1);
    const random = averageShopScore('random', 10, 1);
    console.info(`[sim-v2] 가게 점수 평균(10세션 seed 1): perfect ${perfect.toFixed(0)}, random ${random.toFixed(0)}`);
    expect(perfect).toBeGreaterThan(random);
    expect(random).toBeGreaterThan(0);
  });

  it('20단계까지의 생존을 봇별로 출력한다(참고용, 목표 없음)', () => {
    const perfect = measureSurvival('perfect', 3, 1);
    const random = measureSurvival('random', 3, 1);
    console.info(`[sim-v2] 20단계 생존(3세션 seed 1): perfect 평균 단계 ${perfect.meanLevel.toFixed(1)}, 통과 ${perfect.clearedRatio}; random 평균 단계 ${random.meanLevel.toFixed(1)}, 통과 ${random.clearedRatio}`);
    expect(perfect.meanLevel).toBeGreaterThan(random.meanLevel - 0.0001);
  });
});
