// 장면 좌표 판정 포트. 원본: docs/GDD.md §굽기 조작(끌어 놓기·구멍 탭)
// render가 구현하고 ui가 쓴다. 연결은 main.ts 조립 시 한다(ToonRenderer 확장 위치·mountUi 인자는 여기에 적지 않는다).

/**
 * 화면의 3D 장면에서 ui가 조작 대상으로 삼는 것.
 * 마가린 통·반죽 주전자는 ui DOM이라 여기에 없다.
 */
export type PickTarget =
  /** 철판 구멍. index는 HoleStateV2.index(0..15)와 같다. */
  | { readonly kind: 'hole'; readonly index: number }
  /** 속재료 트레이 칸. slot은 GameStateV2.tray의 표시 순서 인덱스와 같은 기준이다. */
  | { readonly kind: 'tray'; readonly slot: number }
  /** 후네. */
  | { readonly kind: 'fune' }
  /**
   * 손님 머리 위. anchor 전용이고 pick은 이 값을 돌려주지 않는다.
   * 이유: ui가 주문·빼 주세요·단체·VIP 아이콘을 DOM으로 그 좌표에 붙이는데, 손님 자리 매핑은 render만 안다.
   * 해당 손님이 없으면 anchor는 null이다.
   */
  | { readonly kind: 'customer'; readonly customerId: string };

/**
 * 화면 좌표 ↔ 장면 대상. render가 광선 판정으로 구현한다.
 * 판정 규칙(거부·담김·떨어짐)은 포함하지 않는다: ui는 포인터 좌표만 넘기고 결과는 core가 정한다.
 * 놓은 곳이 후네 밖인지는 pick 결과가 'fune'이 아닌 것(null 포함)이면 ui가 DropTarget 'other'로 보낸다.
 */
export interface ScenePicker {
  /** 뷰포트 기준 CSS 픽셀 좌표(clientX, clientY)에 있는 대상. 없으면 null. */
  pick(clientX: number, clientY: number): PickTarget | null;
  /** 대상의 화면 위치(뷰포트 기준 CSS 픽셀). 화면에 없거나 존재하지 않는 대상(예: 재료가 없는 트레이 칸)이면 null. */
  anchor(target: PickTarget): { readonly x: number; readonly y: number } | null;
}
