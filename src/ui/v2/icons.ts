// 끌기 고스트용 픽셀풍 아이콘. 색·형태는 src/render/models.ts의 3D 모델(읽기 전용 참고)에 맞춘다. 글자 없이 인라인 SVG만 쓴다.
import type { IngredientId } from '../../contracts';
import type { GhostKind, GhostLook } from './controller';

/** [x, y, w, h, fill] 16x16 격자. */
type Px = readonly [number, number, number, number, string];

const BALL = (base: string, hi: string, sauce: string): readonly Px[] => [
  [5, 2, 6, 1, base], [3, 3, 10, 1, base], [2, 4, 12, 8, base], [3, 12, 10, 1, base], [5, 13, 6, 1, base],
  [4, 4, 3, 2, hi], [4, 7, 8, 1, sauce], [6, 9, 6, 1, sauce],
];

const INGREDIENT: Readonly<Record<IngredientId, readonly Px[]>> = {
  octopus: [
    [5, 2, 6, 1, '#d4574b'], [3, 3, 10, 6, '#d4574b'], [4, 9, 8, 1, '#d4574b'], [5, 4, 2, 2, '#f08a7e'],
    [3, 10, 2, 4, '#e9d6cf'], [7, 10, 2, 4, '#e9d6cf'], [11, 10, 2, 4, '#e9d6cf'],
  ],
  wasabi: [[3, 6, 10, 7, '#7bbf3a'], [3, 6, 10, 1, '#a6dc5f'], [6, 3, 5, 3, '#a6dc5f'], [4, 12, 8, 1, '#5c9a28']],
  'raw-garlic': [
    [7, 1, 2, 3, '#d9cfae'], [5, 4, 6, 1, '#f1ead6'], [3, 5, 10, 7, '#f1ead6'], [5, 12, 6, 2, '#f1ead6'], [4, 7, 1, 4, '#d9cfae'], [8, 5, 1, 8, '#d9cfae'],
  ],
  eraser: [[1, 5, 14, 7, '#e8a0b4'], [5, 5, 4, 7, '#3a5ea8'], [1, 5, 14, 1, '#f3c3d0']],
  marshmallow: [[4, 3, 8, 10, '#ffffff'], [3, 4, 10, 8, '#ffffff'], [4, 3, 8, 1, '#e8e8f0'], [4, 12, 8, 1, '#d4d4e0']],
  chili: [
    [1, 4, 2, 2, '#2f8a2a'], [3, 5, 3, 3, '#d8281c'], [5, 6, 4, 3, '#d8281c'], [8, 8, 4, 3, '#d8281c'], [11, 10, 3, 2, '#d8281c'], [14, 12, 1, 1, '#d8281c'], [4, 5, 3, 1, '#f26a5c'],
  ],
};

const OTHER: Readonly<Record<Exclude<GhostKind, 'filling'>, readonly Px[]>> = {
  margarine: [[2, 5, 12, 7, '#f2d56b'], [2, 5, 12, 2, '#fff0a0'], [2, 11, 12, 1, '#c9a93a']],
  batter: [[3, 3, 10, 2, '#a8743c'], [2, 5, 12, 8, '#e9dfc0'], [4, 6, 3, 1, '#fffbe6'], [2, 12, 12, 1, '#c9bd98']],
  done: BALL('#d9993a', '#f0c070', '#6a3a14'),
  dark: BALL('#7a4a1a', '#9a6a3a', '#3a1c08'),
  burnt: BALL('#1a1a1a', '#3a3a3a', '#000000'),
};

export const LOOK_ARIA: Readonly<Record<Exclude<GhostKind, 'filling'>, string>> = {
  margarine: '버터', batter: '반죽', done: '완성품', dark: '어두운 완성품', burnt: '탄 완성품',
};

export function iconPixels(look: GhostLook): readonly Px[] {
  return look.kind === 'filling' ? (look.ingredient ? INGREDIENT[look.ingredient] : []) : OTHER[look.kind];
}

/** 고정 문자열로만 조립한다(사용자 입력 없음): innerHTML에 넣어도 안전하다. */
export function iconSvg(look: GhostLook): string {
  const rects = iconPixels(look).map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('');
  return `<svg viewBox="0 0 16 16" width="40" height="40" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}
