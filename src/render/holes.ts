// V2 구멍·손님 표시 규칙(순수 함수). 규칙의 원본은 GDD §굽기(구멍 테두리)·§손님 대화(얼굴 단계)이고 여기는 그리기 매핑만 둔다.
import type { HoleStateV2, PatienceLevel } from '../contracts';
import { bakeTint } from './models';
import type { V3 } from './layout';

/** 익힘 시간(초). GDD §굽기(반죽을 놓으면 3초 뒤 익힘 완료). 색 진행률 계산에만 쓴다. */
export const COOK_SEC = 3;

/** 구멍 반죽 색조(곱셈). 익힘 중엔 경과로 점점 익고, 어두움·탄 것은 색 단계를 쓴다. */
export function holeTint(h: HoleStateV2): V3 {
  switch (h.stage) {
    case 'cooking': {
      const k = Math.min(h.cookElapsedSec / COOK_SEC, 1);
      return [1 - 0.15 * k, 1 - 0.38 * k, 1 - 0.6 * k];
    }
    case 'cooked':
      return [0.92, 0.8, 0.62];
    case 'dark':
      return bakeTint('dark');
    case 'burnt':
      return bakeTint('burnt');
    default:
      return [1, 1, 1];
  }
}

/** 구멍에 속재료 모델이 보이는가: 속재료 후(반죽 위에 올라간 상태)만. */
export const showsFilling = (h: HoleStateV2): boolean => h.stage === 'filled' && h.filling !== null;

/** "속 없음" 표시: 속 없음으로 굴려진 뒤의 단계에만 보인다(그 전에는 noFilling이 설 수 없다). */
export const showsNoFilling = (h: HoleStateV2): boolean => h.noFilling && (h.stage === 'rolled' || h.stage === 'done' || h.stage === 'dark' || h.stage === 'burnt');

export type RimName = 'cooked' | 'done' | 'dark';
/** GDD §굽기 구멍 테두리: 익힘 완료 초록, 완성 흰색, 어두워짐 주황. 그 밖의 단계는 없음. */
export const RIM_COLOR: Readonly<Record<RimName, V3>> = { cooked: [0.25, 1, 0.3], done: [1, 1, 1], dark: [1, 0.55, 0.1] };

export const rimOf = (h: HoleStateV2): RimName | null => (h.stage === 'cooked' || h.stage === 'done' || h.stage === 'dark' ? h.stage : null);

/** 깜빡임 반주기(ms). */
export const BLINK_MS = 250;

/** 테두리를 이 순간에 그리는가. warn이면 반주기마다 켜짐·꺼짐을 번갈아 한다. */
export function rimVisible(h: HoleStateV2, nowMs: number): boolean {
  return rimOf(h) !== null && (!h.warn || Math.floor(nowMs / BLINK_MS) % 2 === 0);
}

/** 인내 단계별 얼굴 색조(머리 메시에 곱한다): 기본 → 주황 → 빨강. */
export const FACE_TINT: Readonly<Record<PatienceLevel, V3>> = { normal: [1, 1, 1], annoyed: [1, 0.6, 0.3], angry: [1, 0.3, 0.25] };
