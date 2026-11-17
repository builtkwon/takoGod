# ui (`src/ui`, `src/data`)

- 소유: ui-dev
- 역할: DOM 오버레이(`src/ui`)와 대사·리뷰 코멘트·튜토리얼 문구 데이터(`src/data`).
- 계층 규칙: [overview.md](../overview.md#계층)

## 규칙

- 필수: 입력은 contracts의 `input/*` 이벤트로 core에 보낸다. 판정·점수 계산은 하지 않는다.
- 필수: 콘텐츠 수량·톤 기준은 [GDD §콘텐츠](../../../GDD.md#콘텐츠)를 따른다.
- 필수: 도구 연결 — 대사는 `src/data/dialogues.ts`에서 `DialogueLine[]`로 export한다. 모양은 `src/contracts/tooling.ts`의 `DialoguesModule`(named export `dialogues`).
