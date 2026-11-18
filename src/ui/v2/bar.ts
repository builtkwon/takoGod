import type { GameStateV2 } from '../../contracts';

export interface BarView {
  /** 0..100 */
  readonly markerPct: number;
  readonly zone: { readonly leftPct: number; readonly widthPct: number } | null;
  /** 익힘 완료 구멍이 있어 지금 굴릴 수 있다(GDD §굽기: 활성 초록). */
  readonly active: boolean;
}

const clampPct = (v: number): number => (Number.isFinite(v) ? Math.min(100, Math.max(0, v * 100)) : 0);

/** 타이밍 바 표시값. 위치·영역은 core가 정한 대로 그리기만 한다. */
export function barView(state: Pick<GameStateV2, 'barPosition' | 'barZone' | 'holes'>): BarView {
  const z = state.barZone;
  const from = z ? clampPct(z.from) : 0;
  const to = z ? clampPct(z.to) : 0;
  return {
    markerPct: clampPct(state.barPosition),
    zone: z && to > from ? { leftPct: from, widthPct: to - from } : null,
    active: state.holes.some((h) => h.stage === 'cooked'),
  };
}
