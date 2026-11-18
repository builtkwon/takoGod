import { describe, expect, it } from 'vitest';
import { BalanceSimulatorV2, playSessionV2 } from '../sim-v2';

describe('BalanceSimulatorV2 (굽기 개편 봇)', () => {
  it('전정답+완벽 봇은 세션을 끝내고 평균 5.0이다(GDD §밸런스 목표)', () => {
    const r = playSessionV2('perfect', 1);
    expect(r.finished).toBe(true);
    // 튜토리얼 1 + P2 2 + P3 4 + P4 4 + P5 4
    expect(r.reviews).toHaveLength(15);
    expect(r.average).toBe(5);
    expect(r.saved?.finished).toBe(true);
    expect(BalanceSimulatorV2.run({ kind: 'perfect', sessions: 5, seed: 7 })).toBe(5);
  });

  it('무작위 봇도 세션을 끝낸다', () => {
    const r = playSessionV2('random', 1);
    expect(r.finished).toBe(true);
    expect(r.saved?.finished).toBe(true);
    expect(r.reviews).toHaveLength(15); // 튜토리얼 1 + 접시 14. 다시해줘 접시는 리뷰가 없어 개수가 늘지 않는다
  });

  it('무작위 봇 평균은 2~3점대다(GDD §밸런스 목표). 측정값을 출력한다', () => {
    const avg = BalanceSimulatorV2.run({ kind: 'random', sessions: 30, seed: 1 });
    console.info(`[sim-v2] random 30 sessions seed 1: 평균 ${avg.toFixed(3)}★ (목표 2~3점대)`);
    expect(avg).toBeGreaterThanOrEqual(2);
    expect(avg).toBeLessThan(4);
  });

  it('순서를 모르고 아무 조작이나 하는 극단 봇(chaos)도 세션을 끝내며 평균이 더 낮다', () => {
    const chaos = Array.from({ length: 5 }, (_, i) => playSessionV2('chaos', i + 1));
    expect(chaos.every((r) => r.finished)).toBe(true);
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
});
