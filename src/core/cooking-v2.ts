// 굽기 규칙(개편). 원본: docs/GDD.md §굽기. 옛 cooking.ts는 ui·render 전환 뒤 integrator 병합 때 지운다.
import type { HoleStage, Material, RollZone } from '../contracts';
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

/** 튜토리얼 영역: W1·W2 모두 폭 0.50, 가운데 고정(타이밍 연습). 난수를 쓰지 않는다. */
export const TUTORIAL_ZONE: RollZone = { from: 0.25, to: 0.75 };
/** 영역 전체가 0..1 안에 들도록 시작 위치를 균등하게 뽑는다(난수 1회). */
export function drawZone(width: number, rng: () => number): RollZone {
  const from = rng() * (1 - width);
  return { from, to: from + width };
}

/**
 * 영역 중심이 바 가운데(0.5)에서 minDistance 이상 떨어지도록 뽑는다(난수 1회).
 * 영역 전체가 0..1 안인 중심 범위와 |중심 − 0.5| ≥ minDistance의 교집합에서 균등하다. 거리가 너무 커서 비면 가장자리 끝으로 맞춘다.
 */
export function drawZoneAwayFromCenter(width: number, minDistance: number, rng: () => number): RollZone {
  const half = width / 2;
  const len = Math.max(0, 0.5 - minDistance - half); // 가운데 양쪽 구간 하나의 길이
  const x = rng() * 2 * len;
  const center = x < len ? half + x : 0.5 + minDistance + (x - len);
  const c = len === 0 ? 0.5 + Math.min(minDistance, 0.5 - half) : center;
  return { from: c - half, to: c + half };
}

export const inZone = (pos: number, zone: RollZone): boolean => pos >= zone.from - EPS && pos <= zone.to + EPS;

/** 빈칸에는 마가린, 기름칠에는 반죽, 익힘 완료에는 속재료만 놓을 수 있다. 익힘 중 속재료는 거부(GDD 상태 흐름). */
export function accepts(stage: HoleStage, material: Material): boolean {
  if (stage === 'empty') return material.kind === 'margarine';
  if (stage === 'greased') return material.kind === 'batter';
  if (stage === 'cooked') return material.kind === 'filling';
  return false;
}
