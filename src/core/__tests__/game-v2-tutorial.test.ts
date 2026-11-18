import { describe, expect, it } from 'vitest';
import { ALL, BATTER, MARGARINE, MISS, fill, setupV2, tickUntilBar, type H } from './helpers-v2';

const tut = () => setupV2({ tutorial: true });
const all = (fn: (i: number) => void, holes: readonly number[] = ALL) => holes.forEach(fn);
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
    for (const i of [0, 1, 2, 3, 4]) h.place(i, MARGARINE);
    expect(stage(h)).toBe('margarine');
    h.place(5, MARGARINE);
    expect(stage(h)).toBe('batter');
    for (const i of [0, 1, 2, 3, 4]) h.place(i, BATTER);
    expect(stage(h)).toBe('batter');
    h.place(5, BATTER);
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
    expect(h.of('review/issued')).toEqual([{ review: { source: 'tutorial', stars: 5, comment: 'tutorial 5 stars', personality: null } }]);
    expect(h.game.state.phase).toBe('P1');
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

describe('튜토리얼: 현재 단계 외 조작 거부', () => {
  const rejected = (h: H, hole: number) => {
    expect(h.of('cook/rejected')).toContainEqual({ hole, reason: 'tutorial-step' });
  };

  it('마가린 단계에서 반죽·속재료·굴리기는 거부하고 invalid-action으로 화살표를 흔든다', () => {
    const h = tut();
    h.place(0, BATTER);
    h.place(0, fill());
    h.roll(0);
    expect(h.of('cook/rejected')).toEqual([
      { hole: 0, reason: 'tutorial-step' },
      { hole: 0, reason: 'tutorial-step' },
      { hole: 0, reason: 'tutorial-step' },
    ]);
    expect(h.of('tutorial/invalid-action')).toEqual([{ expected: 'margarine' }, { expected: 'margarine' }, { expected: 'margarine' }]);
    expect(h.hole(0).stage).toBe('empty');
    expect(h.of('cook/tap-ignored')).toEqual([]);
  });

  it('같은 구멍에 같은 조작을 두 번 해도 두 번째는 거부한다', () => {
    const h = tut();
    h.place(0, MARGARINE);
    h.place(0, MARGARINE);
    rejected(h, 0);
    expect(h.of('tutorial/invalid-action')).toEqual([{ expected: 'margarine' }]);
  });

  it('속재료 전 굴리기(익힘·익힘 완료 중)도 거부하고 속 없음이 되지 않는다', () => {
    const h = tut();
    advanceTo(h, 'cook-wait');
    h.roll(0);
    expect(h.of('tutorial/invalid-action')).toEqual([{ expected: 'cook-wait' }]);
    expect(h.hole(0).noFilling).toBe(false);
    h.tick(3);
    expect(stage(h)).toBe('filling');
    h.roll(0);
    expect(h.of('tutorial/invalid-action')).toEqual([{ expected: 'cook-wait' }, { expected: 'filling' }]);
    expect(h.hole(0).stage).toBe('cooked');
    expect(h.hole(0).noFilling).toBe(false);
  });

  it('익힘 기다림 단계에서는 어떤 재료도 받지 않는다', () => {
    const h = tut();
    advanceTo(h, 'cook-wait');
    h.place(0, MARGARINE);
    h.place(1, fill());
    expect(h.of('cook/rejected')).toHaveLength(2);
    expect(h.of('tutorial/invalid-action')).toEqual([{ expected: 'cook-wait' }, { expected: 'cook-wait' }]);
  });

  it('굴리기 1 단계에서 이미 굴린 구멍을 또 굴리면 거부한다', () => {
    const h = tut();
    advanceTo(h, 'roll-1');
    h.roll(0);
    h.roll(0);
    expect(h.of('cook/rolled')).toHaveLength(1);
    rejected(h, 0);
    expect(h.of('tutorial/invalid-action')).toEqual([{ expected: 'roll-1' }]);
  });

  it('후네 담기 단계가 아닐 때 들기는 거부하고, 후네가 아닌 곳에 놓는 것도 거부한다', () => {
    const h = tut();
    advanceTo(h, 'roll-2');
    all((i) => h.roll(i), [0, 1, 2]);
    h.pick(0); // 아직 완성이 아닌 구멍 또는 roll-2 단계: 거부
    expect(h.of('tutorial/invalid-action').length).toBeGreaterThan(0);
    all((i) => h.roll(i), [3, 4, 5]);
    expect(stage(h)).toBe('fune');
    h.pick(0);
    expect(h.game.state.holding).toBe(0);
    h.drop('offscreen');
    expect(h.game.state.holding).toBeNull();
    expect(h.of('cook/rejected').at(-1)).toEqual({ hole: 0, reason: 'tutorial-step' });
    expect(h.hole(0).stage).toBe('done');
    expect(h.of('tutorial/invalid-action').at(-1)).toEqual({ expected: 'fune' });
  });

  it('트레이에서 함정 재료를 놓으면 감점 없이 경고 말풍선만(재료는 돌아간다)', () => {
    const h = tut();
    advanceTo(h, 'filling');
    h.place(0, fill('wasabi'));
    expect(h.of('tutorial/trap-warning')).toEqual([{ ingredient: 'wasabi' }]);
    expect(h.of('cook/rejected')).toEqual([{ hole: 0, reason: 'tutorial-step' }]);
    expect(h.of('tutorial/invalid-action')).toEqual([]);
    expect(h.hole(0).stage).toBe('cooked');
    expect(h.hole(0).filling).toBeNull();
    h.place(0, fill());
    expect(h.hole(0).filling).toBe('octopus');
  });
});

describe('튜토리얼: 어두움·탐 없음, 바 전 구간 성공', () => {
  it('완성품을 오래 두어도 어두워지거나 타지 않는다', () => {
    const h = tut();
    advanceTo(h, 'fune');
    h.tick(60);
    expect(h.game.state.holes.every((x) => x.stage === 'done')).toBe(true);
    expect(h.of('cook/darkened')).toEqual([]);
    expect(h.of('cook/burnt')).toEqual([]);
    expect(h.game.state.holes.every((x) => !x.warn)).toBe(true);
  });

  it('익힘 기다림에 시간제한이 없다', () => {
    const h = tut();
    advanceTo(h, 'cook-wait');
    h.tick(600);
    expect(stage(h)).toBe('filling');
    expect(h.game.state.holes.every((x) => x.stage === 'cooked')).toBe(true);
  });

  it('굴리기는 바 위치와 상관없이 적중이다', () => {
    const h = tut();
    advanceTo(h, 'filling');
    all((i) => h.place(i, fill()));
    tickUntilBar(h, MISS);
    expect(h.game.state.barPosition).toBeGreaterThan(0.7);
    h.roll(0);
    expect(h.of('cook/rolled')).toEqual([{ hole: 0, hit: true }]);
    expect(h.hole(0).rollHits).toEqual([true, null]);
    expect(h.game.state.barZone).toEqual({ from: 0, to: 1 });
  });
});

describe('튜토리얼: 세션 저장·복원', () => {
  it('완료 저장값이 있으면 튜토리얼을 건너뛰고 P1부터 시작한다', () => {
    expect(setupV2().game.state.phase).toBe('P1');
    expect(setupV2().game.state.tutorialStage).toBeNull();
  });
});
