import { describe, expect, it } from 'vitest';
import type { HoleStage, IngredientId, Personality } from '../../contracts';
import { BALL_UNIT, DISC_UNIT, DOUGH_LOOKS, FILLING_GEO, FUNE_SLOTS, HOLE_POS, MODEL_OF, bakeTint } from '../models';
import { MAX_TEX_SIZE, createTextures } from '../textures';

const STAGES: HoleStage[] = ['empty', 'greased', 'cooking', 'cooked', 'filled', 'rolled', 'done', 'dark', 'burnt'];
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
    expect(Array.from(again.wood.image.data as Uint8Array)).toEqual(Array.from(t.wood.image.data as Uint8Array));
  });
});

describe('models', () => {
  it('구멍 9단계 모두에 외형이 정의돼 있다(빈칸만 null)', () => {
    expect(Object.keys(DOUGH_LOOKS).sort()).toEqual([...STAGES].sort());
    expect(STAGES.filter((s) => DOUGH_LOOKS[s] === null)).toEqual(['empty']);
  });
  it('볼은 굴림 1 → 완성으로 갈수록 커진다', () => {
    const size = (s: HoleStage) => {
      const l = DOUGH_LOOKS[s];
      return l === null ? 0 : l.r * l.h;
    };
    expect(size('rolled')).toBeLessThan(size('done'));
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

describe('굽기 색 단계·후네', () => {
  const lum = (t: readonly [number, number, number]) => t[0] + t[1] + t[2];

  it('색조는 보통 > 어두움 > 탄 것 순으로 어두워진다', () => {
    expect(lum(bakeTint('normal'))).toBeGreaterThan(lum(bakeTint('dark')));
    expect(lum(bakeTint('dark'))).toBeGreaterThan(lum(bakeTint('burnt')));
  });

  it('후네 슬롯은 6개이고 2줄 x 3개다', () => {
    expect(FUNE_SLOTS).toHaveLength(6);
    expect(new Set(FUNE_SLOTS.map((s) => s[2])).size).toBe(2);
    expect(new Set(FUNE_SLOTS.map((s) => s[0])).size).toBe(3);
  });
});
