// 굽기 규칙(개편). 원본: docs/GDD.md §굽기. 옛 cooking.ts는 ui·render 전환 뒤 integrator 병합 때 지운다.
import type { HoleStage, Material, RollZone } from '../contracts';
import { EPS } from './cooking';

export const HOLE_COUNT = 6;
/** 후네 1척 = 접시 1개 = 완성품 6개. */
export const FUNE_SIZE = 6;
/** 반죽을 놓은 뒤 익힘 완료까지. */
export const COOK_SEC = 3;
/** 완성부터 누적한 탐 타이머: 3초에 어두워지고 5초에 탄다. */
export const DARK_AT_SEC = 3;
export const BURN_AT_SEC = 5;

/** 타이밍 바 영역(가운데 정렬). W2는 시작값이고 sim.balance 측정 뒤 조정한다(GDD §굽기). */
export const W1: RollZone = { from: 0.4, to: 0.6 };
export const W2: RollZone = { from: 0.42, to: 0.58 };
/** 튜토리얼은 바 전 구간 성공이다. */
export const FULL_ZONE: RollZone = { from: 0, to: 1 };

export const inZone = (pos: number, zone: RollZone): boolean => pos >= zone.from - EPS && pos <= zone.to + EPS;

/** 빈칸에는 마가린, 기름칠에는 반죽, 익힘 완료에는 속재료만 놓을 수 있다. 익힘 중 속재료는 거부(GDD 상태 흐름). */
export function accepts(stage: HoleStage, material: Material): boolean {
  if (stage === 'empty') return material.kind === 'margarine';
  if (stage === 'greased') return material.kind === 'batter';
  if (stage === 'cooked') return material.kind === 'filling';
  return false;
}
