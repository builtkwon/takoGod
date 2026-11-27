import type { EventBus, GameStateV2 } from '../../contracts';
import { hudText } from '../../data';
import { el } from '../dom';
import { PERSONALITY_LABEL, phaseLabel, sessionAverageText } from '../format';
import { setStarRow, starRow, starsLabel } from './stars';

export interface HudV2 {
  readonly root: HTMLElement;
  update(state: GameStateV2): void;
  /** 판이 바뀔 때 떠 있는 "+N" 점수 팝업을 지운다. */
  reset(): void;
}

export interface HudView {
  readonly best: string;
  /** 현재 가게 점수가 저장된 최고 기록을 넘었다(기록이 없으면 0 초과). */
  readonly isNew: boolean;
  readonly phase: string;
  readonly score: string;
  readonly reviews: string;
  /** 화난 손님 표시 문구와 0명 여부(0이면 흐리게). */
  readonly fumed: string;
  readonly fumedCount: number;
  /** 튜토리얼에서는 화난 손님 표시를 숨긴다(GDD §진행). */
  readonly fumedHidden: boolean;
  /** 게임 중 다시 하기 버튼은 본게임에서만 보인다(튜토리얼 제외). */
  readonly restartVisible: boolean;
  /** 튜토리얼에서는 같은 자리에 건너뛰기 버튼이 보인다. */
  readonly skipVisible: boolean;
}

/** HUD 표시값. 점수 비교만 하고 계산은 core가 한다. */
export function hudView(state: Pick<GameStateV2, 'phase' | 'level' | 'shopScore' | 'bestShopScore' | 'reviews' | 'fumedCount' | 'fumedLimit'>): HudView {
  return {
    best: hudText.best(state.bestShopScore),
    isNew: state.shopScore > (state.bestShopScore ?? 0),
    phase: phaseLabel(state.phase, state.level),
    score: String(state.shopScore),
    reviews: hudText.reviews(state.reviews.length),
    fumed: hudText.fumed(state.fumedCount, state.fumedLimit),
    fumedCount: state.fumedCount,
    fumedHidden: state.phase === 'tutorial',
    restartVisible: state.phase !== 'tutorial',
    skipVisible: state.phase === 'tutorial',
  };
}

const POP_MS = 1300;

/**
 * 상단 HUD: 왼쪽 최고 가게 점수(+NEW), 가운데 단계와 현재 가게 점수, 오른쪽 별 칸과 작은 리뷰 수.
 * 진행 중인 만족도는 표시하지 않는다(GDD §손님 대화 점수 비공개). score/plate 때 가운데 점수 아래에 "+N"(콤보 2 이상이면 배수)을 잠깐 띄운다.
 */
export function createHudV2(bus: EventBus, disposers: (() => void)[], onRestartClick?: () => void, onSkipClick?: () => void): HudV2 {
  const root = el('div', 'ui-hud2 ui-hit');
  const best = el('span', 'ui-hud-best');
  const newBadge = el('span', 'ui-hud-new', hudText.newBadge);
  newBadge.hidden = true;
  const bestRow = el('div', 'ui-hud-best-row');
  bestRow.append(best, newBadge);
  const fumed = el('div', 'ui-hud-fumed');
  // 게임 중 다시 하기: 최고 기록 줄 아래, 화난 손님 옆. 보이는 크기는 작지만 터치 영역은 ::after로 44px 이상이다.
  const restart = el('button', 'ui-hud-restart', hudText.restartButton);
  restart.hidden = true;
  if (onRestartClick) restart.addEventListener('click', onRestartClick);
  // 튜토리얼 중 건너뛰기: 다시 하기와 같은 자리·모양.
  const skip = el('button', 'ui-hud-restart', hudText.skipButton);
  skip.hidden = true;
  if (onSkipClick) skip.addEventListener('click', onSkipClick);
  const subRow = el('div', 'ui-hud-sub-row');
  subRow.append(fumed, restart, skip);
  const left = el('div', 'ui-hud-left');
  left.append(bestRow, subRow);
  const phase = el('div', 'ui-hud-phase');
  const score = el('div', 'ui-hud-score');
  const center = el('div', 'ui-hud-center');
  center.append(phase, score);
  const average = starRow(0);
  average.hidden = true;
  const reviews = el('div', 'ui-hud-reviews');
  const right = el('div', 'ui-hud-right');
  right.append(average, reviews);
  const row = el('div', 'ui-hud-row');
  row.append(left, center, right);
  const customers = el('div', 'ui-faces');
  root.append(row, customers);

  let pop: HTMLElement | null = null;
  let popTimer: ReturnType<typeof setTimeout> | undefined;
  const clearPop = (): void => {
    clearTimeout(popTimer);
    pop?.remove();
    pop = null;
  };
  disposers.push(
    bus.on('score/plate', ({ points, combo, multiplier }) => {
      clearPop();
      pop = el('div', 'ui-score-pop');
      pop.append(el('b', '', hudText.plateGain(points)));
      const c = hudText.combo(combo, multiplier);
      if (c !== null) pop.append(el('span', 'ui-score-combo', c));
      center.append(pop);
      popTimer = setTimeout(clearPop, POP_MS);
    }),
    clearPop,
  );

  let facesKey = '';
  let lastScore = '';
  let lastFumed = -1;
  return {
    root,
    reset: clearPop,
    update(state) {
      const v = hudView(state);
      best.textContent = v.best;
      newBadge.hidden = !v.isNew;
      phase.textContent = v.phase;
      if (v.score !== lastScore) {
        if (lastScore !== '') {
          score.classList.remove('ui-bump');
          void score.offsetWidth; // 애니메이션 재시작
          score.classList.add('ui-bump');
        }
        lastScore = v.score;
        score.textContent = v.score;
      }
      reviews.textContent = v.reviews;
      restart.hidden = !onRestartClick || !v.restartVisible;
      skip.hidden = !onSkipClick || !v.skipVisible;
      fumed.hidden = v.fumedHidden;
      fumed.textContent = v.fumed;
      fumed.classList.toggle('ui-dim', v.fumedCount === 0);
      if (v.fumedCount > lastFumed && lastFumed >= 0) {
        fumed.classList.remove('ui-shake-s');
        void fumed.offsetWidth; // 애니메이션 재시작
        fumed.classList.add('ui-shake-s');
      }
      lastFumed = v.fumedCount;
      average.hidden = sessionAverageText(state.sessionAverage) === null;
      if (state.sessionAverage !== null) setStarRow(average, state.sessionAverage, `평균 ${starsLabel(state.sessionAverage)}`);
      const key = state.customers.map((c) => `${c.id}:${c.face}:${c.awaitingRedo}`).join();
      if (key === facesKey) return;
      facesKey = key;
      customers.replaceChildren(
        ...state.customers.map((c) => el('span', `ui-face ui-face-${c.face}`, `${PERSONALITY_LABEL[c.personality]}${c.awaitingRedo ? ' · 다시' : ''}`)),
      );
    },
  };
}
