# contracts (`src/contracts`) · bootstrap (`src/*.ts`)

- 소유: integrator. 그 외 세션은 읽기 전용.
- 계층 규칙: [overview.md](../overview.md#계층)

## contracts

| 파일 | 내용 |
| --- | --- |
| `cooking.ts` | CookStep, Ingredient, Doneness, DonenessJudge, HoleState(옛 흐름, deprecated), HoleStage, HoleStateV2, Material, RollZone, FuneItem, DropTarget, RejectReason |
| `customer.ts` | Personality, DialogueLine, Customer(deprecated), CustomerStatus, PatienceLevel, PlateDefect, TasteKind, TasteLines, ActiveDialogue |
| `phase.ts` | PhaseId, PhaseConfig, TutorialStep(deprecated), TutorialStage, TutorialStepV2 |
| `review.ts` | ReviewResult |
| `game-state.ts` | GameState(deprecated), GameStateV2 |
| `scene.ts` | PickTarget, ScenePicker(장면 좌표 판정 포트. render 구현, ui 사용) |
| `session.ts` | SessionSnapshot, SessionStore(세션 저장 포트) |
| `events.ts` | GameEvents(이벤트 목록), EventBus |
| `tooling.ts` | 도구 연결 규약: BalanceSimulator, SimModule, SandboxStates, DialoguesModule, TOOL_ENTRY_PATHS |

- 필수: 모듈 간 타입·이벤트는 여기에만 정의한다.
- 금지: 구현 코드. 허용: 경로 같은 상수.
- 변경 절차: 구현 세션이 [TODO-CONTRACT.md](../../../../TODO-CONTRACT.md)에 제안 → integrator가 사용자 합의 후 반영. contracts 변경은 독립 리뷰 대상이다([review.md](../../collaboration/review.md#언제)).

## bootstrap

- `src/*.ts`: 진입점 `main.ts`는 게임 루프(`tick(dt)` 호출), core·render·ui 조립, PWA 등록. 브라우저 어댑터(`session-store.ts` 등)는 contracts 포트를 구현한다. 테스트는 `src/__tests__/`.
- ScenePicker(`scene.ts`)는 render가 구현하고 ui가 받는다. render가 어디에 노출하고 ui가 어디로 받는지는 contracts에 적지 않고 main.ts 조립 시 연결한다.
- ScenePicker는 main.ts가 render에서 받아 mountUi에 넘긴다.
- 금지: 게임 규칙 구현.
