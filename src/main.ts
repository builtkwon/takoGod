// bootstrap: 루프·조립·PWA 등록. 게임 규칙은 core에 있다. 경계: docs/rules/architecture/modules/contracts.md#bootstrap
import type { GameState } from './contracts';
import { Game, createEventBus, createRng } from './core';
import { dialogues, reviewComments, tutorialReviewComment } from './data';
import { createRenderer } from './render';
import { createBrowserSessionStore } from './session-store';
import { mountUi } from './ui';

const MAX_DT = 0.1; // core.tick은 프레임 크기 dt를 전제로 한다.

// PWA: 빌드 결과(PROD)에서만 등록한다. 실패해도 게임은 계속한다.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
}

const app = document.getElementById('app');
const stage = document.getElementById('stage');
if (app === null || stage === null) throw new Error('#app, #stage 없음');

const bus = createEventBus();
let game: Game | undefined;
const getState = (): GameState => (game as Game).state; // 첫 호출은 아래 new Game 뒤(UI는 rAF·클릭에서만 읽는다).

// 생성자가 즉시 이벤트를 내므로 UI 구독을 먼저 건다.
const ui = mountUi(app, bus, getState);
game = new Game({
  bus,
  data: {
    dialogues,
    reviewComments: (personality, bucket) => reviewComments[personality][bucket],
    tutorialComment: tutorialReviewComment,
  },
  rng: createRng(Date.now()),
  store: createBrowserSessionStore(),
});
const renderer = createRenderer(stage);

let resultShown = false;
let last = performance.now();
function frame(now: number): void {
  const g = game as Game;
  g.tick(Math.max(0, Math.min(MAX_DT, (now - last) / 1000)));
  last = now;
  const state = g.state;
  renderer.render(state);
  if (g.finished && !resultShown) {
    resultShown = true;
    ui.showResult({ average: state.sessionAverage, reviews: state.reviews });
  }
  requestAnimationFrame(frame);
}

void ui.title().then(() => {
  last = performance.now();
  requestAnimationFrame(frame);
});
