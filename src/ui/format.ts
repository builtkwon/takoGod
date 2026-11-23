import type { IngredientId, Personality, PhaseId } from '../contracts';

export const PERSONALITY_LABEL: Readonly<Record<Personality, string>> = {
  salaryman: '직장인',
  grandma: '할머니',
  gourmet: '미식가',
  tourist: '관광객',
};

export const INGREDIENT_LABEL: Readonly<Record<IngredientId, string>> = {
  octopus: '문어',
  wasabi: '와사비',
  'raw-garlic': '생마늘',
  eraser: '지우개',
  marshmallow: '마시멜로',
  chili: '고추',
};

/** 0.5 단위 별점 표시. 4.5 → "★★★★½" */
export function starsText(stars: number): string {
  const half = Math.round(stars * 2) / 2; // 숫자 표시와 어긋나지 않게 가장 가까운 0.5로
  return '★'.repeat(Math.floor(half)) + (half % 1 ? '½' : '');
}

export function phaseLabel(phase: PhaseId, level: number): string {
  return phase === 'tutorial' ? '튜토리얼' : `${level}단계`;
}

/** 세션 평균 표시 문구. 리뷰가 없어 null이면 표시하지 않는다(null 반환). 계산은 core가 한다. */
export function sessionAverageText(average: number | null): string | null {
  return average === null ? null : averageText(average);
}

/** 표시용 평균. 계산은 core가 하고 ui는 소수 첫째 자리로 보여 주기만 한다. */
export function averageText(average: number): string {
  return Number.isFinite(average) ? average.toFixed(1) : '-'; // 리뷰 0개면 core가 NaN을 줄 수 있다
}
