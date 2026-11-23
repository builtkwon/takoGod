import { describe, expect, it } from 'vitest';
import type { Material } from '../../contracts';
import type { RollZone } from '../../contracts';
import { BATTER, MARGARINE, fill, playUntilLevel, reach, reachDone, rollHole, setupV2, tickTo, tickUntilBar, tickUntilZone } from './helpers-v2';

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

/** 1단계 영역은 폭 0.30이고 난수 0.5면 바 가운데(0.35~0.65)다. 주기는 2.2초다. */
/** 상승 구간(4.4~5.5초)에서 바가 p에 오는 시각(reach 4가 끝난 3초 이후 첫 상승). */
const up = (p: number) => 4.4 + p * 1.1;
/** 하강 구간(5.5~6.6초)에서 바가 p에 오는 시각. */
const down = (p: number) => 5.5 + (1 - p) * 1.1;

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

  // 1단계: 영역 하나(폭 0.30, 난수 0.5 → 0.35~0.65)를 굴리기 1·2가 함께 쓴다.
  it.each<[number, boolean, string]>([
    [0.65, true, '상단'],
    [0.66, false, '상단 밖'],
    [0.35, true, '하단'],
    [0.34, false, '하단 밖'],
    [0.5, true, '가운데'],
  ])('굴리기 1 경계: 바 %f → 적중 %s (%s)', (p, hit) => {
    const h = setupV2();
    reach(h, 0, 4);
    tickTo(h, up(p));
    h.roll(0);
    expect(h.of('cook/rolled')[0]?.hit).toBe(hit);
  });

  // 굴리기 1을 바 0.5에 적중시킨 뒤 하강 구간에서 같은 영역으로 굴리기 2를 판정한다(재추첨 없음).
  it.each<[number, boolean, string]>([
    [0.66, false, '상단 밖'],
    [0.65, true, '상단'],
    [0.35, true, '하단'],
    [0.34, false, '하단 밖'],
  ])('굴리기 2 경계(같은 영역): 바 %f → 적중 %s (%s)', (p, hit) => {
    const h = setupV2();
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
    h.tick(7.2);
    expect(h.hole(0).stage).toBe('dark');
    h.roll(0);
    h.tick(3.6);
    expect(h.hole(0).stage).toBe('burnt');
    h.roll(0);
    expect(h.of('cook/tap-ignored')).toEqual([{ hole: 0 }, { hole: 0 }, { hole: 0 }]);
    expect(h.hole(0).stage).toBe('burnt');
  });
});

describe('전역 타이밍 바(단계별 주기 왕복)', () => {
  it.each([
    [0, 0],
    [0.55, 0.5],
    [1.1, 1],
    [1.65, 0.5],
    [2.2, 0],
    [2.75, 0.5],
    [5.5, 1],
  ] as const)('1단계(2.2초 주기) t=%f초 위치 %f', (t, pos) => {
    const h = setupV2();
    h.tick(t);
    expect(h.game.state.barPosition).toBeCloseTo(pos, 6);
  });

  it('튜토리얼도 2.2초 주기다', () => {
    const h = setupV2({ tutorial: true });
    h.tick(1.1);
    expect(h.game.state.barPosition).toBeCloseTo(1, 6);
  });

  it('구멍 상태와 무관하게 세션 내내 계속된다', () => {
    const h = setupV2();
    reach(h, 0, 3);
    h.tick(16.5 - 3); // 총 16.5초 = 7.5주기 → 가운데에서 꼭대기
    expect(h.game.state.barPosition).toBeCloseTo(1, 6);
  });

  it('단계가 바뀌어도 위치가 끊기지 않고 주기만 바뀐다(3단계 1.9초)', () => {
    const h = setupV2();
    playUntilLevel(h, 3);
    for (let i = 0; i < 4000 && !(h.game.state.barPosition > 0.3 && h.game.state.barPosition < 0.45); i++) h.tick(0.001);
    const before = h.game.state.barPosition;
    h.tick(0.01);
    const delta = Math.abs(h.game.state.barPosition - before);
    expect(delta).toBeCloseTo((2 * 0.01) / 1.9, 6);
  });
});

/** 1~5단계: 영역 하나를 단계 시작 때 한 번 뽑아 고정한다. */
describe('영역(1~5단계): 하나를 단계 동안 고정', () => {
  it('단계 시작 때 난수 1회로 뽑는다: 1단계 폭 0.30, 난수 0.2 → 0.14~0.44', () => {
    const h = setupV2({ zoneValues: [0.2] });
    expect(h.zoneDraws()).toBe(1);
    reach(h, 0, 2);
    const z = h.hole(0).rollZone as RollZone;
    expect(z.from).toBeCloseTo(0.2 * 0.7, 9);
    expect(z.to - z.from).toBeCloseTo(0.3, 9);
  });

  it('굴리기 1·2에서도, 반죽·마가린·속재료에서도 다시 뽑지 않는다(영역 그대로)', () => {
    const h = setupV2({ zoneValues: [0.2] });
    reach(h, 0, 4);
    const z = h.hole(0).rollZone;
    rollHole(h, 0);
    expect(h.hole(0).rollZone).toEqual(z); // 굴림 1 구멍도 같은 영역
    rollHole(h, 0);
    expect(h.zoneDraws()).toBe(1);
  });

  it('단계가 바뀔 때마다 새로 한 번 뽑고 폭이 단계별이다(1·2단계 0.30, 3~5단계 0.24)', () => {
    const h = setupV2();
    const width = (): number => {
      reach(h, 15, 2);
      const z = h.hole(15).rollZone as RollZone;
      return z.to - z.from;
    };
    expect(h.zoneDraws()).toBe(1);
    expect(width()).toBeCloseTo(0.3, 9);
    playUntilLevel(h, 2);
    expect(h.zoneDraws()).toBe(2);
    expect(width()).toBeCloseTo(0.3, 9);
    playUntilLevel(h, 3);
    expect(h.zoneDraws()).toBe(3);
    expect(width()).toBeCloseTo(0.24, 9);
    playUntilLevel(h, 5);
    expect(h.zoneDraws()).toBe(5);
    expect(width()).toBeCloseTo(0.24, 9);
  });

  it('모든 구멍이 같은 영역이고 굴림 1 구멍도 같은 영역으로 판정한다', () => {
    const h = setupV2({ zoneValues: [0.1] });
    reach(h, [0, 1], 4);
    expect(h.hole(0).rollZone).toEqual(h.hole(1).rollZone);
    const z = h.hole(0).rollZone as RollZone;
    tickUntilZone(h, 0, true);
    h.roll(0);
    expect(h.hole(0).rollZone).toEqual(z);
    tickUntilZone(h, 0, false);
    h.roll(0);
    expect(h.of('cook/rolled')).toEqual([
      { hole: 0, hit: true },
      { hole: 0, hit: false },
    ]);
  });

  it('barZones: 영역은 w1 하나로 보이고 shared=true, w2는 항상 null', () => {
    const h = setupV2();
    expect(h.game.state.barZones).toEqual({ w1: null, w2: null, shared: true });
    reach(h, 0, 1);
    expect(h.game.state.barZones.w1).toBeNull(); // 기름칠 구멍은 굴릴 수 없다
    reach(h, 0, 2);
    const z = h.game.state.barZones;
    expect(z.w1).toEqual(h.hole(0).rollZone);
    expect(z.w1).not.toBeNull();
    expect(z.w2).toBeNull();
    expect(z.shared).toBe(true);
  });

  it('굴림 1 구멍만 있어도 같은 영역이 보이고(w1), 완성되면 사라진다', () => {
    const h = setupV2();
    reach(h, 0, 4);
    rollHole(h, 0);
    expect(h.hole(0).stage).toBe('rolled');
    expect(h.game.state.barZones.w1).toEqual(h.hole(0).rollZone);
    expect(h.game.state.barZones.w1).not.toBeNull();
    rollHole(h, 0);
    expect(h.game.state.barZones).toEqual({ w1: null, w2: null, shared: true });
  });

  it('표시 영역과 판정 영역이 같다: 영역 안쪽은 적중, 바깥쪽은 빗나감(속재료 전 굴리기 포함)', () => {
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

/** 6단계~: W1·W2 두 영역, 굴릴 때마다 다시 뽑고 중심 최소 거리가 있다. */
describe('영역(6단계~): W1·W2, 굴릴 때마다 재추첨', () => {
  // 1~5단계 시작에 5회, 6단계 시작에 W1·W2 2회를 쓴다.
  const five = [0.5, 0.5, 0.5, 0.5, 0.5];
  const atLevel6 = (zoneValues: readonly number[] = []) => {
    const h = setupV2({ zoneValues: [...five, ...zoneValues] });
    playUntilLevel(h, 6);
    return h;
  };

  it('단계 시작 때 W1 → W2 순으로 뽑는다(6단계 폭 W1 0.24, W2 0.20)', () => {
    const h = atLevel6([0.1, 0.9]);
    expect(h.zoneDraws()).toBe(7);
    reach(h, 0, 4);
    const w1 = h.hole(0).rollZone as RollZone;
    expect(w1.from).toBeCloseTo(0.1 * 0.76, 9);
    expect(w1.to - w1.from).toBeCloseTo(0.24, 9);
    rollHole(h, 0); // W1은 새로 뽑히지만 이 구멍은 이제 W2
    const w2 = h.hole(0).rollZone as RollZone;
    expect(w2.to - w2.from).toBeCloseTo(0.2, 9);
    expect(w2.from).toBeCloseTo(0.72, 9); // 난수 0.9, d=0: 중심 0.5 + (0.72 − 0.4) = 0.82
  });

  it('굴리기 1마다 W1을, 굴리기 2마다 W2를 새로 뽑는다(적중·빗나감, 속 없음 굴리기 무관)', () => {
    const h = atLevel6();
    reach(h, [0, 1, 2], 4);
    h.place(3, MARGARINE);
    h.place(3, BATTER);
    const base = h.zoneDraws();
    h.roll(0);
    expect(h.zoneDraws()).toBe(base + 1);
    h.roll(3); // 속재료 전 굴리기(속 없음)도 W1 1회
    expect(h.zoneDraws()).toBe(base + 2);
    h.roll(1);
    expect(h.zoneDraws()).toBe(base + 3);
    h.roll(0); // 굴리기 2: W2 1회
    expect(h.zoneDraws()).toBe(base + 4);
  });

  it('barZones: 6단계는 shared=false이고 W1은 W1로 굴릴 구멍이, W2는 굴림 1 구멍이 있을 때만 보인다', () => {
    const h = atLevel6();
    expect(h.game.state.barZones).toEqual({ w1: null, w2: null, shared: false });
    reach(h, 0, 4);
    expect(h.game.state.barZones.w1).not.toBeNull();
    expect(h.game.state.barZones.w2).toBeNull();
    rollHole(h, 0);
    const z = h.game.state.barZones;
    expect(z.w1).toBeNull();
    expect(z.w2).toEqual(h.hole(0).rollZone);
    expect(z.shared).toBe(false);
  });

  it('판정은 누르는 순간의 공용 영역이다: 앞 구멍을 굴려 W1이 바뀌면 뒤 구멍은 새 W1로 판정한다', () => {
    // 재추첨 난수 0 → W1 0~0.24(왼쪽 끝). 바 0.5는 새 W1 밖이다.
    const h = atLevel6([0.5, 0.5, 0]);
    reach(h, [0, 1], 4);
    tickUntilBar(h, [0.49, 0.51]);
    h.roll(0);
    h.roll(1);
    expect(h.of('cook/rolled').slice(-2)).toEqual([
      { hole: 0, hit: true },
      { hole: 1, hit: false },
    ]);
  });

  it('구멍을 비워도 영역 상태는 단계가 가진다', () => {
    const h = atLevel6();
    reachDone(h, 0);
    h.pick(0);
    h.drop('other');
    expect(h.hole(0).rollZone).toBeNull();
    expect(h.game.state.barZones).toEqual({ w1: null, w2: null, shared: false });
  });
});
