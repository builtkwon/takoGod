import type { GameStateV2, IngredientId, ScenePicker, TutorialStage } from '../../contracts';
import type { Pt } from './controller';

export interface ArrowGeometry {
  readonly x: number;
  readonly y: number;
  readonly length: number;
  /** 도(deg). 오른쪽이 0. */
  readonly angle: number;
}

export function arrowGeometry(from: Pt, to: Pt): ArrowGeometry {
  return { x: from.x, y: from.y, length: Math.hypot(to.x - from.x, to.y - from.y), angle: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI };
}

/** 각 튜토리얼 단계에서 조작할 구멍의 상태. 이 상태인 첫 구멍을 가리킨다(열린 6구 모두 같은 조작, 잠긴 구멍은 건너뜀: GDD §진행 튜토리얼). */
const HOLE_STAGE: Readonly<Record<TutorialStage, string | null>> = {
  margarine: 'empty',
  batter: 'greased',
  'cook-wait': null,
  filling: 'cooked',
  'roll-1': 'filled',
  'roll-2': 'rolled',
  fune: 'done',
};

/** 탭 화살표가 위에서 내려오는 길이(CSS px). */
const TAP_REACH = 70;

/**
 * 단계의 화살표 시작점→목적지. 가리킬 곳이 없으면 null.
 * 시작점: 마가린·반죽은 통, 속재료는 문어 칸, 탭은 구멍 위, 접시 담기는 완성 구멍.
 */
export function tutorialArrow(
  stage: TutorialStage,
  state: Pick<GameStateV2, 'holes' | 'tray'>,
  picker: ScenePicker,
  buckets: { readonly margarine: () => Pt | null; readonly batter: () => Pt | null },
): { readonly from: Pt; readonly to: Pt } | null {
  const want = HOLE_STAGE[stage];
  const hole = want ? state.holes.find((h) => !h.locked && h.stage === want) : undefined;
  const holePt = hole ? picker.anchor({ kind: 'hole', index: hole.index }) : null;
  if (!holePt) return null;
  let from: Pt | null = null;
  if (stage === 'margarine') from = buckets.margarine();
  else if (stage === 'batter') from = buckets.batter();
  else if (stage === 'filling') {
    const slot = state.tray.findIndex((t) => t.id === 'octopus');
    from = slot < 0 ? null : picker.anchor({ kind: 'tray', slot });
  } else if (stage === 'fune') {
    const to = picker.anchor({ kind: 'fune' });
    return to ? { from: holePt, to } : null;
  } else from = { x: holePt.x, y: holePt.y - TAP_REACH };
  return from ? { from, to: holePt } : null;
}

/**
 * 속재료 단계의 탭 안내(GDD §튜토리얼, 탭 방식): 아직 문어를 고르지 않았으면 문어 칸, 골랐으면 넣을 구멍(익힘 완료) 위에 '탭'을 표시한다.
 * 끌어 놓기도 동작하지만 가르치지 않는다. 가리킬 곳이 없으면 null.
 */
export function tutorialTap(
  state: Pick<GameStateV2, 'holes' | 'tray'>,
  picker: ScenePicker,
  selected: IngredientId | null,
): { readonly at: Pt; readonly target: 'tray' | 'hole' } | null {
  if (selected !== 'octopus') {
    const slot = state.tray.findIndex((t) => t.id === 'octopus');
    const at = slot < 0 ? null : picker.anchor({ kind: 'tray', slot });
    return at ? { at, target: 'tray' } : null;
  }
  const hole = state.holes.find((h) => !h.locked && h.stage === 'cooked');
  const at = hole ? picker.anchor({ kind: 'hole', index: hole.index }) : null;
  return at ? { at, target: 'hole' } : null;
}
