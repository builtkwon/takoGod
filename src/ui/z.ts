/** 오버레이 쌓임 순서를 한 곳에 둔다. position:fixed 요소(고스트·판정 글자·이름표·화살표 문구)는 반드시 OVERLAY 아래다(타이틀·결과·카드 위로 뜨지 않게). */
export const Z = { TRAY_LABEL: 5, ARROW_LABEL: 6, FLOAT: 10, SCORE_POP: 12, OVERLAY: 20 } as const;
