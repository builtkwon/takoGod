import { describe, expect, it } from 'vitest';
import { HIT2, reach, reachDone, setupV2, tickUntilBar } from './helpers-v2';

/** 같은 시각에 완성된 구멍들을 만든다. */
const done = reachDone;

describe('탐 타이머(완성부터 누적, 3초 어두움, 5초 탐)', () => {
  it('완성 구멍은 burnElapsedSec이 늘고 3초에 어두워진다', () => {
    const h = setupV2();
    done(h, 0);
    h.tick(2.9);
    expect(h.hole(0).stage).toBe('done');
    expect(h.hole(0).burnElapsedSec).toBeCloseTo(2.9);
    expect(h.of('cook/darkened')).toEqual([]);
    h.tick(0.1);
    expect(h.hole(0).stage).toBe('dark');
    expect(h.of('cook/darkened')).toEqual([{ hole: 0 }]);
  });

  it('누적 5초에 탄다(어두워진 뒤 2초)', () => {
    const h = setupV2();
    done(h, 0);
    h.tick(3);
    h.tick(1.9);
    expect(h.hole(0).stage).toBe('dark');
    expect(h.of('cook/burnt')).toEqual([]);
    h.tick(0.1);
    expect(h.hole(0).stage).toBe('burnt');
    expect(h.of('cook/burnt')).toEqual([{ hole: 0 }]);
    h.tick(10);
    expect(h.of('cook/burnt')).toHaveLength(1);
  });

  it('큰 dt 하나로 3초·5초를 건너뛰어도 어두움과 탐 이벤트가 모두 나온다', () => {
    const h = setupV2();
    done(h, 0);
    h.tick(6);
    expect(h.hole(0).stage).toBe('burnt');
    expect(h.of('cook/darkened')).toEqual([{ hole: 0 }]);
    expect(h.of('cook/burnt')).toEqual([{ hole: 0 }]);
  });

  it('익힘 완료(cooked) 구멍은 기다려도 벌칙이 없다', () => {
    const h = setupV2();
    h.place(0, { kind: 'margarine' });
    h.place(0, { kind: 'batter' });
    h.tick(60);
    expect(h.hole(0).stage).toBe('cooked');
    expect(h.of('cook/darkened')).toEqual([]);
  });
});

describe('들기·놓기', () => {
  it('들고 있는 동안 그 구멍의 탐 타이머가 멈추고, 취소(cancel)하면 이어서 센다', () => {
    const h = setupV2();
    done(h, 0);
    h.tick(2);
    h.pick(0);
    expect(h.game.state.holding).toBe(0);
    h.tick(10);
    expect(h.hole(0).stage).toBe('done');
    expect(h.hole(0).burnElapsedSec).toBeCloseTo(2);
    h.drop('cancel');
    expect(h.game.state.holding).toBeNull();
    expect(h.of('cook/rejected')).toEqual([]);
    expect(h.of('cook/dropped')).toEqual([]);
    h.tick(0.9);
    expect(h.hole(0).stage).toBe('done');
    h.tick(0.1);
    expect(h.hole(0).stage).toBe('dark');
  });

  it('다른 구멍의 탐 타이머는 들고 있어도 계속 간다', () => {
    const h = setupV2();
    done(h, 0, 1);
    h.pick(0);
    h.tick(3);
    expect(h.hole(0).stage).toBe('done');
    expect(h.hole(1).stage).toBe('dark');
  });

  it('완성품을 other에 놓으면 떨어져 빈칸이 되고 cook/dropped, 후네는 그대로', () => {
    const h = setupV2();
    done(h, 0);
    h.pick(0);
    h.drop('other');
    expect(h.hole(0).stage).toBe('empty');
    expect(h.game.state.holding).toBeNull();
    expect(h.of('cook/dropped')).toEqual([{ hole: 0, item: 'done' }]);
    expect(h.of('cook/rejected')).toEqual([]);
    expect(h.game.state.fune).toHaveLength(0);
  });

  it("'offscreen'(deprecated)은 'other'와 같다", () => {
    const h = setupV2();
    done(h, 0);
    h.pick(0);
    h.drop('offscreen');
    expect(h.hole(0).stage).toBe('empty');
    expect(h.of('cook/dropped')).toEqual([{ hole: 0, item: 'done' }]);
    expect(h.game.state.fune).toHaveLength(0);
  });

  it('들기는 동시에 1개: 두 번째 들기는 already-holding으로 거부', () => {
    const h = setupV2();
    done(h, 0, 1);
    h.pick(0);
    h.pick(1);
    expect(h.of('cook/rejected')).toEqual([{ hole: 1, reason: 'already-holding' }]);
    expect(h.game.state.holding).toBe(0);
  });

  it('완성·어두움·탄 것이 아닌 구멍은 들 수 없다(invalid-stage)', () => {
    const h = setupV2();
    h.pick(0);
    expect(h.of('cook/rejected')).toEqual([{ hole: 0, reason: 'invalid-stage' }]);
    expect(h.game.state.holding).toBeNull();
  });

  it('들고 있지 않을 때 놓기는 무시한다', () => {
    const h = setupV2();
    done(h, 0);
    h.drop('fune');
    expect(h.of('fune/added')).toEqual([]);
    expect(h.hole(0).stage).toBe('done');
  });

  it('후네에 놓으면 구멍이 비고 fune/added와 FuneItem이 나간다', () => {
    const h = setupV2();
    done(h, 0);
    h.pick(0);
    h.drop('fune');
    expect(h.hole(0).stage).toBe('empty');
    expect(h.hole(0).filling).toBeNull();
    expect(h.hole(0).rollHits).toEqual([null, null]);
    expect(h.game.state.holding).toBeNull();
    expect(h.of('fune/added')).toEqual([
      { hole: 0, item: { rolledPerfectly: true, filling: 'octopus', noFilling: false, dark: false }, count: 1 },
    ]);
    expect(h.game.state.fune).toHaveLength(1);
  });

  it('어두운 것도 후네에 담을 수 있다(item.dark)', () => {
    const h = setupV2();
    done(h, 0);
    h.tick(3);
    h.pick(0);
    h.drop('fune');
    expect(h.of('fune/added')[0]?.item.dark).toBe(true);
    expect(h.hole(0).stage).toBe('empty');
  });

  it('어두운 것을 other에 놓으면 떨어져 빈칸이 되고 cook/dropped{dark}', () => {
    const h = setupV2();
    done(h, 0);
    h.tick(3);
    h.pick(0);
    h.drop('other');
    expect(h.hole(0).stage).toBe('empty');
    expect(h.of('cook/dropped')).toEqual([{ hole: 0, item: 'dark' }]);
    expect(h.of('cook/rejected')).toEqual([]);
    expect(h.game.state.fune).toHaveLength(0);
  });

  it.each(['fune', 'other', 'offscreen'] as const)('탄 것을 %s에 놓으면 빈칸이 되고 cook/dropped{burnt}, 후네에 담기지 않는다', (target) => {
    const h = setupV2();
    done(h, 0);
    h.tick(5);
    h.pick(0);
    h.drop(target);
    expect(h.hole(0).stage).toBe('empty');
    expect(h.of('cook/dropped')).toEqual([{ hole: 0, item: 'burnt' }]);
    expect(h.of('cook/rejected')).toEqual([]);
    expect(h.of('fune/added')).toEqual([]);
    expect(h.game.state.holding).toBeNull();
    expect(h.game.state.fune).toHaveLength(0);
  });

  it('탄 것을 cancel하면 탄 구멍으로 돌아간다', () => {
    const h = setupV2();
    done(h, 0);
    h.tick(5);
    h.pick(0);
    h.drop('cancel');
    expect(h.hole(0).stage).toBe('burnt');
    expect(h.of('cook/dropped')).toEqual([]);
    expect(h.game.state.holding).toBeNull();
  });
});

describe('warn: 탐 타이머가 도는 완성 구멍이 2개 이상이면 깜빡임', () => {
  it('1개면 경고 없음, 2개면 둘 다 경고', () => {
    const h = setupV2();
    reach(h, [0, 1, 2], 5);
    tickUntilBar(h, HIT2);
    h.roll(0);
    expect(h.hole(0).warn).toBe(false);
    h.roll(1);
    expect(h.hole(0).warn).toBe(true);
    expect(h.hole(1).warn).toBe(true);
    expect(h.hole(2).warn).toBe(false);
  });

  it('들고 있는 구멍은 타이머가 멈췄으므로 세지 않는다', () => {
    const h = setupV2();
    done(h, 0, 1);
    h.pick(0);
    expect(h.hole(0).warn).toBe(false);
    expect(h.hole(1).warn).toBe(false);
    h.drop('cancel');
    expect(h.hole(0).warn).toBe(true);
    expect(h.hole(1).warn).toBe(true);
  });

  it('후네에 담아 비우면 경고가 꺼진다', () => {
    const h = setupV2();
    done(h, 0, 1);
    h.pick(0);
    h.drop('fune');
    expect(h.hole(1).warn).toBe(false);
  });

  it('어두운 구멍도 타이머가 돌고 있으면 세고 경고한다', () => {
    const h = setupV2();
    reach(h, [0, 1], 5);
    tickUntilBar(h, HIT2);
    h.roll(0);
    h.tick(3);
    tickUntilBar(h, HIT2);
    h.roll(1);
    expect(h.hole(0).stage).toBe('dark');
    expect(h.hole(0).warn).toBe(true);
    expect(h.hole(1).warn).toBe(true);
  });

  it('탄 구멍은 세지 않는다', () => {
    const h = setupV2();
    reach(h, [0, 1], 5);
    tickUntilBar(h, HIT2);
    h.roll(0);
    h.tick(5);
    tickUntilBar(h, HIT2);
    h.roll(1);
    expect(h.hole(0).stage).toBe('burnt');
    expect(h.hole(0).warn).toBe(false);
    expect(h.hole(1).warn).toBe(false);
  });
});
