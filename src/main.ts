// bootstrap: 루프·조립·PWA 등록. 게임 규칙은 core에 있다. 경계: docs/rules/architecture/modules/contracts.md#bootstrap
import type { GameStateV2 } from './contracts';
import { createEventBus, createRng } from './core';
import { GameV2 } from './core/game-v2'; // core/index.ts가 GameV2를 export하지 않아 직접 import한다(후속: core 쪽 export).
import { dialogues, reviewComments, tasteLines, tutorialReviewComment } from './data';
import { createRenderer } from './render';
import { createBrowserSessionStore } from './session-store';
import { mountUiV2 } from './ui';

const MAX_DT = 0.1; // core.tick은 프레임 크기 dt를 전제로 한다.

// PWA: 빌드 결과(PROD)에서만 등록한다. 실패해도 게임은 계속한다.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
}

const app = document.getElementById('app');
const stage = document.getElementById('stage');
if (app === null || stage === null) throw new Error('#app, #stage 없음');

const bus = createEventBus();
let game: GameV2 | undefined;
const getState = (): GameStateV2 => (game as GameV2).state; // 첫 호출은 아래 new GameV2 뒤(UI는 rAF·포인터 이벤트에서만 읽는다).

const renderer = createRenderer(stage);

// 생성자가 즉시 이벤트를 내므로 UI 구독을 먼저 건다. UI는 render의 picker를 받는다.
const ui = mountUiV2(app, bus, getState, renderer.picker);
game = new GameV2({
  bus,
  data: {
    dialogues,
    reviewComments: (personality, bucket) => reviewComments[personality][bucket],
    tutorialComment: tutorialReviewComment,
    tasteLines,
  },
  rng: createRng(Date.now()),
  store: createBrowserSessionStore(),
});

let resultShown = false;
let last = performance.now();
function frame(now: number): void {
  const g = game as GameV2;
  g.tick(Math.max(0, Math.min(MAX_DT, (now - last) / 1000)));
  last = now;
  const state = g.state;
  renderer.renderV2(state, now);
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
