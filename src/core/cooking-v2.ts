// 굽기 규칙(개편). 원본: docs/GDD.md §굽기. 옛 cooking.ts는 ui·render 전환 뒤 integrator 병합 때 지운다.
import type { HoleStage, Material, PhaseId, RollZone } from '../contracts';
import { EPS } from './cooking';

/** 철판은 4×4 16구(index = 행*4 + 열). */
export const HOLE_COUNT = 16;
/** 튜토리얼에서 쓰는 6구(가운데 2열 × 위 3행). 나머지는 잠근다(GDD §튜토리얼). */
export const TUTORIAL_HOLES: readonly number[] = [1, 2, 5, 6, 9, 10];
/** 후네가 차서 가쓰오부시 연출 뒤 서빙(또는 비우기)까지 기다리는 시간. */
export const FUNE_SERVE_DELAY_SEC = 1;
/** 후네 1척 = 접시 1개 = 완성품 6개. */
export const FUNE_SIZE = 6;
/** 반죽을 놓은 뒤 익힘 완료까지. */
export const COOK_SEC = 3;
/** 완성부터 누적한 탐 타이머: 4초에 어두워지고 6초에 탄다. */
export const DARK_AT_SEC = 4;
export const BURN_AT_SEC = 6;

/** 영역 폭(바 전체 길이 1 기준). W2는 시작값이고 sim.balance 측정 뒤 조정한다(GDD §굽기). 튜토리얼은 전 구간이다. */
export const FULL_ZONE: RollZone = { from: 0, to: 1 };
export function zoneWidths(phase: PhaseId): { readonly w1: number; readonly w2: number } {
  return phase === 'P1' || phase === 'P2' ? { w1: 0.3, w2: 0.24 } : { w1: 0.24, w2: 0.2 };
}
/** 영역 전체가 0..1 안에 들도록 시작 위치를 균등하게 뽑는다(난수 1회). */
export const drawZone = (width: number, rng: () => number): RollZone => {
  const from = rng() * (1 - width);
  return { from, to: from + width };
};

export const inZone = (pos: number, zone: RollZone): boolean => pos >= zone.from - EPS && pos <= zone.to + EPS;

/** 빈칸에는 마가린, 기름칠에는 반죽, 익힘 완료에는 속재료만 놓을 수 있다. 익힘 중 속재료는 거부(GDD 상태 흐름). */
export function accepts(stage: HoleStage, material: Material): boolean {
  if (stage === 'empty') return material.kind === 'margarine';
  if (stage === 'greased') return material.kind === 'batter';
  if (stage === 'cooked') return material.kind === 'filling';
  return false;
}
