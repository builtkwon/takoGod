// 밸런스 시뮬레이터. 도구 연결: contracts tooling.ts의 SimModule, 소비자는 harness/scripts/simulate.ts.
// 봇이 contracts 이벤트로만 입력해 Game을 끝까지 돌리고 세션 평균 별점을 모은다. 대사는 자리표시 데이터다(점수에 글은 영향이 없다).
import type { BalanceScenario, BalanceSimulator as BalanceSimulatorPort, EventBus, GameState } from '../contracts';
import { STEP_ORDER, createDonenessJudge } from './cooking';
import { createEventBus } from './event-bus';
import { Game } from './game';
import { createRng, randomIndex } from './rng';
import { createMemorySessionStore } from './session';
import { syntheticData } from './synthetic-data';

const DT = 0.05;
/** 무한 루프 방지. 정상 세션은 수천 틱이다. */
const MAX_TICKS = 500_000;
/** 무작위 플레이: 틱마다 이 확률로 무작위 구멍을 누른다(초당 약 4번). */
const RANDOM_TAP_PROB = 0.2;
/** 무작위 플레이: 열린 대화마다 틱당 이 확률로 무작위 답을 누른다. 못 누르면 시간초과다. */
const RANDOM_ANSWER_PROB = 0.02;

function perfectBot(bus: EventBus, s: GameState): void {
  for (const d of s.activeDialogues) bus.emit('input/answer', { customerId: d.customerId, choice: 'good' });
  const judge = createDonenessJudge(s.phase === 'tutorial');
  // 튜토리얼은 가장 뒤처진 단계만 유효하다. 다른 단계에서도 같은 규칙으로 움직이면 해가 없다.
  const lowest = Math.min(...s.holes.map((h) => STEP_ORDER.indexOf(h.step)));
  for (const h of s.holes) {
    if (h.step === 'done' || STEP_ORDER.indexOf(h.step) !== lowest) continue;
    if (h.step === 'filling') bus.emit('input/cook', { hole: h.index, step: h.step, ingredient: 'octopus' });
    else if (judge.judge(h.step, h.gauge) === 'perfect') bus.emit('input/cook', { hole: h.index, step: h.step });
  }
}

function randomBot(bus: EventBus, s: GameState, rng: () => number): void {
  for (const d of s.activeDialogues) {
    if (rng() < RANDOM_ANSWER_PROB) {
      bus.emit('input/answer', { customerId: d.customerId, choice: rng() < 0.5 ? 'good' : 'bad' });
    }
  }
  if (rng() >= RANDOM_TAP_PROB) return;
  const h = s.holes[randomIndex(s.holes.length, rng)];
  if (h === undefined) return;
  const ingredient = s.tray[randomIndex(s.tray.length, rng)]?.id;
  bus.emit(
    'input/cook',
    h.step === 'filling' && ingredient !== undefined
      ? { hole: h.index, step: h.step, ingredient }
      : { hole: h.index, step: h.step },
  );
}

function runSession(kind: BalanceScenario['kind'], seed: number): number {
  const bus = createEventBus();
  const game = new Game({ bus, data: syntheticData, rng: createRng(seed), store: createMemorySessionStore() });
  const botRng = createRng(seed ^ 0x9e3779b9);
  for (let i = 0; i < MAX_TICKS && !game.finished; i++) {
    if (kind === 'perfect') perfectBot(bus, game.state);
    else randomBot(bus, game.state, botRng);
    game.tick(DT);
  }
  const avg = game.state.sessionAverage;
  if (!game.finished || avg === null) throw new Error(`세션이 ${MAX_TICKS}틱 안에 끝나지 않았다(${kind}, seed ${seed})`);
  return avg;
}

export const BalanceSimulator: BalanceSimulatorPort = {
  run(scenario) {
    if (!Number.isInteger(scenario.sessions) || scenario.sessions < 1) throw new Error('sessions는 1 이상의 정수');
    let sum = 0;
    for (let i = 0; i < scenario.sessions; i++) sum += runSession(scenario.kind, scenario.seed * 1_000_003 + i);
    return sum / scenario.sessions;
  },
};
