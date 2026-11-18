// GameV2 테스트 공용 도구. 시간은 h.tick으로만 흘린다(실제 타이머 없음).
import type { DropTarget, GameEventType, GameEvents, HoleStateV2, IngredientId, Material } from '../../contracts';
import { createEventBus } from '../event-bus';
import { GameV2, type GameDataV2 } from '../game-v2';
import { createRng } from '../rng';
import { createMemorySessionStore } from '../session';
import { syntheticDataV2 } from '../synthetic-data-v2';

export const OUTPUT_EVENTS: readonly GameEventType[] = [
  'cook/rejected',
  'cook/dropped',
  'cook/rolled',
  'cook/tap-ignored',
  'cook/darkened',
  'cook/burnt',
  'fune/added',
  'customer/entered',
  'customer/left',
  'dialogue/started',
  'dialogue/resolved',
  'customer/patience-changed',
  'plate/tasted',
  'plate/scored',
  'customer/redo-requested',
  'customer/walked-out',
  'phase/changed',
  'review/issued',
  'tutorial/invalid-action',
  'tutorial/trap-warning',
];

export interface Rec {
  readonly type: GameEventType;
  readonly payload: unknown;
  readonly t: number;
}

/** 앞에서부터 values를 차례로 돌려주고 다 쓰면 fallback. 난수 소비 순서를 검증하는 데 쓴다. */
export function scripted(values: readonly number[], fallback = 0.99) {
  let calls = 0;
  return {
    rng: (): number => values[calls++] ?? fallback,
    /** 지금까지 뽑은 횟수(values를 다 쓴 뒤의 fallback 포함). */
    used: (): number => calls,
  };
}

/** 평소에는 base를 돌려주고, set(v)로 잡아 두면 해제할 때까지 v만 돌려준다. */
export function controlled(base = 0.99) {
  let forced: number | null = null;
  return {
    rng: (): number => forced ?? base,
    set: (v: number | null): void => {
      forced = v;
    },
  };
}

export interface SetupOpts {
  readonly seed?: number;
  readonly rng?: () => number;
  /** true면 튜토리얼부터 시작한다. 기본은 튜토리얼 완료 저장값으로 P1부터. */
  readonly tutorial?: boolean;
  readonly data?: GameDataV2;
}

export function setupV2(opts: SetupOpts = {}) {
  const bus = createEventBus();
  const log: Rec[] = [];
  let t = 0;
  for (const type of OUTPUT_EVENTS) bus.on(type, (payload) => log.push({ type, payload, t }));
  const store = createMemorySessionStore(
    opts.tutorial
      ? null
      : {
          version: 1,
          tutorialCompleted: true,
          finished: false,
          reviews: [{ source: 'tutorial', stars: 5, comment: 'tutorial 5 stars', personality: null }],
        },
  );
  const game = new GameV2({ bus, data: opts.data ?? syntheticDataV2, rng: opts.rng ?? createRng(opts.seed ?? 1), store });
  return {
    bus,
    game,
    store,
    log,
    get now(): number {
      return t;
    },
    tick(dt: number): void {
      t += dt;
      game.tick(dt);
    },
    of<K extends GameEventType>(type: K): GameEvents[K][] {
      return log.filter((r) => r.type === type).map((r) => r.payload as GameEvents[K]);
    },
    place: (hole: number, material: Material) => bus.emit('input/place-material', { hole, material }),
    roll: (hole: number) => bus.emit('input/roll', { hole }),
    pick: (hole: number) => bus.emit('input/pick', { hole }),
    drop: (target: DropTarget) => bus.emit('input/drop', { target }),
    answer: (customerId: string, choice: 'good' | 'bad') => bus.emit('input/answer', { customerId, choice }),
    hole: (i: number): HoleStateV2 => game.state.holes[i] as HoleStateV2,
  };
}
export type H = ReturnType<typeof setupV2>;

export const ALL = [0, 1, 2, 3, 4, 5] as const;
export const MARGARINE: Material = { kind: 'margarine' };
export const BATTER: Material = { kind: 'batter' };
export const fill = (ingredient: IngredientId = 'octopus'): Material => ({ kind: 'filling', ingredient });

/** 바 위치 구간(W1 40~60, W2 42~58 안쪽 / 두 영역 밖). */
export const HIT1: readonly [number, number] = [0.45, 0.55];
export const HIT2: readonly [number, number] = [0.47, 0.53];
export const MISS: readonly [number, number] = [0.75, 1];

/** 바 위치가 [lo, hi]에 들어올 때까지 1ms씩 진행한다. */
export function tickUntilBar(h: H, [lo, hi]: readonly [number, number]): void {
  for (let i = 0; i < 3000; i++) {
    const p = h.game.state.barPosition;
    if (p >= lo && p <= hi) return;
    h.tick(0.001);
  }
  throw new Error(`바가 ${lo}~${hi}에 오지 않았다`);
}

/** hole을 level까지 진행한다: 1 기름칠, 2 익힘, 3 익힘 완료, 4 속재료 후(문어), 5 굴림 1(적중). */
export function reach(h: H, holes: number | readonly number[], level: number): void {
  const hs = typeof holes === 'number' ? [holes] : holes;
  if (level >= 1) for (const i of hs) h.place(i, MARGARINE);
  if (level >= 2) for (const i of hs) h.place(i, BATTER);
  if (level >= 3) h.tick(3);
  if (level >= 4) for (const i of hs) h.place(i, fill());
  if (level >= 5) {
    tickUntilBar(h, HIT1);
    for (const i of hs) h.roll(i);
  }
}

/** holes를 함께 완성(done)까지 진행한다(굴리기 2회 적중). 모두 같은 시각에 완성된다. */
export function reachDone(h: H, ...holes: number[]): void {
  reach(h, holes, 5);
  tickUntilBar(h, HIT2);
  for (const i of holes) h.roll(i);
}

export interface HoleSpec {
  /** 'none'이면 속재료 전에 굴려 속 없음으로 만든다. 기본 문어. */
  readonly filling?: IngredientId | 'none';
  readonly miss1?: boolean;
  readonly miss2?: boolean;
  /** 어두워진 채로 후네에 담는다. */
  readonly dark?: boolean;
}

function rollGroup(h: H, holes: readonly number[], zone: readonly [number, number]): void {
  if (holes.length === 0) return;
  tickUntilBar(h, zone);
  for (const i of holes) h.roll(i);
}

/**
 * 6구를 완성품 6개로 구워 후네에 담는다(6개가 차면 서빙·비움이 일어난다).
 * hold=true면 마지막 1개는 들고 멈추고, 돌려준 함수를 부르면 놓는다(들고 있는 동안 탐 타이머가 멈춘다).
 */
export function makePlate(h: H, specs: HoleSpec | readonly HoleSpec[] = {}, hold = false): () => void {
  const specOf = (i: number): HoleSpec => (Array.isArray(specs) ? (specs as readonly HoleSpec[])[i] : (specs as HoleSpec)) ?? {};
  for (const i of ALL) h.place(i, MARGARINE);
  for (const i of ALL) h.place(i, BATTER);
  h.tick(3);
  for (const i of ALL) {
    const f = specOf(i).filling ?? 'octopus';
    if (f !== 'none') h.place(i, fill(f));
  }
  // 속 없음 구멍은 속재료 전에 굴린다(그 탭이 굴리기 1).
  rollGroup(h, ALL.filter((i) => specOf(i).miss1), MISS);
  rollGroup(h, ALL.filter((i) => !specOf(i).miss1), HIT1);
  rollGroup(h, ALL.filter((i) => specOf(i).miss2), MISS);
  rollGroup(h, ALL.filter((i) => !specOf(i).miss2), HIT2);

  const fresh = ALL.filter((i) => !specOf(i).dark);
  const dark = ALL.filter((i) => specOf(i).dark);
  const order = [...fresh, ...dark];
  for (let k = 0; k < order.length; k++) {
    if (k === fresh.length && dark.length > 0) h.tick(3);
    h.pick(order[k] as number);
    if (hold && k === order.length - 1) return () => h.drop('fune');
    h.drop('fune');
  }
  return () => {};
}

/** 완벽한 접시를 target 페이즈에 닿을 때까지 만든다. */
export function playUntilPhase(h: H, phase: string): void {
  for (let i = 0; i < 12 && h.game.state.phase !== phase; i++) makePlate(h);
  if (h.game.state.phase !== phase) throw new Error(`${phase}에 닿지 못했다: ${h.game.state.phase}`);
}

/** abs(h.now 기준 절대 시각)까지 0.1초 단위로 진행한다. */
export function tickTo(h: H, abs: number): void {
  while (h.now < abs - 1e-9) h.tick(Math.min(0.1, abs - h.now));
}

export const customerEnteredAt = (h: H, index = 0): number => h.log.filter((r) => r.type === 'customer/entered')[index]?.t ?? NaN;
