import { describe, expect, it } from 'vitest';
import { controlled, customerEnteredAt, makePlate, playToEnd, playUntilLevel, setupV2, tickTo } from './helpers-v2';

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

  it('6단계부터 손님은 2명이고 대화 간격이 각 6초다', () => {
    const h = setupV2();
    playUntilLevel(h, 6);
    h.tick(3.1);
    expect(h.game.state.customers.map((c) => c.dialogueIntervalSec)).toEqual([6, 6]);
  });

  it('손님 인내는 단계별 범위다: 2단계 30초, 7단계 하한 30 − 7.5/14초(난수 0)', () => {
    const h = setupV2({ rng: () => 0 });
    playUntilLevel(h, 2);
    const t2 = customerEnteredAt(h);
    tickTo(h, t2 + 10);
    expect(h.game.state.customers[0]?.patience).toBeCloseTo(10 / 30, 4);
    playUntilLevel(h, 7);
    const t7 = customerEnteredAt(h, h.of('customer/entered').length - 1);
    tickTo(h, t7 + 5);
    expect(h.game.state.customers[0]?.patience).toBeCloseTo(5 / (30 - 7.5 / 14), 3);
  });

  it('인내 상한도 단계별이다: 7단계에서 난수 1 근처이면 60 − 15/14초', () => {
    const h = setupV2({ rng: () => 0.999999 });
    playUntilLevel(h, 7);
    const t7 = customerEnteredAt(h, h.of('customer/entered').length - 1);
    tickTo(h, t7 + 5);
    expect(h.game.state.customers[0]?.patience).toBeCloseTo(5 / (60 - 15 / 14), 3);
  });
});

describe('패배: 화난 손님 4명(GDD §진행)', () => {
  it('손님이 인내 100%에 닿을 때마다 fumedCount가 1씩 는다(손님은 떠나지 않는다)', () => {
    const h = setupV2();
    playUntilLevel(h, 3); // 손님 2명
    tickTo(h, h.now + 65);
    expect(h.of('customer/fumed')).toHaveLength(2);
    expect(h.game.state.fumedCount).toBe(2);
    expect(h.game.finished).toBe(false);
    expect(h.of('session/game-over')).toEqual([]);
  });

  it('화난 손님 수는 단계가 바뀌어도 유지된다', () => {
    const h = setupV2();
    playUntilLevel(h, 2);
    tickTo(h, h.now + 65);
    expect(h.game.state.fumedCount).toBe(1);
    makePlate(h);
    makePlate(h);
    expect(h.game.state.level).toBe(3);
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

  it('4명이 되는 순간 session/game-over를 한 번 내고 판이 끝나며 finished로 저장한다', () => {
    const h = setupV2();
    playToEnd(h);
    expect(h.of('customer/fumed')).toHaveLength(4);
    expect(h.of('session/game-over')).toEqual([{ reason: 'fumed', fumedCount: 4 }]);
    expect(h.game.finished).toBe(true);
    expect(h.game.state.fumedCount).toBe(4);
    expect(h.store.load()).toMatchObject({ finished: true, tutorialCompleted: true });
  });

  it('game-over는 네 번째 customer/fumed 직후, 최고 기록 갱신 전이고 그 뒤에는 아무 이벤트도 나오지 않는다', () => {
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

  it('같은 틱에 두 손님이 인내 100%에 닿아 한계를 채워도 game-over는 한 번이고 그 뒤 이벤트가 없다', () => {
    // 2단계에서 손님 둘이 차례로 화나 2명을 채운 뒤, 3단계 두 손님(3초 간격 입장)의 인내를 30초·27초로 맞춰 같은 틱에 닿게 한다.
    const c = controlled(0.5); // 인내 30 + 0.5 × 30 = 45초
    const h = setupV2({ rng: c.rng });
    playUntilLevel(h, 2);
    tickTo(h, h.now + 65);
    makePlate(h); // 첫 손님 서빙
    tickTo(h, h.now + 65); // 두 번째 손님도 화남
    expect(h.game.state.fumedCount).toBe(2);
    makePlate(h); // 3단계 시작, 손님3 입장(인내 45초)
    expect(h.game.state.level).toBe(3);
    const t3 = customerEnteredAt(h, h.of('customer/entered').length - 1);
    c.set(0.4); // 손님4 인내 30 + 0.4 × 30 = 42초: 입장 3초 + 27초 = 손님3과 같은 시각
    tickTo(h, t3 + 3.1);
    c.set(null);
    // 전제: 두 손님이 있고 아직 아무도 더 화나지 않았다.
    expect(h.game.state.customers).toHaveLength(2);
    expect(h.game.state.fumedCount).toBe(2);
    expect(h.game.finished).toBe(false);

    tickTo(h, t3 + 50);

    const fumed = h.log.filter((r) => r.type === 'customer/fumed');
    expect(fumed).toHaveLength(4);
    expect(fumed[2]?.t).toBe(fumed[3]?.t); // 같은 틱
    expect(h.of('session/game-over')).toEqual([{ reason: 'fumed', fumedCount: 4 }]);
    expect(h.game.state.fumedCount).toBe(4);
    expect(h.game.finished).toBe(true);
    const types = h.log.map((r) => r.type);
    const over = types.indexOf('session/game-over');
    expect(types.slice(over - 2, over)).toEqual(['customer/fumed', 'customer/fumed']);
    expect(types.slice(over + 1)).toEqual(['score/new-best']); // 최고 기록 갱신 말고는 없다
    const n = h.log.length;
    h.tick(120);
    expect(h.log.length).toBe(n);
  });
});
