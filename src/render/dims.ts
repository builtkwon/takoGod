/** 화면 비율(가로:세로 = 3:4, 세로 화면). 렌더 해상도는 CSS 크기 x pixelRatio로 정한다(ADR 0002 초안). */
export const VIEW_ASPECT = 3 / 4;
/** 고해상도 화면에서도 렌더 버퍼 배율은 이 값으로 상한을 둔다(모바일 성능). */
export const MAX_PIXEL_RATIO = 2;
