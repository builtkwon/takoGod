import { describe, expect, it } from 'vitest';
import { makePlate, playToEnd, playUntilPhase, scripted, setupV2 } from './helpers-v2';

const SAL = 0;

describe('가게 점수(GDD §가게 점수)', () => {
  it('처음에는 0점·콤보 0이다', () => {
    const s = setupV2().game.state;
    expect([s.shopScore, s.combo]).toEqual([0, 0]);
  });

  it('손님 없는 페이즈(P1) 완벽 접시: 기본 80 + 적중 12×5 = 140, 콤보 1, customerId null', () => {
    const h = setupV2();
    makePlate(h);
    expect(h.of('score/plate')).toEqual([{ customerId: null, points: 140, hits: 12, combo: 1, multiplier: 1 }]);
    expect(h.game.state.shopScore).toBe(140);
    expect(h.game.state.combo).toBe(1);
  });

  it('손님 접시: 만족도 합산 뒤 만족도가 기본이다(완벽 80+20=100) × 연속 2번째 1.2 = 192', () => {
    const h = setupV2();
    makePlate(h); // P1 완벽 → 콤보 1
    makePlate(h); // P2 완벽, 손님 접시
    const e = h.of('score/plate')[1];
    expect(e).toMatchObject({ points: 192, hits: 12, combo: 2, multiplier: 1.2 });
    expect(e?.customerId).toBe(h.of('plate/scored')[0]?.customerId);
    expect(h.game.state.shopScore).toBe(140 + 192);
  });

  it('완벽이 아닌 접시는 ×1.0이고 콤보를 0으로 되돌린다. 적중 수만큼 보너스', () => {
    const h = setupV2();
    makePlate(h); // 콤보 1
    makePlate(h, { miss1: true }); // 적중 6, 만족도 80 → (80 + 30)
    expect(h.of('score/plate')[1]).toMatchObject({ points: 110, hits: 6, combo: 0, multiplier: 1 });
    expect(h.game.state.combo).toBe(0);
    makePlate(h); // 다시 1번째
    expect(h.of('score/plate')[2]).toMatchObject({ combo: 1, multiplier: 1 });
  });

  it('속 없음 굴리기도 적중이면 적중 수에 센다', () => {
    const h = setupV2();
    makePlate(h, { filling: 'none' }); // 굴리기 적중 12, 속 없음은 완벽 아님
    expect(h.of('score/plate')[0]).toMatchObject({ hits: 12, combo: 0 });
  });

  it('튜토리얼을 끝내도 가게 점수 0·콤보 0이고 이후 첫 완벽 접시가 콤보 1이다', () => {
    const h = setupV2({ tutorial: true });
    const hs = [1, 2, 5, 6, 9, 10];
    for (const i of hs) h.place(i, { kind: 'margarine' });
    for (const i of hs) h.place(i, { kind: 'batter' });
    h.tick(3);
    for (const i of hs) h.place(i, { kind: 'filling', ingredient: 'octopus' });
    for (const i of hs) h.roll(i);
    for (const i of hs) h.roll(i);
    for (const i of hs) {
      h.pick(i);
      h.drop('fune');
    }
    h.tick(1);
    expect(h.game.state.phase).toBe('P1');
    expect(h.of('score/plate')).toEqual([]);
    expect([h.game.state.shopScore, h.game.state.combo]).toEqual([0, 0]);
    makePlate(h);
    expect(h.of('score/plate')[0]).toMatchObject({ combo: 1, multiplier: 1 });
  });
});

describe('다시해줘와 가게 점수', () => {
  it('첫 접시: score/plate 없음, 점수·콤보 불변. 다시 받은 접시로 계산한다', () => {
    const h = setupV2({ rng: scripted([SAL, 0.5, 0.99, 0.1]).rng });
    playUntilPhase(h, 'P2');
    const before = h.game.state.shopScore;
    const comboBefore = h.game.state.combo;
    makePlate(h, Array.from({ length: 6 }, () => ({ dark: true })));
    expect(h.of('customer/redo-requested')).toHaveLength(1);
    expect(h.of('score/plate')).toHaveLength(1); // P1 접시만
    expect(h.game.state.shopScore).toBe(before);
    expect(h.game.state.combo).toBe(comboBefore);
    makePlate(h); // 다시 받은 접시: 만족도 100, 적중 12
    const e = h.of('score/plate')[1];
    expect(e?.points).toBe(Math.round((100 + 60) * 1.2));
    expect(h.game.state.shopScore).toBe(before + (e?.points ?? 0));
  });
});

describe('최고 가게 점수 저장(ADR 0004)', () => {
  it('시작 때 저장소에서 읽어 bestShopScore로 보이고 진행 중에는 바뀌지 않는다', () => {
    const h = setupV2({ best: 500 });
    expect(h.game.state.bestShopScore).toBe(500);
    makePlate(h);
    expect(h.game.state.bestShopScore).toBe(500);
    expect(h.bestStore.load()).toBe(500);
  });

  it('기록이 없으면 null이다', () => {
    expect(setupV2().game.state.bestShopScore).toBeNull();
  });

  it('세션이 끝나면 이번 점수가 크면 저장하고 score/new-best를 한 번 낸다(previous는 이전 기록)', () => {
    const h = setupV2({ best: 100 });
    playToEnd(h);
    const score = h.game.state.shopScore;
    expect(score).toBeGreaterThan(100);
    expect(h.bestStore.load()).toBe(score);
    expect(h.of('score/new-best')).toEqual([{ score, previous: 100 }]);
    expect(h.game.state.bestShopScore).toBe(100); // 읽은 값은 그대로
  });

  it('기록이 없으면 previous null로 갱신한다', () => {
    const h = setupV2();
    playToEnd(h);
    expect(h.of('score/new-best')).toEqual([{ score: h.game.state.shopScore, previous: null }]);
    expect(h.bestStore.load()).toBe(h.game.state.shopScore);
  });

  it('이번 점수가 기록 이하이면 저장도 이벤트도 없다', () => {
    const h = setupV2({ best: 1_000_000 });
    playToEnd(h);
    expect(h.of('score/new-best')).toEqual([]);
    expect(h.bestStore.load()).toBe(1_000_000);
  });
});
