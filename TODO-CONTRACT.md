# TODO-CONTRACT

구현 세션이 `src/contracts` 변경을 제안하는 곳이다. 구현 세션은 contracts를 직접 고치지 않고 아래 양식으로 항목을 추가한다. integrator가 사용자 합의 후 반영하고 항목을 지운다. 절차: [docs/rules/architecture/modules/contracts.md](docs/rules/architecture/modules/contracts.md)

## 양식

```md
### <짧은 제목>

- 제안: <바꿀 타입·이벤트와 변경 내용>
- 이유: <왜 필요한지, 현재 contracts로 안 되는 점>
- 영향 모듈: <core / render / ui / data / main 중 해당>
```

## core-dev

<!-- end:core-dev -->

## render-dev

<!-- end:render-dev -->

## ui-dev

### 리뷰 코멘트·튜토리얼 데이터 모듈 모양

- 제안: `src/contracts/tooling.ts`에 `src/data/review-comments.ts`의 모양을 추가한다. `ReviewCommentsModule { reviewComments: Readonly<Record<Personality, Readonly<Record<1 | 2 | 3 | 4 | 5, readonly string[]>>>>; tutorialReviewComment: string }`. 현재 data 구현은 구간당 `readonly [string, string, string]` 튜플이라 이 타입에 대입된다. `TOOL_ENTRY_PATHS`에 `reviewComments: 'src/data/review-comments.ts'` 추가 여부도 함께 결정한다.
- 이유: core는 data를 import할 수 없어 `ReviewResult.comment`를 만들려면 main이 코멘트를 주입해야 한다. 그 주입 타입이 contracts에 없다. data는 임시 타입 없이 구조만 맞춰 export했다.
- 영향 모듈: core / data / main

<!-- end:ui-dev -->
