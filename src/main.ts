// bootstrap: 루프·조립·PWA 등록. 게임 규칙은 core에 있다. 경계: docs/rules/architecture/modules/contracts.md#bootstrap
import { createBrowserBestStore } from './best-store';
import { blockZoom } from './block-zoom';
import type { EventBus, GameStateV2, SessionStore } from './contracts';
import { GameV2, createEventBus, createRng } from './core';
import { dialogues, reviewComments, tasteLines, tutorialReviewComment } from './data';
import { createBrowserProfileStore, withProfile } from './profile-store';
import { createRenderer } from './render';
import { SESSION_KEY, createBrowserSessionStore } from './session-store';
import { mountUiV2 } from './ui';
import { versionLabel } from './version-label';

const MAX_DT = 0.1; // core.tick은 프레임 크기 dt를 전제로 한다.

// PWA: 빌드 결과(PROD)에서만 등록한다. 실패해도 게임은 계속한다.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
}

blockZoom(document);

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
const ui = mountUiV2(app, bus, getState, renderer.picker, { versionLabel: versionLabel(__APP_VERSION__, __APP_COMMIT__), onRestart: restart, onSkipTutorial: skipTutorial });
const profileStore = createBrowserProfileStore();
const sessionStore = withProfile(createBrowserSessionStore(), profileStore);

// GameV2는 해제 API가 없어, 게임이 거는 구독을 모았다가 다시 만들 때 끊는다(이전 인스턴스가 입력에 반응하지 않게). 타이머는 tick뿐이라 남지 않는다.
let offAll: Array<() => void> = [];
const gameBus: EventBus = {
  on(type, handler) {
    const off = bus.on(type, handler);
    offAll.push(off);
    return off;
  },
  emit: (type, payload) => bus.emit(type, payload),
};

function newGame(store: SessionStore): GameV2 {
  offAll.forEach((off) => off());
  offAll = [];
  return new GameV2({
    bus: gameBus,
    data: {
      dialogues,
      reviewComments: (personality, bucket) => reviewComments[personality][bucket],
      tutorialComment: tutorialReviewComment,
      tasteLines,
    },
    rng: createRng(Date.now()),
    store,
    bestStore: createBrowserBestStore(),
  });
}
game = newGame(sessionStore);

let resultShown = false;
let last = performance.now();

// 다시 하기(결과 화면·게임 중 버튼 공용): 세션 저장값을 지우고 새 판. 튜토리얼 완료 기기이므로 withProfile 대체값으로 1단계부터 시작한다(리뷰 0). best·profile은 그대로.
function restart(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // 접근 불가여도 아래 store가 load를 비워 profile 대체값(없으면 튜토리얼)으로 시작한다.
  }
  game = newGame(sessionStore); // 이전 GameV2 구독은 newGame이 해제한다.
  resultShown = false;
  last = performance.now(); // 새 판 첫 프레임의 dt 기준을 지금으로 맞춘다
}
// 튜토리얼 건너뛰기(타이틀 'skip'·튜토리얼 중 공용): 완료로 기록하고 restart와 같이 1단계부터(리뷰 0, 5★ 없음).
function skipTutorial(): void {
  profileStore.markTutorialCompleted();
  restart();
}
function frame(now: number): void {
  const g = game as GameV2;
  // 확인 창이 떠 있는 동안은 tick을 건너뛴다. last는 계속 갱신해, 풀린 첫 프레임에 큰 dt가 들어가지 않게 한다.
  if (!ui.isPaused()) g.tick(Math.max(0, Math.min(MAX_DT, (now - last) / 1000)));
  last = now;
  const state = g.state;
  renderer.renderV2(state, now);
  if (g.finished && !resultShown) {
    resultShown = true;
    void ui.showResult({ average: state.sessionAverage, reviews: state.reviews }).then(restart);
  }
  requestAnimationFrame(frame);
}

void ui.title({ tutorialButton: profileStore.load()?.tutorialCompleted === true }).then((choice) => {
  if (choice === 'skip') skipTutorial();
  else if (choice === 'tutorial') {
    // 튜토리얼부터 다시: 세션 저장값을 지우고 profile 대체 없이 만든다. profile·best는 그대로.
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // 접근 불가여도 아래 store가 load를 비워 튜토리얼부터 시작한다.
    }
    game = newGame({ load: () => null, save: (snap) => sessionStore.save(snap) });
  }
  last = performance.now();
  requestAnimationFrame(frame);
});
