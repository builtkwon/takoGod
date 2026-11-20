// GameV2 테스트 공용 도구. 시간은 h.tick으로만 흘린다(실제 타이머 없음).
import type { DropTarget, GameEventType, GameEvents, HoleStateV2, IngredientId, Material, RollZone } from '../../contracts';
import { FUNE_SERVE_DELAY_SEC } from '../cooking-v2';
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
  'customer/fumed',
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
  /**
   * true면 영역 위치 뽑기(반죽 놓기·굴리기 1)도 rng에서 뽑는다(GDD §손님 대화 난수 순서).
   * 기본은 난수 0.5로 고정해(영역이 바 가운데) rng 수열이 영역 뽑기에 밀리지 않게 하고 구멍들을 한꺼번에 굴릴 수 있게 한다.
   */
  readonly liveZones?: boolean;
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
  const baseRng = opts.rng ?? createRng(opts.seed ?? 1);
  const zoneRng = (): number => 0.5; // 모든 구멍의 영역이 바 가운데에 같게 놓여 구멍들을 한꺼번에 굴릴 수 있다
  let zoneDraw = false;
  const rng = (): number => (zoneDraw && !opts.liveZones ? zoneRng() : baseRng());
  const game = new GameV2({ bus, data: opts.data ?? syntheticDataV2, rng, store });
  /** 영역 위치를 뽑는 입력(반죽 놓기, 굴리기 1)을 내는 동안만 zoneDraw를 켠다. */
  const emitDrawing = (fn: () => void): void => {
    zoneDraw = true;
    try {
      fn();
    } finally {
      zoneDraw = false;
    }
  };
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
    place: (hole: number, material: Material) => {
      const emit = () => bus.emit('input/place-material', { hole, material });
      if (material.kind === 'batter') emitDrawing(emit);
      else emit();
    },
    roll: (hole: number) => {
      const stage = game.state.holes[hole]?.stage;
      const emit = () => bus.emit('input/roll', { hole });
      if (stage === 'cooking' || stage === 'cooked' || stage === 'filled') emitDrawing(emit);
      else emit();
    },
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

/** 바 위치가 [lo, hi]에 들어올 때까지 1ms씩 진행한다. */
export function tickUntilBar(h: H, [lo, hi]: readonly [number, number]): void {
  for (let i = 0; i < 3000; i++) {
    const p = h.game.state.barPosition;
    if (p >= lo && p <= hi) return;
    h.tick(0.001);
  }
  throw new Error(`바가 ${lo}~${hi}에 오지 않았다`);
}

/** 구멍의 현재 영역(영역은 구멍마다 무작위다). 영역이 없으면 던진다. */
export function zoneOfHole(h: H, i: number): RollZone {
  const z = h.hole(i).rollZone;
  if (z === null) throw new Error(`구멍 ${i}에 영역이 없다(${h.hole(i).stage})`);
  return z;
}

/** 바가 구멍 영역 안쪽(경계 0.01 안)에 오거나(hit) 영역 밖(경계 0.02 밖)에 올 때까지 진행한다. */
export function tickUntilZone(h: H, i: number, hit = true): void {
  const z = zoneOfHole(h, i);
  for (let k = 0; k < 6000; k++) {
    const p = h.game.state.barPosition;
    if (hit ? p >= z.from + 0.01 && p <= z.to - 0.01 : p < z.from - 0.02 || p > z.to + 0.02) return;
    h.tick(0.001);
  }
  throw new Error(`바가 구멍 ${i} 영역(${hit ? '안' : '밖'})에 오지 않았다`);
}

/** 구멍 하나를 영역 안(hit)이나 밖에서 굴린다. */
export function rollHole(h: H, i: number, hit = true): void {
  tickUntilZone(h, i, hit);
  h.roll(i);
}

/** hole을 level까지 진행한다: 1 기름칠, 2 익힘, 3 익힘 완료, 4 속재료 후(문어), 5 굴림 1(적중). */
export function reach(h: H, holes: number | readonly number[], level: number): void {
  const hs = typeof holes === 'number' ? [holes] : holes;
  if (level >= 1) for (const i of hs) h.place(i, MARGARINE);
  if (level >= 2) for (const i of hs) h.place(i, BATTER);
  if (level >= 3) h.tick(3);
  if (level >= 4) for (const i of hs) h.place(i, fill());
  if (level >= 5) rollGroup(h, hs, true);
}

/** 영역이 같은 구멍들을 같은 순간에 굴린다(기본 setupV2에서 영역은 모두 같다). liveZones에서는 구멍마다 rollHole을 쓴다. */
export function rollGroup(h: H, holes: readonly number[], hit: boolean): void {
  const first = holes[0];
  if (first === undefined) return;
  tickUntilZone(h, first, hit);
  for (const i of holes) h.roll(i);
}

/** holes를 같은 시각에 완성(done)까지 진행한다(굴리기 2회 적중). */
export function reachDone(h: H, ...holes: number[]): void {
  reach(h, holes, 5);
  rollGroup(h, holes, true);
}

export interface HoleSpec {
  /** 'none'이면 속재료 전에 굴려 속 없음으로 만든다. 기본 문어. */
  readonly filling?: IngredientId | 'none';
  readonly miss1?: boolean;
  readonly miss2?: boolean;
  /** 어두워진 채로 후네에 담는다. */
  readonly dark?: boolean;
}

/**
 * 구멍 6개(0~5)를 완성품 6개로 구워 후네에 담는다(6개가 차면 끝에 서빙·비움까지 1초 진행한다).
 * 같은 순간에 굴려 한꺼번에 완성한다(어두운 것은 완성 뒤 4초를 기다려 담는다).
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
  rollGroup(h, ALL.filter((i) => specOf(i).miss1), false);
  rollGroup(h, ALL.filter((i) => !specOf(i).miss1), true);
  rollGroup(h, ALL.filter((i) => specOf(i).miss2), false);
  rollGroup(h, ALL.filter((i) => !specOf(i).miss2), true);

  const fresh = ALL.filter((i) => !specOf(i).dark);
  const dark = ALL.filter((i) => specOf(i).dark);
  const order = [...fresh, ...dark];
  for (let k = 0; k < order.length; k++) {
    if (k === fresh.length && dark.length > 0) h.tick(4);
    h.pick(order[k] as number);
    if (hold && k === order.length - 1) return () => { h.drop('fune'); h.tick(FUNE_SERVE_DELAY_SEC); };
    h.drop('fune');
  }
  h.tick(FUNE_SERVE_DELAY_SEC); // 후네가 찬 뒤 서빙(또는 비움)까지 1초
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
