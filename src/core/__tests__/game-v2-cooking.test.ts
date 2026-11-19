import { describe, expect, it } from 'vitest';
import type { Material } from '../../contracts';
import { BATTER, MARGARINE, fill, reach, reachDone, setupV2, tickUntilBar, HIT1, MISS } from './helpers-v2';

describe('구멍 상태기계(GDD §굽기 상태 흐름)', () => {
  it('빈칸 → 기름칠 → 익힘 → (3초) 익힘 완료', () => {
    const h = setupV2();
    expect(h.hole(0).stage).toBe('empty');
    h.place(0, MARGARINE);
    expect(h.hole(0).stage).toBe('greased');
    h.place(0, BATTER);
    expect(h.hole(0).stage).toBe('cooking');
    h.tick(2.9);
    expect(h.hole(0).stage).toBe('cooking');
    expect(h.hole(0).cookElapsedSec).toBeCloseTo(2.9);
    h.tick(0.1);
    expect(h.hole(0).stage).toBe('cooked');
    expect(h.hole(0).cookElapsedSec).toBe(0);
  });

  it('구멍은 서로 독립이다', () => {
    const h = setupV2();
    reach(h, 0, 2);
    h.tick(1);
    h.place(3, MARGARINE);
    expect(h.hole(0).stage).toBe('cooking');
    expect(h.hole(3).stage).toBe('greased');
    expect(h.hole(1).stage).toBe('empty');
    h.tick(2);
    expect(h.hole(0).stage).toBe('cooked');
    expect(h.hole(3).stage).toBe('greased');
  });

  it('익힘 완료에 속재료를 놓으면 속재료 후, 함정 재료도 본게임에서는 받는다', () => {
    const h = setupV2();
    reach(h, 0, 3);
    h.place(0, fill('wasabi'));
    expect(h.hole(0).stage).toBe('filled');
    expect(h.hole(0).filling).toBe('wasabi');
    expect(h.hole(0).noFilling).toBe(false);
    expect(h.of('cook/rejected')).toEqual([]);
  });

  const accepted = new Set(['0:margarine', '1:batter', '3:filling']);
  const materials: readonly Material[] = [MARGARINE, BATTER, fill()];
  const cases = [0, 1, 2, 3, 4, 5].flatMap((level) =>
    materials.filter((m) => !accepted.has(`${level}:${m.kind}`)).map((m) => [level, m] as const),
  );
  it.each(cases)('받을 수 없는 상태(%i)의 재료 %j는 거부(invalid-stage)하고 상태를 바꾸지 않는다', (level, material) => {
    const h = setupV2();
    reach(h, 2, level);
    const before = h.hole(2);
    h.place(2, material);
    expect(h.of('cook/rejected')).toEqual([{ hole: 2, reason: 'invalid-stage' }]);
    expect(h.hole(2)).toEqual(before);
  });

  it('익힘 중 속재료 놓기는 거부되고 익힘 진행에 영향이 없다', () => {
    const h = setupV2();
    reach(h, 0, 2);
    h.tick(1);
    h.place(0, fill());
    expect(h.of('cook/rejected')).toEqual([{ hole: 0, reason: 'invalid-stage' }]);
    h.tick(2);
    expect(h.hole(0).stage).toBe('cooked');
  });

  it('범위 밖 구멍 입력은 무시한다', () => {
    const h = setupV2();
    expect(() => h.place(9, MARGARINE)).not.toThrow();
    expect(() => h.roll(-1)).not.toThrow();
  });
});

describe('굴리기', () => {
  it('속재료 후 구멍을 W1 안에서 탭하면 적중, 굴림 1', () => {
    const h = setupV2();
    reach(h, 0, 4);
    tickUntilBar(h, HIT1);
    h.roll(0);
    expect(h.of('cook/rolled')).toEqual([{ hole: 0, hit: true }]);
    expect(h.hole(0).stage).toBe('rolled');
    expect(h.hole(0).rollHits).toEqual([true, null]);
  });

  it('W1 밖이면 빗나감이지만 감점 없이 굴림 1로 넘어간다', () => {
    const h = setupV2();
    reach(h, 0, 4);
    tickUntilBar(h, MISS);
    h.roll(0);
    expect(h.of('cook/rolled')).toEqual([{ hole: 0, hit: false }]);
    expect(h.hole(0).stage).toBe('rolled');
    expect(h.hole(0).rollHits).toEqual([false, null]);
  });

  it('굴림 1을 W2 안에서 탭하면 완성이 되고 탐 타이머가 0에서 시작한다', () => {
    const h = setupV2();
    reachDone(h, 0);
    expect(h.of('cook/rolled')).toEqual([
      { hole: 0, hit: true },
      { hole: 0, hit: true },
    ]);
    expect(h.hole(0).stage).toBe('done');
    expect(h.hole(0).rollHits).toEqual([true, true]);
    expect(h.hole(0).burnElapsedSec).toBe(0);
  });

  it('W2 밖이면 빗나감으로 기록되고 완성은 된다', () => {
    const h = setupV2();
    reach(h, 0, 5);
    tickUntilBar(h, MISS);
    h.roll(0);
    expect(h.hole(0).stage).toBe('done');
    expect(h.hole(0).rollHits).toEqual([true, false]);
  });

  // 3.0초에 바는 1.0이고 이후 하강한다: 3.24s=0.60, 3.36s=0.40(W1 경계).
  it.each<[number, boolean, string]>([
    [0.24, true, 'W1 상단 60'],
    [0.234, false, '61'],
    [0.36, true, 'W1 하단 40'],
    [0.366, false, '39'],
    [0.3, true, '50'],
  ])('W1 경계: +%f초 → 적중 %s (%s)', (dt, hit) => {
    const h = setupV2();
    reach(h, 0, 4);
    h.tick(dt);
    h.roll(0);
    expect(h.of('cook/rolled')[0]?.hit).toBe(hit);
  });

  // 굴림 1을 3.24s(0.60)에 적중시킨 뒤: 3.246=0.59, 3.252=0.58, 3.348=0.42, 3.354=0.41.
  it.each<[number, boolean, string]>([
    [0.006, false, '59'],
    [0.012, true, 'W2 상단 58'],
    [0.108, true, 'W2 하단 42'],
    [0.114, false, '41'],
  ])('W2 경계: +%f초 → 적중 %s (%s)', (dt, hit) => {
    const h = setupV2();
    reach(h, 0, 4);
    h.tick(0.24);
    h.roll(0);
    h.tick(dt);
    h.roll(0);
    expect(h.of('cook/rolled')[1]?.hit).toBe(hit);
  });

  it('속재료 전 굴리기(익힘·익힘 완료): 속 없음으로 고정되고 그 탭이 굴리기 1(W1 판정)이다', () => {
    for (const level of [2, 3]) {
      const h = setupV2();
      reach(h, 0, level);
      tickUntilBar(h, HIT1);
      h.roll(0);
      expect(h.hole(0).stage).toBe('rolled');
      expect(h.hole(0).noFilling).toBe(true);
      expect(h.hole(0).filling).toBeNull();
      expect(h.hole(0).rollHits).toEqual([true, null]);
      expect(h.of('cook/rolled')).toEqual([{ hole: 0, hit: true }]);
      h.place(0, fill());
      expect(h.of('cook/rejected')).toEqual([{ hole: 0, reason: 'invalid-stage' }]);
      expect(h.hole(0).filling).toBeNull();
    }
  });

  it('속재료 전 굴리기도 W1 밖이면 빗나감', () => {
    const h = setupV2();
    reach(h, 0, 2);
    tickUntilBar(h, MISS);
    h.roll(0);
    expect(h.hole(0).rollHits).toEqual([false, null]);
  });

  it('익힘 중 굴려도 익힘 타이머는 끝나지 않는다(굴림 1 상태에서 cookElapsedSec 0)', () => {
    const h = setupV2();
    reach(h, 0, 2);
    h.tick(1);
    h.roll(0);
    expect(h.hole(0).cookElapsedSec).toBe(0);
    h.tick(5);
    expect(h.hole(0).stage).toBe('rolled');
  });

  it('굴릴 수 없는 상태의 탭은 cook/tap-ignored이고 상태·거부 이벤트가 없다', () => {
    const h = setupV2();
    h.roll(0); // 빈칸
    h.place(1, MARGARINE);
    h.roll(1); // 기름칠
    expect(h.of('cook/tap-ignored')).toEqual([{ hole: 0 }, { hole: 1 }]);
    expect(h.of('cook/rolled')).toEqual([]);
    expect(h.of('cook/rejected')).toEqual([]);
    expect(h.hole(0).stage).toBe('empty');
    expect(h.hole(1).stage).toBe('greased');
  });

  it('완성·어두움·탄 것 탭도 효과 없음', () => {
    const h = setupV2();
    reachDone(h, 0);
    h.roll(0);
    h.tick(3);
    expect(h.hole(0).stage).toBe('dark');
    h.roll(0);
    h.tick(2);
    expect(h.hole(0).stage).toBe('burnt');
    h.roll(0);
    expect(h.of('cook/tap-ignored')).toEqual([{ hole: 0 }, { hole: 0 }, { hole: 0 }]);
    expect(h.hole(0).stage).toBe('burnt');
  });
});

describe('전역 타이밍 바(1.2초 주기 왕복)', () => {
  it.each([
    [0, 0],
    [0.3, 0.5],
    [0.6, 1],
    [0.9, 0.5],
    [1.2, 0],
    [1.5, 0.5],
    [3.0, 1],
  ] as const)('t=%f초 위치 %f', (t, pos) => {
    const h = setupV2();
    h.tick(t);
    expect(h.game.state.barPosition).toBeCloseTo(pos, 6);
  });

  it('구멍 상태와 무관하게 세션 내내 계속된다', () => {
    const h = setupV2();
    reach(h, 0, 3);
    h.tick(12.3);
    expect(h.game.state.barPosition).toBeCloseTo(0.5, 6);
  });
});

describe('barZone: 마지막으로 만진 구멍의 영역', () => {
  it('처음에는 null', () => {
    expect(setupV2().game.state.barZone).toBeNull();
  });

  it('속재료 후 구멍은 W1, 굴림 1 구멍은 W2', () => {
    const h = setupV2();
    reach(h, 2, 4);
    expect(h.game.state.barZone).toEqual({ from: 0.4, to: 0.6 });
    expect(h.hole(2).rollZone).toEqual({ from: 0.4, to: 0.6 });
    tickUntilBar(h, HIT1);
    h.roll(2);
    expect(h.game.state.barZone).toEqual({ from: 0.42, to: 0.58 });
    expect(h.hole(2).rollZone).toEqual({ from: 0.42, to: 0.58 });
  });

  it('다른 구멍을 만지면 그 구멍의 영역으로 바뀐다', () => {
    const h = setupV2();
    reach(h, 0, 4);
    reach(h, 1, 1);
    expect(h.game.state.barZone).toBeNull(); // 구멍 1은 기름칠이라 영역 없음
    tickUntilBar(h, HIT1);
    h.roll(0);
    expect(h.game.state.barZone).toEqual({ from: 0.42, to: 0.58 });
  });

  it('굴릴 수 없는 구멍은 영역이 null이다', () => {
    const h = setupV2();
    reach(h, 0, 1);
    expect(h.hole(0).rollZone).toBeNull();
    expect(h.hole(1).rollZone).toBeNull();
  });

  it('익힘·익힘 완료는 탭으로 굴리면 W1로 판정되므로 W1을 보여 준다', () => {
    const h = setupV2();
    const w1 = { from: 0.4, to: 0.6 };
    reach(h, 0, 2);
    expect(h.hole(0).stage).toBe('cooking');
    expect(h.hole(0).rollZone).toEqual(w1);
    reach(h, 1, 3);
    expect(h.hole(1).stage).toBe('cooked');
    expect(h.hole(1).rollZone).toEqual(w1);
    expect(h.game.state.barZone).toEqual(w1);
  });
});
