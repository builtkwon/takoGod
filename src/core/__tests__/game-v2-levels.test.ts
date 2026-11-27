import { describe, expect, it } from 'vitest';
import { controlled, customerEnteredAt, makePlate, playToEnd, playUntilLevel, setupV2, tickTo } from './helpers-v2';

/** 7단계에 닿은 뒤 접시 하나를 서빙해 7단계 중에 새 손님이 입장하게 하고, 그 입장 시각을 돌려준다. */
function enterAt7(h: ReturnType<typeof setupV2>): { t: number; id: string } {
  playUntilLevel(h, 7);
  const n = h.of('customer/entered').length;
  makePlate(h);
  tickTo(h, h.now + 2.1);
  expect(h.game.state.level).toBe(7);
  expect(h.of('customer/entered').length).toBeGreaterThan(n);
  const e = h.of('customer/entered').at(-1);
  return { t: customerEnteredAt(h, h.of('customer/entered').length - 1), id: e?.customer.id ?? '' };
}

describe('무한 단계(GDD §진행)', () => {
  it('튜토리얼은 0단계(phase tutorial), 본게임은 1단계부터(phase main)이고 단계 전환마다 phase/changed에 level이 실린다', () => {
    expect(setupV2({ tutorial: true }).game.state).toMatchObject({ phase: 'tutorial', level: 0 });
    const h = setupV2();
    expect(h.game.state).toMatchObject({ phase: 'main', level: 1, fumedCount: 0, fumedLimit: 4 });
    playUntilLevel(h, 3);
    expect(h.of('phase/changed')).toEqual([
      { phase: 'main', level: 1 },
      { phase: 'main', level: 2 },
      { phase: 'main', level: 3 },
    ]);
  });

  it('5단계가 끝나도 결과 화면으로 가지 않고 6·7단계로 계속된다(단계 전환 접시 수 6단계~ 2)', () => {
    const h = setupV2();
    playUntilLevel(h, 6);
    expect(h.game.finished).toBe(false);
    expect(h.game.state.customers).toHaveLength(1);
    makePlate(h);
    expect(h.game.state.level).toBe(6); // 접시 1개로는 아직
    makePlate(h);
    expect(h.game.state.level).toBe(7);
    expect(h.game.finished).toBe(false);
    expect(h.of('review/issued').filter((e) => e.review.source === 'customer')).toHaveLength(2 + 4 + 4 + 4 + 2);
  });

  it('6단계부터 손님은 3명, 10단계부터 4명이고 대화 간격이 각 6초다', () => {
    const h = setupV2();
    playUntilLevel(h, 6);
    tickTo(h, h.now + 10);
    expect(h.game.state.seatCount).toBe(3);
    expect(h.game.state.customers.map((c) => c.dialogueIntervalSec)).toEqual([6, 6, 6]);
    playUntilLevel(h, 10);
    tickTo(h, h.now + 12);
    expect(h.game.state.seatCount).toBe(4);
    expect(h.game.state.customers.map((c) => c.dialogueIntervalSec)).toEqual([6, 6, 6, 6]);
  });

  it('손님 인내는 단계별 범위다: 2단계 48초, 7단계 하한 48 − 12/14초(난수 0)', () => {
    const h = setupV2({ rng: () => 0 });
    playUntilLevel(h, 2);
    const t2 = customerEnteredAt(h);
    tickTo(h, t2 + 10);
    expect(h.game.state.customers[0]?.patience).toBeCloseTo(10 / 48, 4);
    const { t: t7, id } = enterAt7(h);
    tickTo(h, t7 + 5);
    expect(h.game.state.customers.find((c) => c.id === id)?.patience).toBeCloseTo(5 / (48 - 12 / 14), 3);
  });

  it('인내 상한도 단계별이다: 7단계에서 난수 1 근처이면 96 − 24/14초', () => {
    const h = setupV2({ rng: () => 0.999999 });
    const { t: t7, id } = enterAt7(h);
    tickTo(h, t7 + 5);
    expect(h.game.state.customers.find((c) => c.id === id)?.patience).toBeCloseTo(5 / (96 - 24 / 14), 3);
  });
});

describe('패배: 가게 손님 4명이 모두 화남(GDD §진행)', () => {
  it('자리가 4 미만인 단계는 손님이 모두 화나도 판이 끝나지 않는다(fumedCount는 현재 가게의 화난 수)', () => {
    const h = setupV2();
    playUntilLevel(h, 3); // 자리 2
    tickTo(h, h.now + 150);
    expect(h.of('customer/fumed')).toHaveLength(2);
    expect(h.game.state.fumedCount).toBe(2);
    expect(h.game.finished).toBe(false);
    expect(h.of('session/game-over')).toEqual([]);
  });

  it('화난 손님을 서빙해 떠나면 화난 손님 수가 줄어든다(누적하지 않는다)', () => {
    const h = setupV2();
    playUntilLevel(h, 3);
    tickTo(h, h.now + 150);
    expect(h.game.state.fumedCount).toBe(2);
    makePlate(h);
    expect(h.game.state.fumedCount).toBe(1);
  });

  it('튜토리얼과 1단계는 화난 손님을 세지 않는다(손님이 없다)', () => {
    const h = setupV2({ tutorial: true });
    h.tick(300);
    expect(h.game.state.fumedCount).toBe(0);
    const g = setupV2();
    g.tick(300);
    expect([g.game.state.fumedCount, g.game.finished]).toEqual([0, false]);
  });

  it('4명 모두 화나는 순간 session/game-over를 한 번 내고 판이 끝나며 finished로 저장한다', () => {
    const h = setupV2();
    playToEnd(h);
    expect(h.game.state.level).toBeGreaterThanOrEqual(10);
    expect(h.of('session/game-over')).toEqual([{ reason: 'fumed', fumedCount: 4 }]);
    expect(h.game.finished).toBe(true);
    expect(h.game.state.fumedCount).toBe(4);
    expect(h.store.load()).toMatchObject({ finished: true, tutorialCompleted: true });
  });

  it('game-over는 마지막 customer/fumed 직후, 최고 기록 갱신 전이고 그 뒤에는 아무 이벤트도 나오지 않는다', () => {
    const h = setupV2({ best: 1 });
    playToEnd(h);
    const types = h.log.map((r) => r.type);
    const over = types.indexOf('session/game-over');
    expect(types[over - 1]).toBe('customer/fumed');
    expect(types[over + 1]).toBe('score/new-best');
    expect(types.slice(over + 2)).toEqual([]);
    const n = h.log.length;
    h.tick(120);
    expect(h.log.length).toBe(n);
  });

  it('패배로 끝날 때 최고 가게 점수를 갱신한다(기존 finish 흐름)', () => {
    const h = setupV2({ best: 100 });
    playToEnd(h);
    const score = h.game.state.shopScore;
    expect(h.of('score/new-best')).toEqual([{ score, previous: 100 }]);
    expect(h.bestStore.load()).toBe(score);
  });

  it('3명이 화나고 1명이 정상이면 계속된다. 화난 손님을 서빙하면 수가 줄고, 남은 손님이 화나도 4명이 되지 않으면 끝나지 않는다', () => {
    const c = controlled(0.99); // 인내 거의 최대: 입장 순서대로 3초 간격으로 화난다
    const h = setupV2({ rng: c.rng });
    playUntilLevel(h, 10);
    tickTo(h, h.now + 12);
    expect(h.game.state.customers).toHaveLength(4);
    const finish = makePlate(h, {}, true);
    for (let i = 0; i < 2000 && h.game.state.fumedCount < 3 && !h.game.finished; i++) h.tick(0.1);
    expect(h.game.state.fumedCount).toBe(3);
    expect(h.game.finished).toBe(false);
    finish();
    expect(h.game.state.fumedCount).toBeLessThan(3); // 서빙한 화난 손님이 떠났다
    expect(h.game.finished).toBe(false);
    tickTo(h, h.now + 2.5);
    expect(h.game.finished).toBe(false); // 새로 입장한 손님은 화나지 않았다
  });
});
