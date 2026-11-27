import { describe, expect, it } from 'vitest';
import { BATTER, MARGARINE, fill, scripted, setupV2, tickUntilBar, type H } from './helpers-v2';

/** 튜토리얼에서 열린 6구(가운데 2열 × 위 3행). 나머지 10구는 잠긴다. */
const TUTORIAL = [1, 2, 5, 6, 9, 10] as const;
const tut = () => setupV2({ tutorial: true });
const all = (fn: (i: number) => void, holes: readonly number[] = TUTORIAL) => holes.forEach(fn);
const stage = (h: H) => h.game.state.tutorialStage;

/** 지정 단계의 시작 상태까지 6구를 정상 순서로 진행한다. */
function advanceTo(h: H, target: string): void {
  const steps: [string, () => void][] = [
    ['margarine', () => all((i) => h.place(i, MARGARINE))],
    ['batter', () => all((i) => h.place(i, BATTER))],
    ['cook-wait', () => h.tick(3)],
    ['filling', () => all((i) => h.place(i, fill()))],
    ['roll-1', () => all((i) => h.roll(i))],
    ['roll-2', () => all((i) => h.roll(i))],
  ];
  for (const [name, run] of steps) {
    if (stage(h) === target) return;
    expect(stage(h)).toBe(name);
    run();
  }
}

describe('튜토리얼: 단계별 6구 유도(GDD §진행)', () => {
  it('튜토리얼로 시작하며 손님이 없다', () => {
    const h = tut();
    expect(h.game.state.phase).toBe('tutorial');
    expect(stage(h)).toBe('margarine');
    expect(h.game.state.customers).toEqual([]);
    expect(h.game.state.tutorialCompleted).toBe(false);
  });

  it('6구 모두에 같은 조작을 해야 다음 단계로 간다', () => {
    const h = tut();
    for (const i of [1, 2, 5, 6, 9]) h.place(i, MARGARINE);
    expect(stage(h)).toBe('margarine');
    h.place(10, MARGARINE);
    expect(stage(h)).toBe('batter');
    for (const i of [1, 2, 5, 6, 9]) h.place(i, BATTER);
    expect(stage(h)).toBe('batter');
    h.place(10, BATTER);
    expect(stage(h)).toBe('cook-wait');
  });

  it('순서: 마가린 → 반죽물 → 익힘 기다림(3초) → 속재료 → 굴리기 1 → 굴리기 2 → 후네 담기', () => {
    const h = tut();
    const seen: (string | null)[] = [stage(h)];
    const push = () => seen.push(stage(h));
    all((i) => h.place(i, MARGARINE));
    push();
    all((i) => h.place(i, BATTER));
    push();
    h.tick(2.9);
    push();
    h.tick(0.1);
    push();
    all((i) => h.place(i, fill()));
    push();
    all((i) => h.roll(i));
    push();
    all((i) => h.roll(i));
    push();
    expect(seen).toEqual(['margarine', 'batter', 'cook-wait', 'cook-wait', 'filling', 'roll-1', 'roll-2', 'fune']);
    expect(h.of('cook/rejected')).toEqual([]);
    expect(h.of('tutorial/invalid-action')).toEqual([]);
  });

  it('후네에 6개를 담으면 5★ 튜토리얼 리뷰를 지급하고 P1로 간다(서빙·점수 없음)', () => {
    const h = tut();
    advanceTo(h, 'fune');
    all((i) => {
      h.pick(i);
      h.drop('fune');
    });
    expect(h.game.state.funeServing).toBe(true);
    expect(h.of('review/issued')).toEqual([]);
    h.tick(0.9);
    expect(h.of('review/issued')).toEqual([]);
    h.tick(0.1);
    expect(h.of('review/issued')).toEqual([{ review: { source: 'tutorial', stars: 5, comment: 'tutorial 5 stars', personality: null } }]);
    expect(h.game.state.level).toBe(1);
    expect(h.game.state.tutorialStage).toBeNull();
    expect(h.game.state.tutorialCompleted).toBe(true);
    expect(h.game.state.fune).toEqual([]);
    expect(h.game.state.sessionAverage).toBe(5);
    expect(h.of('plate/tasted')).toEqual([]);
    expect(h.store.load()).toMatchObject({ version: 1, tutorialCompleted: true, finished: false });
    expect(h.store.load()?.reviews).toHaveLength(1);
    expect(h.game.state.holes.every((x) => x.stage === 'empty')).toBe(true);
  });
});

describe('튜토리얼: 잠긴 구멍(16구 중 10구)', () => {
  const LOCKED = [0, 3, 4, 7, 8, 11, 12, 13, 14, 15];

  it('열린 구멍은 1,2,5,6,9,10이고 나머지는 locked, 본게임은 모두 열려 있다', () => {
    const h = tut();
    expect(h.game.state.holes).toHaveLength(16);
    expect(h.game.state.holes.filter((x) => !x.locked).map((x) => x.index)).toEqual([...TUTORIAL]);
    expect(h.game.state.holes.filter((x) => x.locked).map((x) => x.index)).toEqual(LOCKED);
    expect(setupV2().game.state.holes.every((x) => !x.locked)).toBe(true);
  });

  it('잠긴 구멍의 재료·굴리기·들기는 거부하고 화살표를 흔들지 않는다', () => {
    const h = tut();
    for (const i of LOCKED) {
      h.place(i, MARGARINE);
      h.roll(i);
      h.pick(i);
    }
    expect(h.of('cook/rejected')).toHaveLength(LOCKED.length * 3);
    expect(h.of('cook/rejected').every((e) => e.reason === 'invalid-stage')).toBe(true);
    expect(h.of('tutorial/invalid-action')).toEqual([]);
    expect(h.of('cook/tap-ignored')).toEqual([]);
    expect(h.game.state.holes.every((x) => x.stage === 'empty')).toBe(true);
  });

  it('진행 조건은 열린 6구 기준이다(잠긴 구멍을 건드릴 필요 없다)', () => {
    const h = tut();
    all((i) => h.place(i, MARGARINE));
    expect(stage(h)).toBe('batter');
  });

  it('후네가 차면 funeServing이 켜지고 서빙 대기 1초 동안 놓기를 거부한다', () => {
    const h = tut();
    advanceTo(h, 'fune');
    for (const i of [1, 2, 5, 6, 9]) {
      h.pick(i);
      h.drop('fune');
    }
    expect(h.game.state.funeServing).toBe(false);
    h.pick(10);
    h.drop('fune');
    expect(h.game.state.funeServing).toBe(true);
    expect(h.game.state.phase).toBe('tutorial');
  });
});

describe('튜토리얼: 현재 단계 외 조작 거부', () => {
  const rejected = (h: H, hole: number) => {
    expect(h.of('cook/rejected')).toContainEqual({ hole, reason: 'tutorial-step' });
  };

  it('마가린 단계에서 반죽·속재료·굴리기는 거부하고 invalid-action으로 화살표를 흔든다', () => {
    const h = tut();
    h.place(1, BATTER);
    h.place(1, fill());
    h.roll(1);
    expect(h.of('cook/rejected')).toEqual([
      { hole: 1, reason: 'tutorial-step' },
      { hole: 1, reason: 'tutorial-step' },
      { hole: 1, reason: 'tutorial-step' },
    ]);
    expect(h.of('tutorial/invalid-action')).toEqual([{ expected: 'margarine' }, { expected: 'margarine' }, { expected: 'margarine' }]);
    expect(h.hole(1).stage).toBe('empty');
    expect(h.of('cook/tap-ignored')).toEqual([]);
  });

  it('같은 구멍에 같은 조작을 두 번 해도 두 번째는 거부한다', () => {
    const h = tut();
    h.place(1, MARGARINE);
    h.place(1, MARGARINE);
    rejected(h, 1);
    expect(h.of('tutorial/invalid-action')).toEqual([{ expected: 'margarine' }]);
  });

  it('속재료 전 굴리기(익힘·익힘 완료 중)도 거부하고 속 없음이 되지 않는다', () => {
    const h = tut();
    advanceTo(h, 'cook-wait');
    h.roll(1);
    expect(h.of('tutorial/invalid-action')).toEqual([{ expected: 'cook-wait' }]);
    expect(h.hole(1).noFilling).toBe(false);
    h.tick(3);
    expect(stage(h)).toBe('filling');
    h.roll(1);
    expect(h.of('tutorial/invalid-action')).toEqual([{ expected: 'cook-wait' }, { expected: 'filling' }]);
    expect(h.hole(1).stage).toBe('cooked');
    expect(h.hole(1).noFilling).toBe(false);
  });

  it('익힘 기다림 단계에서는 어떤 재료도 받지 않는다', () => {
    const h = tut();
    advanceTo(h, 'cook-wait');
    h.place(1, MARGARINE);
    h.place(2, fill());
    expect(h.of('cook/rejected')).toHaveLength(2);
    expect(h.of('tutorial/invalid-action')).toEqual([{ expected: 'cook-wait' }, { expected: 'cook-wait' }]);
  });

  it('굴리기 1 단계에서 이미 굴린 구멍을 또 굴리면 거부한다', () => {
    const h = tut();
    advanceTo(h, 'roll-1');
    h.roll(1);
    h.roll(1);
    expect(h.of('cook/rolled')).toHaveLength(1);
    rejected(h, 1);
    expect(h.of('tutorial/invalid-action')).toEqual([{ expected: 'roll-1' }]);
  });

  it('후네 담기 단계가 아닐 때 들기는 거부하고, 후네가 아닌 곳에 놓는 것도 거부한다', () => {
    const h = tut();
    advanceTo(h, 'roll-2');
    all((i) => h.roll(i), [1, 2, 5]);
    h.pick(1); // 아직 완성이 아닌 구멍 또는 roll-2 단계: 거부
    expect(h.of('tutorial/invalid-action').length).toBeGreaterThan(0);
    all((i) => h.roll(i), [6, 9, 10]);
    expect(stage(h)).toBe('fune');
    h.pick(1);
    expect(h.game.state.holding).toBe(1);
    h.drop('other');
    expect(h.game.state.holding).toBeNull();
    expect(h.of('cook/dropped')).toEqual([]);
    expect(h.of('cook/rejected').at(-1)).toEqual({ hole: 1, reason: 'tutorial-step' });
    expect(h.hole(1).stage).toBe('done');
    expect(h.of('tutorial/invalid-action').at(-1)).toEqual({ expected: 'fune' });
  });

  it('트레이에서 함정 재료를 놓으면 감점 없이 경고 말풍선만(재료는 돌아간다)', () => {
    const h = tut();
    advanceTo(h, 'filling');
    h.place(1, fill('wasabi'));
    expect(h.of('tutorial/trap-warning')).toEqual([{ ingredient: 'wasabi' }]);
    expect(h.of('cook/rejected')).toEqual([{ hole: 1, reason: 'tutorial-step' }]);
    expect(h.of('tutorial/invalid-action')).toEqual([]);
    expect(h.hole(1).stage).toBe('cooked');
    expect(h.hole(1).filling).toBeNull();
    h.place(1, fill());
    expect(h.hole(1).filling).toBe('octopus');
  });
});

describe('튜토리얼: 어두움·탐 없음, 고정 영역 0.50', () => {
  it('완성품을 오래 두어도 어두워지거나 타지 않는다', () => {
    const h = tut();
    advanceTo(h, 'fune');
    h.tick(60);
    expect(TUTORIAL.every((i) => h.hole(i).stage === 'done')).toBe(true);
    expect(h.of('cook/darkened')).toEqual([]);
    expect(h.of('cook/burnt')).toEqual([]);
    expect(h.game.state.holes.every((x) => !x.warn)).toBe(true);
  });

  it('익힘 기다림에 시간제한이 없다', () => {
    const h = tut();
    advanceTo(h, 'cook-wait');
    h.tick(600);
    expect(stage(h)).toBe('filling');
    expect(TUTORIAL.every((i) => h.hole(i).stage === 'cooked')).toBe(true);
  });

  it('튜토리얼은 영역 위치 난수를 뽑지 않는다(페이즈 시작·반죽·굴리기 1·2)', () => {
    const sc = scripted([], 0.5);
    const h = setupV2({ tutorial: true, rng: sc.rng, liveZones: true });
    expect(sc.used()).toBe(0);
    advanceTo(h, 'fune');
    expect(TUTORIAL.every((i) => h.hole(i).stage === 'done')).toBe(true);
    expect(sc.used()).toBe(0);
  });

  it('영역은 하나이고 0.25~0.75(폭 0.50, 가운데) 고정이다', () => {
    const h = tut();
    advanceTo(h, 'roll-1');
    const z = { from: 0.25, to: 0.75 };
    expect(h.game.state.barZones).toEqual({ w1: z, w2: null, shared: true });
    expect(h.hole(1).rollZone).toEqual(z);
    all((i) => h.roll(i));
    expect(h.game.state.barZones).toEqual({ w1: z, w2: null, shared: true });
    expect(h.hole(1).rollZone).toEqual(z);
  });

  it('튜토리얼 영역은 익힘·익힘 완료 구멍만 있을 때는 보이지 않는다(그 구멍은 굴릴 수 없다)', () => {
    const h = tut();
    advanceTo(h, 'cook-wait');
    expect(h.game.state.barZones).toEqual({ w1: null, w2: null, shared: true });
  });

  it('영역 안에서 굴리면 적중, 밖이면 빗나감이지만 진행은 막지 않는다', () => {
    const h = tut();
    advanceTo(h, 'roll-1');
    tickUntilBar(h, [0.45, 0.55]);
    h.roll(1);
    tickUntilBar(h, [0.9, 1]);
    h.roll(2);
    expect(h.of('cook/rolled')).toEqual([
      { hole: 1, hit: true },
      { hole: 2, hit: false },
    ]);
    expect(h.hole(2).rollHits).toEqual([false, null]);
    expect(h.hole(2).stage).toBe('rolled');
    all((i) => h.roll(i), [5, 6, 9, 10]);
    expect(stage(h)).toBe('roll-2');
    all((i) => h.roll(i));
    expect(stage(h)).toBe('fune');
    expect(h.of('tutorial/invalid-action')).toEqual([]);
  });
});

describe('튜토리얼: 세션 저장·복원', () => {
  it('완료 저장값이 있으면 튜토리얼을 건너뛰고 P1부터 시작한다', () => {
    expect(setupV2().game.state.level).toBe(1);
    expect(setupV2().game.state.tutorialStage).toBeNull();
  });
});
