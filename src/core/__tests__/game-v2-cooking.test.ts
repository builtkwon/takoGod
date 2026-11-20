import { describe, expect, it } from 'vitest';
import type { Material } from '../../contracts';
import type { RollZone } from '../../contracts';
import { BATTER, MARGARINE, controlled, fill, playUntilPhase, reach, reachDone, rollHole, scripted, setupV2, tickTo, tickUntilZone } from './helpers-v2';

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

/** rng를 0.5로 고정하면 영역이 바 가운데에 놓인다: P1 W1 0.35~0.65, W2 0.38~0.62. */
const centered = () => setupV2({ rng: () => 0.5, liveZones: true });
/** 상승 구간(3.2~4.0초)에서 바가 p에 오는 시각. */
const up = (p: number) => 3.2 + p * 0.8;
/** 하강 구간(4.0~4.8초)에서 바가 p에 오는 시각. */
const down = (p: number) => 4.0 + (1 - p) * 0.8;

describe('굴리기', () => {
  it('속재료 후 구멍을 W1 안에서 탭하면 적중, 굴림 1', () => {
    const h = setupV2();
    reach(h, 0, 4);
    rollHole(h, 0);
    expect(h.of('cook/rolled')).toEqual([{ hole: 0, hit: true }]);
    expect(h.hole(0).stage).toBe('rolled');
    expect(h.hole(0).rollHits).toEqual([true, null]);
  });

  it('W1 밖이면 빗나감이지만 감점 없이 굴림 1로 넘어간다', () => {
    const h = setupV2();
    reach(h, 0, 4);
    rollHole(h, 0, false);
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
    rollHole(h, 0, false);
    expect(h.hole(0).stage).toBe('done');
    expect(h.hole(0).rollHits).toEqual([true, false]);
  });

  it.each<[number, boolean, string]>([
    [0.65, true, 'W1 상단'],
    [0.66, false, '상단 밖'],
    [0.35, true, 'W1 하단'],
    [0.34, false, '하단 밖'],
    [0.5, true, '가운데'],
  ])('W1 경계: 바 %f → 적중 %s (%s)', (p, hit) => {
    const h = centered();
    reach(h, 0, 4);
    tickTo(h, up(p));
    h.roll(0);
    expect(h.of('cook/rolled')[0]?.hit).toBe(hit);
  });

  // 굴림 1을 바 0.5(3.6초)에 적중시킨 뒤 하강 구간에서 W2(0.38~0.62)를 판정한다.
  it.each<[number, boolean, string]>([
    [0.63, false, 'W2 상단 밖'],
    [0.62, true, 'W2 상단'],
    [0.38, true, 'W2 하단'],
    [0.37, false, 'W2 하단 밖'],
  ])('W2 경계: 바 %f → 적중 %s (%s)', (p, hit) => {
    const h = centered();
    reach(h, 0, 4);
    tickTo(h, up(0.5));
    h.roll(0);
    tickTo(h, down(p));
    h.roll(0);
    expect(h.of('cook/rolled')[1]?.hit).toBe(hit);
  });

  it('속재료 전 굴리기(익힘·익힘 완료): 속 없음으로 고정되고 그 탭이 굴리기 1(W1 판정)이다', () => {
    for (const level of [2, 3]) {
      const h = setupV2();
      reach(h, 0, level);
      rollHole(h, 0);
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
    rollHole(h, 0, false);
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
    h.tick(4);
    expect(h.hole(0).stage).toBe('dark');
    h.roll(0);
    h.tick(2);
    expect(h.hole(0).stage).toBe('burnt');
    h.roll(0);
    expect(h.of('cook/tap-ignored')).toEqual([{ hole: 0 }, { hole: 0 }, { hole: 0 }]);
    expect(h.hole(0).stage).toBe('burnt');
  });
});

describe('전역 타이밍 바(1.6초 주기 왕복)', () => {
  it.each([
    [0, 0],
    [0.4, 0.5],
    [0.8, 1],
    [1.2, 0.5],
    [1.6, 0],
    [2.0, 0.5],
    [4.0, 1],
  ] as const)('t=%f초 위치 %f', (t, pos) => {
    const h = setupV2();
    h.tick(t);
    expect(h.game.state.barPosition).toBeCloseTo(pos, 6);
  });

  it('구멍 상태와 무관하게 세션 내내 계속된다', () => {
    const h = setupV2();
    reach(h, 0, 3);
    h.tick(13.4);
    expect(h.game.state.barPosition).toBeCloseTo(0.5, 6);
  });
});

describe('영역 위치: 무작위(GDD §굽기·§손님 대화 난수 순서)', () => {
  it('반죽을 놓을 때 W1 위치를 뽑는다: P1 폭 0.30, 난수 0 → 0~0.3, 난수 1 근처 → 0.7~1', () => {
    for (const [r, from] of [
      [0, 0],
      [0.999999, 0.7 * 0.999999],
    ] as const) {
      const c = controlled(0.5);
      const h = setupV2({ rng: c.rng, liveZones: true });
      h.place(0, MARGARINE);
      c.set(r);
      h.place(0, BATTER);
      c.set(null);
      const z = h.hole(0).rollZone;
      expect(z?.from).toBeCloseTo(from, 9);
      expect((z?.to ?? 0) - (z?.from ?? 0)).toBeCloseTo(0.3, 9);
      expect(z?.to).toBeLessThanOrEqual(1);
    }
  });

  it('난수는 반죽 놓기마다 1개, 굴리기 1마다 1개를 뽑고 마가린·굴리기 2·속재료는 뽑지 않는다', () => {
    const sc = scripted([], 0.5);
    const h = setupV2({ rng: sc.rng, liveZones: true });
    const base = sc.used();
    h.place(0, MARGARINE);
    expect(sc.used()).toBe(base);
    h.place(0, BATTER);
    expect(sc.used()).toBe(base + 1);
    h.tick(3);
    h.place(0, fill());
    expect(sc.used()).toBe(base + 1);
    rollHole(h, 0);
    expect(sc.used()).toBe(base + 2);
    rollHole(h, 0);
    expect(sc.used()).toBe(base + 2);
  });

  it('W1 위치는 익힘·익힘 완료·속재료 후에 같은 값이고, W2는 굴리기 1에서 새로 뽑는다(P3 폭 W1 0.24, W2 0.20)', () => {
    const c = controlled(0.5);
    const h = setupV2({ rng: c.rng, liveZones: true });
    playUntilPhase(h, 'P3');
    c.set(0.25);
    h.place(0, MARGARINE);
    h.place(0, BATTER);
    const w1 = h.hole(0).rollZone;
    expect(w1?.from).toBeCloseTo(0.25 * 0.76, 9);
    expect((w1?.to ?? 0) - (w1?.from ?? 0)).toBeCloseTo(0.24, 9);
    h.tick(3);
    expect(h.hole(0).rollZone).toEqual(w1);
    h.place(0, fill());
    expect(h.hole(0).rollZone).toEqual(w1);
    c.set(0.75);
    rollHole(h, 0);
    const w2 = h.hole(0).rollZone;
    expect(w2?.from).toBeCloseTo(0.75 * 0.8, 9);
    expect((w2?.to ?? 0) - (w2?.from ?? 0)).toBeCloseTo(0.2, 9);
  });

  it('폭: P2도 W1 0.30·W2 0.24(P1·P2 구간)', () => {
    const h = setupV2();
    playUntilPhase(h, 'P2');
    h.place(0, MARGARINE);
    h.place(0, BATTER);
    const z = h.hole(0).rollZone as RollZone;
    expect(z.to - z.from).toBeCloseTo(0.3, 9);
  });

  it('구멍을 비우면(떨어짐) 영역도 지워진다', () => {
    const h = setupV2();
    reachDone(h, 0);
    h.pick(0);
    h.drop('other');
    expect(h.hole(0).rollZone).toBeNull();
    h.place(0, MARGARINE);
    expect(h.hole(0).rollZone).toBeNull();
  });
});

describe('barZone: 마지막으로 만진 구멍의 영역', () => {
  it('처음에는 null', () => {
    expect(setupV2().game.state.barZone).toBeNull();
  });

  it('속재료 후 구멍은 W1, 굴림 1 구멍은 W2(폭 0.30·0.24)', () => {
    const h = setupV2();
    reach(h, 2, 4);
    const w1 = h.game.state.barZone as RollZone;
    expect(h.hole(2).rollZone).toEqual(w1);
    expect(w1.to - w1.from).toBeCloseTo(0.3, 9);
    rollHole(h, 2);
    const w2 = h.game.state.barZone as RollZone;
    expect(h.hole(2).rollZone).toEqual(w2);
    expect(w2.to - w2.from).toBeCloseTo(0.24, 9);
  });

  it('다른 구멍을 만지면 그 구멍의 영역으로 바뀐다', () => {
    const h = setupV2();
    reach(h, 0, 4);
    reach(h, 1, 1);
    expect(h.game.state.barZone).toBeNull(); // 구멍 1은 기름칠이라 영역 없음
    rollHole(h, 0);
    expect(h.game.state.barZone).toEqual(h.hole(0).rollZone);
    expect(h.game.state.barZone).not.toBeNull();
  });

  it('굴릴 수 없는 구멍은 영역이 null이다', () => {
    const h = setupV2();
    reach(h, 0, 1);
    expect(h.hole(0).rollZone).toBeNull();
    expect(h.hole(1).rollZone).toBeNull();
  });

  it('익힘·익힘 완료는 탭으로 굴리면 W1로 판정되므로 같은 W1을 보여 준다', () => {
    const h = setupV2();
    reach(h, 0, 2);
    expect(h.hole(0).stage).toBe('cooking');
    expect(h.hole(0).rollZone).not.toBeNull();
    reach(h, 1, 3);
    expect(h.hole(1).stage).toBe('cooked');
    expect(h.hole(1).rollZone).not.toBeNull();
    expect(h.game.state.barZone).toEqual(h.hole(1).rollZone);
  });

  it('표시 영역과 판정 영역이 같다: 표시된 영역 가장자리 안쪽은 적중, 바깥쪽은 빗나감', () => {
    const h = setupV2();
    reach(h, 0, 2);
    reach(h, 1, 2);
    tickUntilZone(h, 0, true);
    h.roll(0);
    tickUntilZone(h, 1, false);
    h.roll(1);
    expect(h.of('cook/rolled')).toEqual([
      { hole: 0, hit: true },
      { hole: 1, hit: false },
    ]);
  });
});
