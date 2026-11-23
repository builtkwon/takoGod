import type { GameStateV2, RollZone } from '../../contracts';

export interface ZoneView {
  readonly leftPct: number;
  readonly widthPct: number;
}

export interface BarView {
  /** 0..100 */
  readonly markerPct: number;
  /** 판 공용 영역 둘(GDD §굽기). 그 영역으로 굴릴 구멍이 없으면 null. */
  readonly w1: ZoneView | null;
  readonly w2: ZoneView | null;
  /** true면 영역 하나(w1)를 굴리기 1·2가 함께 쓴다: 번호 없이 그린다(GDD §굽기). */
  readonly shared: boolean;
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
  return { markerPct: clampPct(state.barPosition), w1: zoneView(state.barZones.w1), w2: zoneView(state.barZones.w2), shared: state.barZones.shared };
}
