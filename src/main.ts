// bootstrap: 루프·조립·PWA 등록. 게임 규칙은 core에 있다. 경계: docs/rules/architecture/modules/contracts.md#bootstrap
import { createBrowserBestStore } from './best-store';
import type { GameStateV2 } from './contracts';
import { GameV2, createEventBus, createRng } from './core';
import { dialogues, reviewComments, tasteLines, tutorialReviewComment } from './data';
import { createBrowserProfileStore, withProfile } from './profile-store';
import { createRenderer } from './render';
import { createBrowserSessionStore } from './session-store';
import { mountUiV2 } from './ui';
import { versionLabel } from './version-label';

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
// 이펙트 구독도 GameV2 생성 전에 건다(생성자가 이벤트를 낼 수 있다).
bus.on('dialogue/resolved', (e) => renderer.effect(e.outcome === 'good' ? 'firework' : 'confused', e.customerId));
bus.on('customer/fumed', (e) => renderer.effect('fumed', e.customerId));
const ui = mountUiV2(app, bus, getState, renderer.picker, { versionLabel: versionLabel(__APP_VERSION__, __APP_COMMIT__) });
game = new GameV2({
  bus,
  data: {
    dialogues,
    reviewComments: (personality, bucket) => reviewComments[personality][bucket],
    tutorialComment: tutorialReviewComment,
    tasteLines,
  },
  rng: createRng(Date.now()),
  store: withProfile(createBrowserSessionStore(), createBrowserProfileStore()),
  bestStore: createBrowserBestStore(),
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
