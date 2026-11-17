import { describe, expect, it } from 'vitest';
import type { CookStep, IngredientId, Personality } from '../contracts';
import { BALL_UNIT, DISC_UNIT, DOUGH_LOOKS, FILLING_GEO, HOLE_POS, MODEL_OF, doughTint } from './models';
import { MAX_TEX_SIZE, createTextures } from './textures';

const STEPS: CookStep[] = ['margarine', 'batter', 'cook-1', 'filling', 'cook-2', 'roll-1', 'roll-2', 'roll-3', 'done'];
const INGREDIENTS: IngredientId[] = ['octopus', 'wasabi', 'raw-garlic', 'eraser', 'marshmallow', 'chili'];
const PERSONALITIES: Personality[] = ['salaryman', 'grandma', 'gourmet', 'tourist'];

describe('textures', () => {
  const t = createTextures();
  it('모든 텍스처가 64px 이하 정사각형이다(GDD §제품)', () => {
    for (const tex of t.all) {
      const { width, height } = tex.image;
      expect(width).toBeLessThanOrEqual(MAX_TEX_SIZE);
      expect(height).toBe(width);
    }
  });
  it('같은 시드면 같은 픽셀이다(스냅샷 결정성)', () => {
    const again = createTextures();
    expect(Array.from(again.iron.image.data as Uint8Array)).toEqual(Array.from(t.iron.image.data as Uint8Array));
  });
});

describe('models', () => {
  it('굽기 9단계 모두에 외형이 정의돼 있다(빈 구멍 = margarine만 null)', () => {
    expect(STEPS.filter((s) => DOUGH_LOOKS[s] === null)).toEqual(['margarine']);
  });
  it('볼은 roll-1 → done으로 갈수록 커진다', () => {
    const size = (s: CookStep) => {
      const l = DOUGH_LOOKS[s];
      return l === null ? 0 : l.r * l.h;
    };
    expect(size('roll-1')).toBeLessThan(size('roll-2'));
    expect(size('roll-2')).toBeLessThan(size('roll-3'));
    expect(size('roll-3')).toBeLessThan(size('done'));
  });
  it('철판은 6구, 속재료 모델은 6종, 성격 4종 모두 손님 모델이 있다', () => {
    expect(HOLE_POS).toHaveLength(6);
    expect(Object.keys(FILLING_GEO).sort()).toEqual([...INGREDIENTS].sort());
    for (const p of PERSONALITIES) expect(MODEL_OF[p]).toBeDefined();
  });
  it('모든 지오메트리에 버텍스 컬러가 정점 수만큼 있다(셰이더가 읽는다)', () => {
    for (const g of [DISC_UNIT, BALL_UNIT, ...Object.values(FILLING_GEO)]) {
      expect(g.getAttribute('color').count).toBe(g.getAttribute('position').count);
    }
  });
});

describe('doughTint', () => {
  it('익음 게이지가 오를수록 어두워진다(cook 단계)', () => {
    const a = doughTint('cook-1', 0, []);
    const b = doughTint('cook-1', 1, []);
    expect(b[2]).toBeLessThan(a[2]);
  });
  it('게이지 범위 밖(-1, 2)은 0..1로 자른다', () => {
    expect(doughTint('cook-2', 2, [])).toEqual(doughTint('cook-2', 1, []));
    expect(doughTint('cook-2', -1, [])).toEqual(doughTint('cook-2', 0, []));
  });
  it('굴리기 단계는 게이지를 색에 쓰지 않는다(타이밍 값이라 깜빡임 방지)', () => {
    expect(doughTint('roll-2', 0.9, [])).toEqual(doughTint('roll-2', 0, []));
  });
  it('탐 판정이 있으면 어두워지고 덜익음은 그대로다', () => {
    expect(doughTint('done', 0, ['burnt'])[0]).toBeLessThan(doughTint('done', 0, [])[0]);
    expect(doughTint('done', 0, ['under'])).toEqual(doughTint('done', 0, []));
  });
});
