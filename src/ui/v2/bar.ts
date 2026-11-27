import type { GameStateV2, RollZone } from '../../contracts';

export interface ZoneView {
  readonly leftPct: number;
  readonly widthPct: number;
}

export interface BarView {
  /** 0..100 */
  readonly markerPct: number;
  /** 모든 단계 공통 영역 하나(barZones.w1). 굴릴 구멍이 없으면 null. barZones.w2·shared는 무시한다. */
  readonly zone: ZoneView | null;
}

const clampPct = (v: number): number => (Number.isFinite(v) ? Math.min(100, Math.max(0, v * 100)) : 0);

function zoneView(z: RollZone | null): ZoneView | null {
  if (!z) return null;
  const from = clampPct(z.from);
  const to = clampPct(z.to);
  return to > from ? { leftPct: from, widthPct: to - from } : null;
}

/** 타이밍 바 표시값. 위치·영역은 core가 정한 대로 그리기만 한다. */
export function barView(state: Pick<GameStateV2, 'barPosition' | 'barZones'>): BarView {
  return { markerPct: clampPct(state.barPosition), zone: zoneView(state.barZones.w1) };
}
