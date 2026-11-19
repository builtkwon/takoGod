import type { GameStateV2 } from '../../contracts';

export interface BarView {
  /** 0..100 */
  readonly markerPct: number;
  readonly zone: { readonly leftPct: number; readonly widthPct: number } | null;
  /** 바에 표시된 영역의 구멍이 지금 굴릴 수 있다(barZone이 null이 아님, GDD §굽기: 활성 초록). */
  readonly active: boolean;
  /** 굴리기 1(W1)·2(W2) 구분. 영역이 같은 'rolled' 구멍이 있으면 2, 아니면 1. 영역이 없으면 null. */
  readonly step: 1 | 2 | null;
}

const clampPct = (v: number): number => (Number.isFinite(v) ? Math.min(100, Math.max(0, v * 100)) : 0);

/** 타이밍 바 표시값. 위치·영역은 core가 정한 대로 그리기만 한다. */
export function barView(state: Pick<GameStateV2, 'barPosition' | 'barZone' | 'holes'>): BarView {
  const z = state.barZone;
  const from = z ? clampPct(z.from) : 0;
  const to = z ? clampPct(z.to) : 0;
  const zone = z && to > from ? { leftPct: from, widthPct: to - from } : null;
  const isW2 = z !== null && state.holes.some((h) => h.stage === 'rolled' && h.rollZone?.from === z.from && h.rollZone.to === z.to);
  return {
    markerPct: clampPct(state.barPosition),
    zone,
    active: z !== null,
    step: zone === null ? null : isW2 ? 2 : 1,
  };
}
