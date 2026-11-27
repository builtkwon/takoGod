// 좁은 화면(칸 폭 < 360)에서 트레이 이름표가 서로 겹치지 않는다.
import { describe, expect, it } from 'vitest';
import type { IngredientId } from '../../../contracts';
import { overlaps, type Rect } from '../../layout';
import { INGREDIENT_LABEL } from '../../format';
import { labelBox, labelStyle, trayLabelPlan } from '../tray-labels';

const ids = Object.keys(INGREDIENT_LABEL) as IngredientId[];
const tray = ids.slice(0, 6).map((id) => ({ id }) as { id: IngredientId });

/** 칸 간격 spacing으로 트레이 앵커를 가진 가짜 picker. */
const pickerOf = (x0: number, spacing: number) => ({ anchor: (t: { kind: string; slot?: number }) => ({ x: x0 + (t.slot ?? 0) * spacing, y: 372 }) }) as never;

const rects = (colW: number, x0: number, spacing: number): Rect[] => {
  const s = labelStyle(colW);
  return trayLabelPlan(tray as never, pickerOf(x0, spacing), colW).flatMap((l) => {
    if (!l) return [];
    const b = labelBox(l.text, s);
    return [{ x: l.at.x - b.w / 2, y: l.at.y - b.h / 2, w: b.w, h: b.h }];
  });
};
const anyOverlap = (rs: Rect[]): boolean => rs.some((a, i) => rs.slice(i + 1).some((b) => overlaps(a, b)));

describe('트레이 이름표 겹침', () => {
  it('320 폭(칸 간격 31)에서 겹치지 않는다', () => {
    expect(anyOverlap(rects(320, 90, 31))).toBe(false);
  });
  it('360 미만이면 글자 10px·간격 18, 이상이면 11px·14(기존)', () => {
    expect(labelStyle(359)).toEqual({ fontPx: 10, staggerY: 18 });
    expect(labelStyle(360)).toEqual({ fontPx: 11, staggerY: 14 });
  });
  it('넓은 화면 위치는 기존과 같다(홀수 칸 +14px)', () => {
    const p = trayLabelPlan(tray as never, pickerOf(120, 45));
    expect(p[0]!.at.y).toBe(402);
    expect(p[1]!.at.y).toBe(416);
  });
});
