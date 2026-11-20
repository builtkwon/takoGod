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

describe('영역 위치: 판 공용 W1·W2(GDD §굽기·§손님 대화 난수 순서)', () => {
  /** 난수 v 하나로 폭 w 영역의 시작 위치. */
  const from = (v: number, w: number) => v * (1 - w);

  it('페이즈 시작 시 W1 → W2 순으로 뽑는다(P1 폭 W1 0.30, W2 0.24)', () => {
    const sc = scripted([0.2, 0.8], 0.5);
    const h = setupV2({ rng: sc.rng, liveZones: true });
    expect(sc.used()).toBe(2);
    h.place(0, MARGARINE);
    h.place(0, BATTER);
    const w1 = h.hole(0).rollZone as RollZone;
    expect(w1.from).toBeCloseTo(from(0.2, 0.3), 9);
    expect(w1.to - w1.from).toBeCloseTo(0.3, 9);
    expect(sc.used()).toBe(2); // 반죽 놓기는 뽑지 않는다
    h.tick(3);
    h.place(0, fill());
    h.roll(0);
    const w2 = h.hole(0).rollZone as RollZone;
    expect(w2.from).toBeCloseTo(from(0.8, 0.24), 9);
    expect(w2.to - w2.from).toBeCloseTo(0.24, 9);
  });

  it('굴리기 1마다 W1을, 굴리기 2마다 W2를 새로 뽑는다(적중·빗나감, 속 없음 굴리기 무관)', () => {
    const sc = scripted([], 0.5);
    const h = setupV2({ rng: sc.rng, liveZones: true });
    reach(h, [0, 1, 2], 4);
    h.place(3, MARGARINE);
    h.place(3, BATTER);
    const base = sc.used();
    h.roll(0); // 적중 또는 빗나감과 무관하게 W1 1회
    expect(sc.used()).toBe(base + 1);
    h.roll(3); // 속재료 전 굴리기(속 없음)도 W1 1회
    expect(sc.used()).toBe(base + 2);
    h.roll(1);
    expect(sc.used()).toBe(base + 3);
    h.roll(0); // 굴리기 2: W2 1회
    expect(sc.used()).toBe(base + 4);
    h.roll(1);
    expect(sc.used()).toBe(base + 5);
  });

  it('난수를 마가린·반죽·속재료·들기·후네에서는 뽑지 않는다', () => {
    const sc = scripted([], 0.5);
    const h = setupV2({ rng: sc.rng, liveZones: true });
    const base = sc.used();
    reach(h, 0, 4);
    expect(sc.used()).toBe(base);
  });

  it('구멍이 아니라 판이 영역을 공유한다: 모든 구멍의 rollZone이 같은 W1이고 굴리기 1 뒤 W1이 바뀐다', () => {
    const sc = scripted([0.1, 0.5, 0.9], 0.5);
    const h = setupV2({ rng: sc.rng, liveZones: true });
    reach(h, [0, 1], 4);
    const before = h.hole(0).rollZone as RollZone;
    expect(h.hole(1).rollZone).toEqual(before);
    expect(before.from).toBeCloseTo(from(0.1, 0.3), 9);
    h.roll(0); // 뽑는 값 0.9
    const after = h.hole(1).rollZone as RollZone;
    expect(after.from).toBeCloseTo(from(0.9, 0.3), 9);
    expect(h.hole(0).rollZone).not.toEqual(after); // 구멍 0은 이제 W2
  });

  it('판정은 누르는 순간의 공용 영역이다: 앞 구멍을 굴려 W1이 바뀌면 뒤 구멍은 새 W1로 판정한다', () => {
    const c = controlled(0.5);
    const h = setupV2({ rng: c.rng, liveZones: true }); // 영역 가운데
    reach(h, [0, 1], 4);
    tickTo(h, 3.2 + 0.5 * 0.8); // 바 0.5: 가운데 영역 안
    c.set(0); // 다음 W1은 0~0.3
    h.roll(0);
    expect(h.of('cook/rolled')).toEqual([{ hole: 0, hit: true }]);
    c.set(null);
    expect(h.game.state.barPosition).toBeCloseTo(0.5, 6);
    h.roll(1); // 같은 위치지만 W1이 0~0.3으로 바뀌어 빗나감
    expect(h.of('cook/rolled')[1]).toEqual({ hole: 1, hit: false });
  });

  it('폭: P3~P5는 W1 0.24·W2 0.20', () => {
    const h = setupV2({ rng: () => 0.5, liveZones: true });
    playUntilPhase(h, 'P3');
    reach(h, 0, 4);
    const z1 = h.hole(0).rollZone as RollZone;
    expect(z1.to - z1.from).toBeCloseTo(0.24, 9);
    h.roll(0);
    const z2 = h.hole(0).rollZone as RollZone;
    expect(z2.to - z2.from).toBeCloseTo(0.2, 9);
  });

  it('페이즈가 바뀔 때마다 W1·W2를 다시 뽑는다', () => {
    const sc = scripted([], 0.5);
    const h = setupV2({ rng: sc.rng, liveZones: true });
    expect(sc.used()).toBe(2);
    const calls = () => sc.used();
    playUntilPhase(h, 'P2');
    // P1→P2 전환 시 W1·W2 2회(손님 입장 성격·인내 2회 포함)와 굴리기 12회
    expect(h.of('phase/changed').map((e) => e.phase)).toEqual(['P1', 'P2']);
    expect(calls()).toBe(2 + 6 + 6 + 2 + 2);
  });

  it('구멍을 비워도 공용 영역은 남는다', () => {
    const h = setupV2();
    reachDone(h, 0);
    h.pick(0);
    h.drop('other');
    expect(h.hole(0).rollZone).toBeNull();
    expect(h.game.state.barZones).toEqual({ w1: null, w2: null });
  });
});

describe('barZones: 판 공용 영역 표시(굴릴 수 있는 구멍이 있을 때만)', () => {
  it('굴릴 수 있는 구멍이 없으면 둘 다 null', () => {
    const h = setupV2();
    expect(h.game.state.barZones).toEqual({ w1: null, w2: null });
    reach(h, 0, 1);
    expect(h.game.state.barZones).toEqual({ w1: null, w2: null });
  });

  it('익힘·익힘 완료·속재료 후 구멍이 있으면 W1, 굴림 1 구멍이 있으면 W2', () => {
    const h = setupV2();
    reach(h, 0, 2);
    const w1 = h.game.state.barZones.w1 as RollZone;
    expect(w1).not.toBeNull();
    expect(h.game.state.barZones.w2).toBeNull();
    expect(h.hole(0).rollZone).toEqual(w1);
    expect(w1.to - w1.from).toBeCloseTo(0.3, 9);
    reach(h, 1, 3);
    expect(h.game.state.barZones.w1).toEqual(w1);
    h.tick(0); // 시간이 흘러도(굴리기 전) 영역은 그대로
    rollHole(h, 0);
    const z = h.game.state.barZones;
    expect(z.w1).not.toBeNull(); // 구멍 1이 아직 W1로 굴릴 수 있다
    expect(z.w2).not.toBeNull();
    expect(h.hole(0).rollZone).toEqual(z.w2);
    expect((z.w2 as RollZone).to - (z.w2 as RollZone).from).toBeCloseTo(0.24, 9);
  });

  it('W1 구멍이 모두 굴림 1이 되면 W1은 사라지고 W2는 굴림 2가 되면 사라진다', () => {
    const h = setupV2();
    reach(h, 0, 4);
    expect(h.game.state.barZones.w1).not.toBeNull();
    rollHole(h, 0);
    expect(h.game.state.barZones.w1).toBeNull();
    expect(h.game.state.barZones.w2).not.toBeNull();
    rollHole(h, 0);
    expect(h.game.state.barZones).toEqual({ w1: null, w2: null });
  });

  it('표시 영역과 판정 영역이 같다: 영역 안쪽은 적중, 바깥쪽은 빗나감(속재료 전 굴리기 포함)', () => {
    const h = setupV2();
    reach(h, 0, 2);
    reach(h, 1, 2);
    tickUntilZone(h, 0, true);
    h.roll(0);
    // 굴리기 1을 하면 W1이 다시 뽑힌다. 새 W1 기준으로 밖에서 굴린다.
    tickUntilZone(h, 1, false);
    h.roll(1);
    expect(h.of('cook/rolled')).toEqual([
      { hole: 0, hit: true },
      { hole: 1, hit: false },
    ]);
  });
});
