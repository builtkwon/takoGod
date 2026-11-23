// HUD·점수 표시 문구. 표시 형식만 정하고 점수 계산은 하지 않는다. 기준: docs/GDD.md §제품(HUD 배치), §가게 점수
export const hudText = {
  /** 왼쪽 위 최고 가게 점수. 기록이 없으면 "최고 -". */
  best: (best: number | null): string => `최고 ${best === null ? '-' : best}`,
  newBadge: 'NEW',
  reviews: (n: number): string => `리뷰 ${n}`,
  /** 접시를 더한 직후 "+N". */
  plateGain: (points: number): string => `+${points}`,
  /** 콤보 2 이상일 때만 "콤보 ×1.2". 아니면 null. */
  combo: (combo: number, multiplier: number): string | null => (combo >= 2 ? `콤보 ×${multiplier.toFixed(1)}` : null),
  /** 화난 손님 수. 한도는 core가 정한 값(GameStateV2.fumedLimit)을 받아 쓴다. */
  fumed: (count: number, limit: number): string => `😠 ${count}/${limit}`,
  /** 판이 끝나는 길은 패배(화난 손님 한도) 하나뿐이라 결과 화면 제목은 항상 이것이다(새로고침 복원 포함). */
  resultTitle: '영업 종료',
  resultShopScore: (score: number): string => `가게 점수 ${score}`,
  resultNewBest: '최고 기록!',
} as const;
