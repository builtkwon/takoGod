// 게임 상태 계약. core가 만들고 render·ui는 읽기만 한다.

import type { FuneItem, HoleStateV2, Ingredient, RollZone } from './cooking';
import type { ActiveDialogue, CustomerStatus } from './customer';
import type { PhaseId, TutorialStage } from './phase';
import type { ReviewResult } from './review';

/**
 * 게임 상태(굽기 조작 개편, GDD §굽기·§손님 대화). V2 접미사를 떼는 이름 변경은 따로 남아 있다.
 * 점수 비공개: 진행 중인 만족도는 담지 않는다. 서빙 뒤 'plate/scored' 이벤트와 reviews(발급된 리뷰)만 점수를 공개한다.
 */
export interface GameStateV2 {
  readonly phase: PhaseId;
  /** 길이 16(4×4). */
  readonly holes: readonly HoleStateV2[];
  /** 트레이 표시 순서. core는 서빙 시점에 즉시 섞는다. 재료를 끌고 있는 중이면 화면 반영을 놓은 뒤로 미루는 것은 ui 책임이다. */
  readonly tray: readonly Ingredient[];
  /** 전역 타이밍 바 위치(0..1). 세션 내내 왕복한다(주기는 GDD §굽기). 굴리기 판정은 탭 순간의 이 값으로 한다. */
  readonly barPosition: number;
  /** 판 공용 영역(GDD §굽기). 그 영역으로 굴릴 수 있는 구멍이 없으면 null. ui는 둘 다 그린다(1·2 표시). */
  readonly barZones: { readonly w1: RollZone | null; readonly w2: RollZone | null };
  /** 후네에 담긴 완성품. 가득 차면 가장 먼저 온 대기 손님에게 서빙된다(GDD §굽기). */
  readonly fune: readonly FuneItem[];
  /** 후네가 6알로 차면 true가 되고 서빙(또는 손님 0명 페이즈의 비우기) 전까지 유지된다. 최소 1초(가쓰오부시 연출)이고 손님이 없으면 입장할 때까지 길어진다(GDD §굽기). render는 가쓰오부시를 얹는다. */
  readonly funeServing: boolean;
  /** 들고 있는 구멍의 인덱스. 없으면 null. 들기는 동시에 1개다. */
  readonly holding: number | null;
  readonly customers: readonly CustomerStatus[];
  readonly activeDialogues: readonly ActiveDialogue[];
  /** 세션에서 받은 리뷰. 세션 점수는 이 목록의 별점 평균으로 계산한다. */
  readonly reviews: readonly ReviewResult[];
  /** reviews 별점의 산술평균. core가 계산한다. 리뷰가 없으면 null. */
  readonly sessionAverage: number | null;
  /** 현재 판 가게 점수(별점과 별개, 상한 없음, 튜토리얼 접시는 0). 접시마다 더한다(GDD §가게 점수). */
  readonly shopScore: number;
  /** 판 시작 때 저장소에서 읽은 최고 가게 점수. 기록이 없으면 null. 진행 중에는 바뀌지 않는다(GDD §제품). */
  readonly bestShopScore: number | null;
  /** 현재 연속 완벽 접시 수(0이면 연속 없음). 완벽이 아닌 접시가 나오면 0으로 돌아간다(GDD §가게 점수). */
  readonly combo: number;
  readonly tutorialCompleted: boolean;
  /** 튜토리얼 중 현재 유도 단계. 튜토리얼이 아니면 null. */
  readonly tutorialStage: TutorialStage | null;
}
