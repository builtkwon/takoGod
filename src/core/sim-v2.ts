// 밸런스 시뮬레이터(굽기 개편). 봇이 contracts 이벤트로만 입력해 GameV2를 끝까지 돌리고 세션 평균 별점을 모은다.
// sim.balance 도구가 읽는 진입점(sim.ts)은 integrator 병합 때 이 파일로 바꾼다.
import type { BalanceScenario, BalanceSimulator as BalanceSimulatorPort, EventBus, GameStateV2, ReviewResult, SessionSnapshot } from '../contracts';
import { createEventBus } from './event-bus';
import { GameV2 } from './game-v2';
import { createRng, randomIndex } from './rng';
import { createMemorySessionStore } from './session';
import { syntheticDataV2 } from './synthetic-data-v2';

const DT = 0.05;
/** 무한 루프 방지. 정상 세션은 수만 틱이다. */
const MAX_TICKS = 2_000_000;
/** 무작위 플레이: 틱마다 이 확률로 무작위 조작 하나를 한다(초당 약 4번). */
const RANDOM_ACT_PROB = 0.2;
/** 무작위 플레이: 열린 대화마다 틱당 이 확률로 무작위 답을 누른다. 못 누르면 시간초과다. */
const RANDOM_ANSWER_PROB = 0.02;

/** 전정답 + 완벽 굽기: 영역 안에서만 굴리고, 완성품은 바로 후네에 담고, 대화는 좋은 답만 한다. */
function perfectBot(bus: EventBus, s: GameStateV2): void {
  for (const d of s.activeDialogues) bus.emit('input/answer', { customerId: d.customerId, choice: 'good' });
  for (const h of s.holes) {
    const inZone = h.rollZone !== null && s.barPosition >= h.rollZone.from && s.barPosition <= h.rollZone.to;
    if (h.stage === 'empty') bus.emit('input/place-material', { hole: h.index, material: { kind: 'margarine' } });
    else if (h.stage === 'greased') bus.emit('input/place-material', { hole: h.index, material: { kind: 'batter' } });
    else if (h.stage === 'cooked') bus.emit('input/place-material', { hole: h.index, material: { kind: 'filling', ingredient: 'octopus' } });
    else if ((h.stage === 'filled' || h.stage === 'rolled') && inZone) bus.emit('input/roll', { hole: h.index });
    else if (h.stage === 'done') {
      bus.emit('input/pick', { hole: h.index });
      bus.emit('input/drop', { target: 'fune' });
    }
  }
}

/**
 * 무작위 플레이(GDD §밸런스 목표): 틱마다 무작위 구멍 하나에 그 구멍이 받을 수 있는 다음 조작을 한다.
 * 재료는 트레이에서 무작위, 굴리기 타이밍은 무작위, 대화 답은 무작위(못 누르면 시간초과). 탄 것은 후네 밖(other)에 버린다.
 */
function randomBot(bus: EventBus, s: GameStateV2, rng: () => number): void {
  for (const d of s.activeDialogues) {
    if (rng() < RANDOM_ANSWER_PROB) bus.emit('input/answer', { customerId: d.customerId, choice: rng() < 0.5 ? 'good' : 'bad' });
  }
  if (rng() >= RANDOM_ACT_PROB) return;
  const h = s.holes[randomIndex(s.holes.length, rng)];
  if (h === undefined) return;
  const hole = h.index;
  if (h.stage === 'empty') bus.emit('input/place-material', { hole, material: { kind: 'margarine' } });
  else if (h.stage === 'greased') bus.emit('input/place-material', { hole, material: { kind: 'batter' } });
  else if (h.stage === 'cooked') {
    const ingredient = s.tray[randomIndex(s.tray.length, rng)]?.id;
    if (ingredient !== undefined) bus.emit('input/place-material', { hole, material: { kind: 'filling', ingredient } });
  } else if (h.stage === 'filled' || h.stage === 'rolled') bus.emit('input/roll', { hole });
  else if (h.stage === 'done' || h.stage === 'dark' || h.stage === 'burnt') {
    bus.emit('input/pick', { hole });
    bus.emit('input/drop', { target: h.stage === 'burnt' ? 'other' : 'fune' });
  }
}

/** 극단 비교용: 아무 구멍에 아무 조작이나 한다(재료·탭·들어서 후네/화면 밖/다른 곳). 순서를 모르는 플레이어다. */
function chaosBot(bus: EventBus, s: GameStateV2, rng: () => number): void {
  for (const d of s.activeDialogues) {
    if (rng() < RANDOM_ANSWER_PROB) bus.emit('input/answer', { customerId: d.customerId, choice: rng() < 0.5 ? 'good' : 'bad' });
  }
  if (rng() >= RANDOM_ACT_PROB) return;
  const hole = randomIndex(s.holes.length, rng);
  const op = randomIndex(5, rng);
  if (op === 0) bus.emit('input/place-material', { hole, material: { kind: 'margarine' } });
  else if (op === 1) bus.emit('input/place-material', { hole, material: { kind: 'batter' } });
  else if (op === 2) {
    const ingredient = s.tray[randomIndex(s.tray.length, rng)]?.id;
    if (ingredient !== undefined) bus.emit('input/place-material', { hole, material: { kind: 'filling', ingredient } });
  } else if (op === 3) bus.emit('input/roll', { hole });
  else {
    bus.emit('input/pick', { hole });
    bus.emit('input/drop', { target: (['fune', 'offscreen', 'other'] as const)[randomIndex(3, rng)] ?? 'other' });
  }
}

export interface SessionResultV2 {
  readonly finished: boolean;
  readonly reviews: readonly ReviewResult[];
  readonly average: number | null;
  readonly saved: SessionSnapshot | null;
}

/** 세션 하나를 끝까지 돌린다. 튜토리얼은 안내를 따라가야 하므로 두 봇 모두 정석대로 진행한다. */
export function playSessionV2(kind: BalanceScenario['kind'] | 'chaos', seed: number): SessionResultV2 {
  const bus = createEventBus();
  const store = createMemorySessionStore();
  const game = new GameV2({ bus, data: syntheticDataV2, rng: createRng(seed), store });
  const botRng = createRng(seed ^ 0x9e3779b9);
  for (let i = 0; i < MAX_TICKS && !game.finished; i++) {
    const s = game.state;
    if (kind === 'perfect' || s.phase === 'tutorial') perfectBot(bus, s);
    else if (kind === 'chaos') chaosBot(bus, s, botRng);
    else randomBot(bus, s, botRng);
    game.tick(DT);
  }
  if (!game.finished) throw new Error(`세션이 ${MAX_TICKS}틱 안에 끝나지 않았다(${kind}, seed ${seed})`);
  const s = game.state;
  return { finished: true, reviews: s.reviews, average: s.sessionAverage, saved: store.load() };
}

export const BalanceSimulatorV2: BalanceSimulatorPort = {
  run(scenario) {
    if (!Number.isInteger(scenario.sessions) || scenario.sessions < 1) throw new Error('sessions는 1 이상의 정수');
    let sum = 0;
    for (let i = 0; i < scenario.sessions; i++) {
      const avg = playSessionV2(scenario.kind, scenario.seed * 1_000_003 + i).average;
      if (avg === null) throw new Error('리뷰가 없다');
      sum += avg;
    }
    return sum / scenario.sessions;
  },
};
