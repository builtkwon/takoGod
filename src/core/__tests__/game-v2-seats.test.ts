import { describe, expect, it } from 'vitest';
import { customerEnteredAt, makePlate, playUntilLevel, setupV2, tickTo } from './helpers-v2';

type H = ReturnType<typeof setupV2>;

/** 테스트 전용: 대화 타이머를 직접 맞춘다(여러 손님이 같은 틱에 대화를 열게 하는 상황). */
const internals = (h: H) => h.game as unknown as { guests: { id: string; untilDialogue: number }[]; spawnTimer: number | null; startLevel(level: number): void };

const enteredTimes = (h: H) => h.log.filter((r) => r.type === 'customer/entered').map((r) => r.t);

describe('자리 수(동시 손님 상한, GDD §진행)', () => {
  it.each([
    [1, 0],
    [2, 1],
    [3, 2],
    [5, 2],
    [6, 3],
    [9, 3],
    [10, 4],
  ])('%i단계 state.seatCount는 %i이고 손님은 그 수를 넘지 않는다', (level, seats) => {
    const h = setupV2();
    playUntilLevel(h, level);
    expect(h.game.state.seatCount).toBe(seats);
    tickTo(h, h.now + 12);
    expect(h.game.state.customers).toHaveLength(seats);
  });

  it('튜토리얼은 자리 0이다', () => {
    expect(setupV2({ tutorial: true }).game.state.seatCount).toBe(0);
  });
});

describe('입장 타이밍(GDD §손님 대화 손님 흐름)', () => {
  it('단계 시작 때 가게가 비어 있으면 손님1이 바로 입장하고, 빈 자리가 더 있으면 직전 입장 3초 뒤 입장한다', () => {
    const h = setupV2();
    playUntilLevel(h, 2);
    const phaseAt = h.log.filter((r) => r.type === 'phase/changed').at(-1)?.t ?? NaN;
    expect(customerEnteredAt(h, 0)).toBe(phaseAt);
    const g = setupV2();
    playUntilLevel(g, 3);
    tickTo(g, g.now + 4);
    const [a, b] = enteredTimes(g).slice(-2);
    expect((b ?? 0) - (a ?? 0)).toBeCloseTo(3, 1);
  });

  it('서빙받은 손님이 퇴장해 자리가 나면 2초 뒤 새 손님이 입장한다', () => {
    const h = setupV2();
    playUntilLevel(h, 3);
    tickTo(h, h.now + 4); // 두 자리가 찬다
    expect(h.game.state.customers).toHaveLength(2);
    makePlate(h);
    const left = h.log.filter((r) => r.type === 'customer/left').at(-1)?.t ?? NaN;
    tickTo(h, left + 3);
    const t = enteredTimes(h).at(-1) ?? NaN;
    expect(t - left).toBeCloseTo(2, 1);
    expect(h.game.state.customers).toHaveLength(2);
  });

  it('입장은 접시 목표와 무관하다: 서빙한 접시가 목표 직전이어도 빈 자리에 손님이 들어온다', () => {
    const h = setupV2();
    playUntilLevel(h, 3);
    tickTo(h, h.now + 4);
    makePlate(h);
    makePlate(h);
    makePlate(h); // 3단계 접시 4개 중 3개
    expect(h.game.state.level).toBe(3);
    tickTo(h, h.now + 3);
    expect(h.game.state.customers).toHaveLength(2);
  });

  it('손님은 단계를 넘어 인내·주문 상태 그대로 남는다', () => {
    const h = setupV2();
    playUntilLevel(h, 5);
    tickTo(h, h.now + 4);
    for (let i = 0; i < 3; i++) makePlate(h);
    tickTo(h, h.now + 4); // 두 자리를 채운다
    const before = h.game.state.customers.map((c) => c.id);
    expect(before).toHaveLength(2);
    makePlate(h); // 5단계 마지막 접시 → 6단계
    expect(h.game.state.level).toBe(6);
    const stayed = h.game.state.customers.filter((c) => before.includes(c.id));
    expect(stayed.length).toBeGreaterThanOrEqual(1);
    expect(stayed[0]?.patience).toBeGreaterThan(0); // 인내가 0으로 돌아가지 않았다
    expect(h.game.state.seatCount).toBe(3);
    tickTo(h, h.now + 8);
    expect(h.game.state.customers).toHaveLength(3); // 늘어난 자리는 3초 간격으로 채운다
  });
});

describe('입장 타이머 경우 정리(GDD §손님 대화 손님 흐름)', () => {
  it('단계 시작 때 손님이 있고 상한이 늘어 빈 자리가 생기면 단계 시작부터 3초 뒤 입장한다', () => {
    const h = setupV2();
    playUntilLevel(h, 5);
    tickTo(h, h.now + 4);
    const g = internals(h);
    expect(h.game.state.customers).toHaveLength(2);
    expect(g.spawnTimer).toBeNull(); // 자리가 찼고 예약된 입장이 없다
    const before = h.of('customer/entered').length;
    g.startLevel(6); // 상한 2 → 3, 손님은 이월
    const start = h.now;
    tickTo(h, start + 2.8);
    expect(h.of('customer/entered')).toHaveLength(before);
    tickTo(h, start + 3.2);
    expect(h.of('customer/entered')).toHaveLength(before + 1);
    expect(h.game.state.customers).toHaveLength(3);
  });

  it('퇴장 2초 타이머가 돌고 있으면 단계가 바뀌어도 그 2초를 유지한다', () => {
    const h = setupV2();
    playUntilLevel(h, 5);
    for (let i = 0; i < 3; i++) makePlate(h);
    tickTo(h, h.now + 4);
    expect(h.game.state.customers).toHaveLength(2);
    makePlate(h); // 5단계 마지막 접시: 손님이 퇴장하며 2초 타이머, 이어서 6단계 시작
    expect(h.game.state.level).toBe(6);
    const left = h.log.filter((r) => r.type === 'customer/left').at(-1)?.t ?? NaN;
    const n = h.of('customer/entered').length;
    tickTo(h, left + 1.9);
    expect(h.of('customer/entered')).toHaveLength(n);
    tickTo(h, left + 2.2);
    expect(h.of('customer/entered')).toHaveLength(n + 1);
    const t = enteredTimes(h).at(-1) ?? NaN;
    expect(t - left).toBeCloseTo(2, 1);
  });
});

describe('대화 동시 최대 2명(GDD §손님 대화)', () => {
  const setup = () => {
    const h = setupV2();
    playUntilLevel(h, 10);
    tickTo(h, h.now + 12);
    expect(h.game.state.customers).toHaveLength(4);
    for (const d of h.game.state.activeDialogues) h.answer(d.customerId, 'good'); // 열려 있는 대화를 먼저 닫는다
    const g = internals(h);
    for (const x of g.guests) x.untilDialogue = 0.05; // 4명이 같은 틱에 대화를 열려 한다
    return { h, ids: g.guests.map((x) => x.id) };
  };

  it('대화 타이머가 끝난 손님이 4명이어도 대화 중인 손님은 2명이다', () => {
    const { h, ids } = setup();
    h.tick(0.1);
    expect(h.game.state.activeDialogues.map((d) => d.customerId)).toEqual([ids[0], ids[1]]);
  });

  it('대화가 끝나면 먼저 대기한 손님부터 시작한다(대기 순서)', () => {
    const { h, ids } = setup();
    h.tick(0.1);
    h.answer(ids[1] as string, 'good');
    h.tick(0.1);
    expect(h.game.state.activeDialogues.map((d) => d.customerId).sort()).toEqual([ids[0], ids[2]].sort());
    h.answer(ids[0] as string, 'good');
    h.tick(0.1);
    expect(h.game.state.activeDialogues.map((d) => d.customerId).sort()).toEqual([ids[2], ids[3]].sort());
  });

  it('대기하는 동안에도 인내는 흐른다', () => {
    const { h, ids } = setup();
    h.tick(0.1);
    const p0 = h.game.state.customers.find((c) => c.id === ids[3])?.patience ?? 0;
    tickTo(h, h.now + 3);
    expect(h.game.state.customers.find((c) => c.id === ids[3])?.patience ?? 0).toBeGreaterThan(p0);
  });
});
