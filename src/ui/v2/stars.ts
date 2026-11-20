import { el } from '../dom';

export type StarFill = 'full' | 'half' | 'empty';

/** 별 5칸의 채움. 0.5 단위 반 칸(가장 가까운 0.5로 맞춘다), 범위 밖·NaN은 0~5로 자른다. */
export function starFills(value: number): StarFill[] {
  const v = Number.isFinite(value) ? Math.min(5, Math.max(0, Math.round(value * 2) / 2)) : 0;
  return Array.from({ length: 5 }, (_, i) => (v >= i + 1 ? 'full' : v >= i + 0.5 ? 'half' : 'empty'));
}

/** 접근성용 문구. 숫자 별점은 화면 대신 여기에 남긴다. */
export const starsLabel = (value: number): string => `별점 ${Number.isFinite(value) ? value.toFixed(1) : '-'}점`;

/** 별 5칸. 숫자 텍스트 대신 쓴다. 칸 안의 글자는 장식이고 값은 aria-label로 읽힌다. */
export function starRow(value: number, label = starsLabel(value)): HTMLElement {
  const row = el('span', 'ui-star-row');
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', label);
  for (const fill of starFills(value)) {
    const s = el('span', 'ui-star', '★');
    s.dataset.fill = fill;
    s.setAttribute('aria-hidden', 'true');
    row.append(s);
  }
  return row;
}

/** 이미 있는 별 칸의 값만 바꾼다(HUD 매 프레임 갱신용). */
export function setStarRow(row: HTMLElement, value: number, label: string): void {
  row.setAttribute('aria-label', label);
  starFills(value).forEach((f, i) => {
    const s = row.children[i];
    if (s instanceof HTMLElement && s.dataset.fill !== f) s.dataset.fill = f;
  });
}
