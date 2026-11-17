// bootstrap: 루프·조립. 게임 규칙은 core에 있다. 경계: docs/rules/architecture/modules/contracts.md#bootstrap
import type { GameState, ReviewResult, SessionSnapshot, SessionStore } from './contracts';
import { Game, createEventBus, createRng } from './core';
import { dialogues, reviewComments, tutorialReviewComment } from './data';
import { createRenderer } from './render';
import { mountUi } from './ui';

const SESSION_KEY = 'takoyaki:session'; // ADR 0002
const MAX_DT = 0.1; // core.tick은 프레임 크기 dt를 전제로 한다.

const PERSONALITIES: readonly unknown[] = ['salaryman', 'grandma', 'gourmet', 'tourist'];

/** 신뢰 경계: sessionStorage 값은 외부 입력이다. ReviewResult 필드와 타입이 맞는지 본다. */
function isReview(r: unknown): r is ReviewResult {
  if (typeof r !== 'object' || r === null) return false;
  const v = r as Record<string, unknown>;
  return (
    (v.source === 'tutorial' || v.source === 'customer') &&
    typeof v.stars === 'number' &&
    Number.isFinite(v.stars) &&
    typeof v.comment === 'string' &&
    (v.personality === null || PERSONALITIES.includes(v.personality))
  );
}

/** ADR 0002 형식의 sessionStorage 구현. 읽기·쓰기 실패와 형식 불일치는 "저장값 없음"으로 다룬다. */
function createBrowserSessionStore(): SessionStore {
  return {
    load() {
      try {
        const v: Partial<SessionSnapshot> | null = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
        const ok =
          v !== null &&
          v.version === 1 &&
          typeof v.tutorialCompleted === 'boolean' &&
          typeof v.finished === 'boolean' &&
          Array.isArray(v.reviews) &&
          v.reviews.every(isReview);
        return ok ? (v as SessionSnapshot) : null;
      } catch {
        return null;
      }
    },
    save(s) {
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      } catch {
        // 저장 불가(비공개 모드 등)여도 게임은 계속한다. 새로고침 복원만 못 한다.
      }
    },
  };
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
