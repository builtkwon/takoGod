import { describe, expect, it } from 'vitest';
import type { CookStep, DialogueLine, GameEventType, IngredientId, ReviewResult, SessionSnapshot } from '../../contracts';
import { createEventBus } from '../event-bus';
import { Game, type GameData } from '../game';
import { createRng } from '../rng';
import { createMemorySessionStore } from '../session';
import { syntheticData } from '../synthetic-data';

const OUTPUT_EVENTS: readonly GameEventType[] = [
  'cook/step-advanced',
  'cook/judged',
  'cook/ingredient-added',
  'cook/completed',
  'customer/arrived',
  'customer/left',
  'dialogue/started',
  'dialogue/resolved',
  'phase/changed',
  'review/issued',
  'tutorial/invalid-tap',
  'tutorial/trap-warning',
];
const ROLLS = ['roll-1', 'roll-2', 'roll-3'] as const;

interface Rec {
  readonly type: GameEventType;
  readonly payload: unknown;
}

function setup(opts: { seed?: number; store?: ReturnType<typeof createMemorySessionStore>; data?: GameData } = {}) {
  const bus = createEventBus();
  const log: Rec[] = [];
  for (const t of OUTPUT_EVENTS) bus.on(t, (payload) => log.push({ type: t, payload }));
  const store = opts.store ?? createMemorySessionStore();
  const game = new Game({ bus, data: opts.data ?? syntheticData, rng: createRng(opts.seed ?? 1), store });
  const tap = (hole: number, step: CookStep, ingredient?: IngredientId) =>
    bus.emit('input/cook', ingredient === undefined ? { hole, step } : { hole, step, ingredient });
  const tapAll = (step: CookStep, ingredient?: IngredientId) => {
    for (let h = 0; h < 6; h++) tap(h, step, ingredient);
  };
  const of = (type: GameEventType) => log.filter((r) => r.type === type).map((r) => r.payload);
  const answer = (choice: 'good' | 'bad') => {
    const c = game.state.customers[0];
    if (c === undefined) throw new Error('no customer');
    bus.emit('input/answer', { customerId: c.id, choice });
  };
  return { bus, game, store, log, tap, tapAll, of, answer };
}
type H = ReturnType<typeof setup>;

/** 6구 1접시를 끝까지 굽는다. 기본은 완벽 굽기(익음 3초, 굴리기 0.3초 = 바 0.5). */
function plate(h: H, o: { cook?: number; roll?: number; trap?: IngredientId } = {}) {
  const cook = o.cook ?? 3;
  const roll = o.roll ?? 0.3;
  h.tapAll('margarine');
  h.tapAll('batter');
  h.game.tick(cook);
  h.tapAll('cook-1');
  for (let i = 0; i < 6; i++) h.tap(i, 'filling', i === 0 && o.trap !== undefined ? o.trap : 'octopus');
  h.game.tick(cook);
  h.tapAll('cook-2');
  for (const r of ROLLS) {
    h.game.tick(roll);
    h.tapAll(r);
  }
}
function plates(h: H, n: number) {
  for (let i = 0; i < n; i++) plate(h);
}
const lastReview = (h: H) => h.game.state.reviews.at(-1) as ReviewResult;

describe('초기 상태', () => {
  it('튜토리얼, 6구 마가린 대기, 트레이는 문어 1 + 함정 5', () => {
    const { game } = setup();
    const s = game.state;
    expect(s.phase).toBe('tutorial');
    expect(s.holes).toHaveLength(6);
    expect(s.holes.every((x) => x.step === 'margarine' && x.gauge === 0 && x.filling === null)).toBe(true);
    expect(s.tray).toHaveLength(6);
    expect(s.tray.filter((i) => !i.isTrap).map((i) => i.id)).toEqual(['octopus']);
    expect(s.tray.filter((i) => i.isTrap).map((i) => i.id).sort()).toEqual(
      ['chili', 'eraser', 'marshmallow', 'raw-garlic', 'wasabi'],
    );
    expect(s.reviews).toEqual([]);
    expect(s.sessionAverage).toBeNull();
    expect(s.tutorialCompleted).toBe(false);
    expect(game.finished).toBe(false);
  });

  it('트레이는 시드에 따라 매 판 셔플된다', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 8; seed++) orders.add(setup({ seed }).game.state.tray.map((i) => i.id).join());
    expect(orders.size).toBeGreaterThan(1);
  });

  it('대사 풀에 성격 하나라도 문항이 없으면 생성 시 던진다', () => {
    const lines: DialogueLine[] = syntheticData.dialogues.filter((l) => l.personality !== 'tourist');
    expect(() => setup({ data: { ...syntheticData, dialogues: lines } })).toThrow();
  });
});

describe('리뷰 코멘트 후보 검사', () => {
  it('성격 × 별점 구간 1~5 후보가 모두 있으면 생성된다', () => {
    expect(() => setup()).not.toThrow();
  });

  it('후보가 빈 (성격, 구간)이 하나라도 있으면 생성 시 던진다', () => {
    const data: GameData = {
      ...syntheticData,
      reviewComments: (p, bucket) => (p === 'gourmet' && bucket === 3 ? [] : ['x']),
    };
    expect(() => setup({ data })).toThrow(/gourmet 3/);
  });
});

describe('굽기 흐름과 게이지 (본게임 P1)', () => {
  function toP1() {
    const h = setup();
    plate(h);
    expect(h.game.state.phase).toBe('P1');
    return h;
  }

  it('단계 순서대로 진행하고 이벤트를 낸다', () => {
    const h = toP1();
    const before = h.of('cook/step-advanced').length;
    h.tap(0, 'margarine');
    h.tap(0, 'batter');
    expect(h.game.state.holes[0]?.step).toBe('cook-1');
    expect(h.of('cook/step-advanced').slice(before)).toEqual([
      { hole: 0, step: 'batter' },
      { hole: 0, step: 'cook-1' },
    ]);
  });

  it('구멍별로 독립이다', () => {
    const h = toP1();
    h.tap(2, 'margarine');
    const steps = h.game.state.holes.map((x) => x.step);
    expect(steps).toEqual(['margarine', 'margarine', 'batter', 'margarine', 'margarine', 'margarine']);
  });

  it('게이지는 익힘 단계에서만 흐르고 100에서 멈춘다', () => {
    const h = toP1();
    h.tapAll('margarine');
    h.tapAll('batter');
    h.game.tick(1.5);
    expect(h.game.state.holes[0]?.gauge).toBeCloseTo(0.3, 9);
    h.game.tick(60);
    expect(h.game.state.holes[0]?.gauge).toBe(1);
  });

  it('빠르면 덜익음, 적정 구간이면 적정, 늦으면 탐', () => {
    const h = toP1();
    h.tapAll('margarine');
    h.tapAll('batter');
    h.tap(0, 'cook-1'); // 0초 → 덜익음
    h.game.tick(3);
    h.tap(1, 'cook-1'); // 3초 → 60 → 적정
    h.game.tick(1.5);
    h.tap(2, 'cook-1'); // 4.5초 → 90 → 탐
    const judged = h.of('cook/judged').slice(-3);
    expect(judged).toEqual([
      { hole: 0, step: 'cook-1', doneness: 'under' },
      { hole: 1, step: 'cook-1', doneness: 'perfect' },
      { hole: 2, step: 'cook-1', doneness: 'burnt' },
    ]);
    expect(h.game.state.holes[0]?.judgements).toEqual(['under']);
  });

  it('현재 단계와 다른 탭은 무시한다(본게임)', () => {
    const h = toP1();
    const before = h.log.length;
    h.tap(0, 'batter');
    h.tap(9, 'margarine');
    expect(h.game.state.holes[0]?.step).toBe('margarine');
    expect(h.log.length).toBe(before);
  });

  it('속재료 넣기: 재료가 구멍에 기록되고 이벤트를 낸다', () => {
    const h = toP1();
    h.tapAll('margarine');
    h.tapAll('batter');
    h.game.tick(3);
    h.tapAll('cook-1');
    h.tap(0, 'filling'); // 재료 없이 누르면 무시
    expect(h.game.state.holes[0]?.step).toBe('filling');
    h.tap(0, 'filling', 'wasabi');
    expect(h.game.state.holes[0]).toMatchObject({ step: 'cook-2', filling: 'wasabi' });
    expect(h.of('cook/ingredient-added')).toContainEqual({ hole: 0, ingredient: 'wasabi' });
  });

  it('굴리기 바는 1.2초 주기로 왕복한다', () => {
    const h = toP1();
    h.tapAll('margarine');
    h.tapAll('batter');
    h.game.tick(3);
    h.tapAll('cook-1');
    h.tapAll('filling', 'octopus');
    h.game.tick(3);
    h.tapAll('cook-2');
    h.game.tick(0.6);
    expect(h.game.state.holes[0]?.gauge).toBeCloseTo(1, 9);
    h.game.tick(0.6);
    expect(h.game.state.holes[0]?.gauge).toBeCloseTo(0, 9);
  });

  it('6구가 모두 완성되면 완성 이벤트가 구멍마다 나가고 P1은 서빙 없이 P2로 전환한다', () => {
    const h = toP1();
    const before = h.of('cook/completed').length;
    plate(h);
    expect(h.of('cook/completed').length - before).toBe(6);
    expect(h.game.state.phase).toBe('P2');
    expect(h.game.state.reviews).toHaveLength(1); // 튜토리얼 리뷰만. P1은 미집계
    expect(h.game.state.holes.every((x) => x.step === 'margarine')).toBe(true);
  });
});

describe('튜토리얼', () => {
  it('순서 외 탭은 무시하고 기대 단계를 알린다', () => {
    const h = setup();
    h.tap(0, 'batter');
    expect(h.of('tutorial/invalid-tap')).toEqual([{ expected: 'margarine' }]);
    expect(h.game.state.holes[0]?.step).toBe('margarine');
    h.tap(0, 'margarine');
    h.tap(1, 'batter'); // 1번 구멍은 아직 마가린 → 무효
    expect(h.of('tutorial/invalid-tap')).toHaveLength(2);
    h.tap(0, 'margarine'); // 이미 지난 단계 → 무효
    expect(h.of('tutorial/invalid-tap')).toHaveLength(3);
    h.tapAll('margarine'); // 0번은 이미 진행 → 무효 1회, 나머지 5구 유효
    expect(h.game.state.holes.map((x) => x.step)).toEqual(['batter', 'batter', 'batter', 'batter', 'batter', 'batter']);
  });

  it('익음 적정 40~100, 탐 없음', () => {
    const h = setup();
    h.tapAll('margarine');
    h.tapAll('batter');
    h.game.tick(1.9); // 38
    h.tap(0, 'cook-1');
    h.game.tick(0.1); // 40
    h.tap(1, 'cook-1');
    h.game.tick(60);
    h.tap(2, 'cook-1');
    expect(h.of('cook/judged')).toEqual([
      { hole: 0, step: 'cook-1', doneness: 'under' },
      { hole: 1, step: 'cook-1', doneness: 'perfect' },
      { hole: 2, step: 'cook-1', doneness: 'perfect' },
    ]);
  });

  it('굴리기는 전 구간 성공', () => {
    const h = setup();
    h.tapAll('margarine');
    h.tapAll('batter');
    h.game.tick(3);
    h.tapAll('cook-1');
    h.tapAll('filling', 'octopus');
    h.game.tick(3);
    h.tapAll('cook-2');
    h.tap(0, 'roll-1'); // 바 0
    expect(h.of('cook/judged').at(-1)).toEqual({ hole: 0, step: 'roll-1', doneness: 'perfect' });
  });

  it('함정 재료는 경고만 하고 넣어지지 않는다', () => {
    const h = setup();
    h.tapAll('margarine');
    h.tapAll('batter');
    h.game.tick(3);
    h.tapAll('cook-1');
    h.tap(0, 'filling', 'wasabi');
    expect(h.of('tutorial/trap-warning')).toEqual([{ ingredient: 'wasabi' }]);
    expect(h.game.state.holes[0]).toMatchObject({ step: 'filling', filling: null });
    h.tap(0, 'filling', 'octopus');
    expect(h.game.state.holes[0]?.step).toBe('cook-2');
  });

  it('완수하면 5★ 리뷰 1개를 확정 지급하고 저장한 뒤 P1로 간다', () => {
    const h = setup();
    plate(h);
    const review = lastReview(h);
    expect(review).toEqual({ source: 'tutorial', stars: 5, comment: syntheticData.tutorialComment, personality: null });
    expect(h.of('review/issued')).toEqual([{ review }]);
    expect(h.game.state).toMatchObject({ phase: 'P1', tutorialCompleted: true, sessionAverage: 5 });
    expect(h.of('phase/changed')).toEqual([{ phase: 'tutorial' }, { phase: 'P1' }]);
    expect(h.store.load()).toEqual({ version: 1, tutorialCompleted: true, finished: false, reviews: [review] });
  });
});

describe('점수 (접시 단위, GDD §굽기·§점수)', () => {
  function toP2() {
    const h = setup();
    plates(h, 2);
    expect(h.game.state.phase).toBe('P2');
    return h;
  }

  it('완벽 굽기: 만족도 80+20 → 5★', () => {
    const h = toP2();
    plate(h);
    expect(lastReview(h)).toMatchObject({ source: 'customer', stars: 5 });
  });

  it('덜익음이 있으면 -10 (접시당 1회): 70 → 3.5★', () => {
    const h = toP2();
    plate(h, { cook: 0 });
    expect(lastReview(h).stars).toBe(3.5);
  });

  it('탐도 -10: 70 → 3.5★', () => {
    const h = toP2();
    plate(h, { cook: 5 });
    expect(lastReview(h).stars).toBe(3.5);
  });

  it('함정 재료가 한 구멍이라도 있으면 -20 (완벽 +20 없음): 60 → 3★', () => {
    const h = toP2();
    plate(h, { trap: 'chili' });
    expect(lastReview(h).stars).toBe(3);
  });

  it('덜익음 + 함정: -10 -20 → 50 → 2.5★', () => {
    const h = toP2();
    plate(h, { cook: 0, trap: 'eraser' });
    expect(lastReview(h).stars).toBe(2.5);
  });

  it('굴리기 실패는 감점 없이 완벽만 무효: 80 → 4★', () => {
    const h = toP2();
    plate(h, { roll: 0 });
    expect(lastReview(h).stars).toBe(4);
  });

  it('세션 점수는 튜토리얼 5★ 포함 모든 리뷰의 평균', () => {
    const h = toP2();
    plate(h); // 5
    plate(h, { roll: 0 }); // 4
    expect(h.game.state.reviews.map((r) => r.stars)).toEqual([5, 5, 4]);
    expect(h.game.state.sessionAverage).toBeCloseTo(14 / 3, 12);
  });
});

describe('손님 흐름 (GDD §손님 대화·§진행)', () => {
  it('P2: 시작하면 손님1 입장, 서빙하면 리뷰·퇴장, 2초 뒤 다음 손님', () => {
    const h = setup();
    plates(h, 2);
    expect(h.game.state.customers).toHaveLength(1);
    const first = h.game.state.customers[0];
    expect(first).toMatchObject({ satisfaction: 80, dialogueIntervalSec: 12 });
    plate(h);
    expect(h.game.state.customers).toHaveLength(0);
    expect(h.of('customer/left')).toEqual([{ customerId: first?.id }]);
    h.game.tick(1.9);
    expect(h.game.state.customers).toHaveLength(0);
    h.game.tick(0.1);
    expect(h.game.state.customers).toHaveLength(1);
    expect(h.game.state.customers[0]?.id).not.toBe(first?.id);
  });

  it('P2는 2접시를 서빙하면 P3로 간다', () => {
    const h = setup();
    plates(h, 4);
    expect(h.game.state.phase).toBe('P3');
    expect(h.game.state.reviews.map((r) => r.source)).toEqual(['tutorial', 'customer', 'customer']);
  });

  it('P3: 손님2가 3초 뒤 입장하고 간격은 각 12초', () => {
    const h = setup();
    plates(h, 4);
    expect(h.game.state.customers).toHaveLength(1);
    h.game.tick(2.9);
    expect(h.game.state.customers).toHaveLength(1);
    h.game.tick(0.1);
    expect(h.game.state.customers.map((c) => c.dialogueIntervalSec)).toEqual([12, 12]);
  });

  it('P4 손님 간격은 6s / 12s, P5는 각 6s', () => {
    const h = setup();
    plates(h, 8); // P3(4접시) 끝
    expect(h.game.state.phase).toBe('P4');
    h.game.tick(3);
    expect(h.game.state.customers.map((c) => c.dialogueIntervalSec)).toEqual([6, 12]);
    plates(h, 4);
    expect(h.game.state.phase).toBe('P5');
    h.game.tick(3);
    expect(h.game.state.customers.map((c) => c.dialogueIntervalSec)).toEqual([6, 6]);
  });

  it('입장 제한: (서빙 수 + 현재 손님 수) < 목표일 때만. 마지막 접시 뒤에는 손님이 남지 않는다', () => {
    const h = setup();
    plates(h, 4); // P3 시작
    h.game.tick(3); // 손님 2명
    plates(h, 3); // 접시 3개 서빙: served=3
    expect(h.game.state.phase).toBe('P3');
    h.game.tick(10); // 3 + 1 == 4 → 더 입장하지 않는다
    expect(h.game.state.customers).toHaveLength(1);
    plate(h);
    expect(h.game.state.phase).toBe('P4');
    expect(h.game.state.customers.length).toBe(1); // P4 시작 직후 손님1만
  });

  it('선착순: 가장 먼저 온 손님에게 서빙한다', () => {
    const h = setup();
    plates(h, 4);
    h.game.tick(3);
    const [a, b] = h.game.state.customers;
    plate(h);
    expect(h.of('customer/left')).toContainEqual({ customerId: a?.id });
    expect(h.game.state.customers.map((c) => c.id)).not.toContain(a?.id);
    expect(h.game.state.customers.some((c) => c.id === b?.id)).toBe(true);
  });

  it('서빙 후 6구는 마가린부터 다시, 트레이는 다시 셔플된다', () => {
    const h = setup({ seed: 5 });
    plates(h, 2);
    const before = h.game.state.tray.map((i) => i.id).join();
    const orders = new Set([before]);
    for (let i = 0; i < 3; i++) {
      plate(h);
      orders.add(h.game.state.tray.map((x) => x.id).join());
    }
    expect(h.game.state.holes.every((x) => x.step === 'margarine')).toBe(true);
    expect(orders.size).toBeGreaterThan(1);
  });

  it('손님이 없을 때 완성한 접시는 다음 손님이 오면 서빙된다', () => {
    const h = setup();
    plates(h, 3); // P2 첫 접시 서빙 → 손님 없음
    expect(h.game.state.customers).toHaveLength(0);
    h.tapAll('margarine');
    h.tapAll('batter');
    h.tapAll('cook-1');
    h.tapAll('filling', 'octopus');
    h.tapAll('cook-2');
    for (const r of ROLLS) h.tapAll(r);
    expect(h.game.state.reviews).toHaveLength(2);
    h.game.tick(2);
    expect(h.game.state.reviews).toHaveLength(3);
    expect(h.game.state.phase).toBe('P3');
  });
});

describe('대화 (GDD §손님 대화)', () => {
  function toP2() {
    const h = setup();
    plates(h, 2);
    return h;
  }

  it('발화 간격 뒤에 대화가 시작되고 5초 안에 답하지 않으면 시간초과 -10', () => {
    const h = toP2();
    h.game.tick(11.9);
    expect(h.game.state.activeDialogues).toHaveLength(0);
    h.game.tick(0.1);
    const d = h.game.state.activeDialogues[0];
    expect(d).toMatchObject({ remainingSec: 5 });
    expect(h.of('dialogue/started')).toHaveLength(1);
    h.game.tick(4.9);
    expect(h.game.state.activeDialogues).toHaveLength(1);
    h.game.tick(0.1);
    expect(h.game.state.activeDialogues).toHaveLength(0);
    expect(h.of('dialogue/resolved')).toEqual([{ customerId: d?.customerId, outcome: 'timeout' }]);
    expect(h.game.state.customers[0]?.satisfaction).toBe(70);
  });

  it('좋은 답 +10, 나쁜 답 -10, 답한 뒤 다시 간격을 센다', () => {
    const h = toP2();
    h.game.tick(12);
    h.answer('good');
    expect(h.game.state.customers[0]?.satisfaction).toBe(90);
    expect(h.game.state.activeDialogues).toHaveLength(0);
    h.game.tick(11.9);
    expect(h.game.state.activeDialogues).toHaveLength(0);
    h.game.tick(0.1);
    h.answer('bad');
    expect(h.game.state.customers[0]?.satisfaction).toBe(80);
    expect(h.of('dialogue/resolved').map((p) => (p as { outcome: string }).outcome)).toEqual(['good', 'bad']);
  });

  it('대화 중에도 굽기 타이머는 진행된다', () => {
    const h = toP2();
    h.tapAll('margarine');
    h.tapAll('batter');
    h.game.tick(12);
    expect(h.game.state.activeDialogues).toHaveLength(1);
    expect(h.game.state.holes[0]?.gauge).toBe(1);
  });

  it('만족도는 0~100으로 clamp', () => {
    const h = toP2();
    for (let i = 0; i < 8; i++) {
      h.game.tick(12);
      h.answer('good');
    }
    expect(h.game.state.customers[0]?.satisfaction).toBe(100);
  });

  it('성격 내 문항은 가능한 한 반복하지 않고, 모두 쓰면 사용 기록을 초기화한다', () => {
    const h = setup();
    plates(h, 2);
    const c = h.game.state.customers[0];
    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      h.game.tick(12);
      const d = h.game.state.activeDialogues[0];
      if (d) seen.push(d.line.prompt);
      h.answer('good');
    }
    expect(seen).toHaveLength(20);
    expect(new Set(seen.slice(0, 10)).size).toBe(10); // 10문항 소진 전에는 반복 없음
    expect(new Set(seen.slice(10)).size).toBe(10); // 소진 후 초기화되어 다시 10문항
    expect(seen.every((s) => s.startsWith(`${c?.personality} `))).toBe(true);
  });

  it('같은 시드면 같은 손님·문항, 알 수 없는 손님·대화 없음 답은 무시한다', () => {
    const run = () => {
      const h = setup({ seed: 9 });
      plates(h, 2);
      h.game.tick(12);
      h.bus.emit('input/answer', { customerId: 'nobody', choice: 'good' });
      return h.game.state.activeDialogues[0]?.line.prompt;
    };
    expect(run()).toBeDefined();
    expect(run()).toBe(run());
  });

  it('서빙으로 손님이 떠나면 진행 중인 대화도 사라진다', () => {
    const h = toP2();
    h.tapAll('margarine');
    h.tapAll('batter');
    h.game.tick(12);
    expect(h.game.state.activeDialogues).toHaveLength(1);
    h.tapAll('cook-1');
    h.tapAll('filling', 'octopus');
    h.tapAll('cook-2');
    for (const r of ROLLS) h.tapAll(r);
    expect(h.game.state.customers).toHaveLength(0);
    expect(h.game.state.activeDialogues).toHaveLength(0);
  });
});

describe('리뷰 코멘트', () => {
  it('별점의 내림 구간(4.5★ → 4)과 성격으로 후보를 받아 고른다', () => {
    const asked: [string, number][] = [];
    const data: GameData = {
      ...syntheticData,
      reviewComments: (p, bucket) => {
        asked.push([p, bucket]);
        return ['a', 'b', 'c'];
      },
    };
    const h = setup({ data });
    plates(h, 2);
    h.game.tick(12);
    h.answer('bad'); // 70
    plate(h, { cook: 3 }); // 70 + 20 = 90 → 4.5★
    expect(lastReview(h).stars).toBe(4.5);
    expect(asked.at(-1)?.[1]).toBe(4);
    expect(['a', 'b', 'c']).toContain(lastReview(h).comment);
  });
});

describe('세션 저장·복원 (ADR 0002)', () => {
  const tutorialReview: ReviewResult = { source: 'tutorial', stars: 5, comment: 't', personality: null };
  const customerReview: ReviewResult = { source: 'customer', stars: 2, comment: 'c', personality: 'tourist' };
  const snap = (over: Partial<SessionSnapshot>): SessionSnapshot => ({
    version: 1,
    tutorialCompleted: true,
    finished: false,
    reviews: [tutorialReview, customerReview],
    ...over,
  });

  it('저장값이 없으면 튜토리얼부터', () => {
    expect(setup().game.state.phase).toBe('tutorial');
  });

  it('튜토리얼 완료 후 새로고침: P1부터, 튜토리얼 리뷰만 남긴다', () => {
    const { game } = setup({ store: createMemorySessionStore(snap({})) });
    expect(game.state).toMatchObject({ phase: 'P1', tutorialCompleted: true, sessionAverage: 5 });
    expect(game.state.reviews).toEqual([tutorialReview]);
    expect(game.finished).toBe(false);
  });

  it('튜토리얼 미완료 저장값은 튜토리얼부터', () => {
    const { game } = setup({ store: createMemorySessionStore(snap({ tutorialCompleted: false, reviews: [] })) });
    expect(game.state.phase).toBe('tutorial');
  });

  it('finished면 리뷰를 모두 복원하고 입력을 받지 않는다', () => {
    const { game, tapAll } = setup({ store: createMemorySessionStore(snap({ finished: true })) });
    expect(game.finished).toBe(true);
    expect(game.state.reviews).toEqual([tutorialReview, customerReview]);
    expect(game.state.sessionAverage).toBe(3.5);
    tapAll('margarine');
    game.tick(10);
    expect(game.state.holes.every((x) => x.step === 'margarine')).toBe(true);
  });

  it('P5를 마치면 finished 저장, 이후 입력은 무시된다', () => {
    const h = setup();
    plates(h, 16);
    expect(h.game.finished).toBe(true);
    expect(h.game.state.phase).toBe('P5');
    expect(h.game.state.reviews).toHaveLength(15);
    expect(h.store.load()).toEqual({
      version: 1,
      tutorialCompleted: true,
      finished: true,
      reviews: h.game.state.reviews,
    });
    h.tapAll('margarine');
    expect(h.game.state.holes.every((x) => x.step === 'margarine')).toBe(true);
  });
});
