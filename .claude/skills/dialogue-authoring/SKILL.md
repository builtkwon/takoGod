---
name: dialogue-authoring
version: 1
description: 손님 대사·리뷰 코멘트·튜토리얼 문구(src/data)를 쓰거나 고칠 때 쓴다. GDD 콘텐츠 기준으로 작성하고 대사 검사 뒤 verify-and-report로 이어간다.
requires: []
consumes: []
produces: []
steps:
  S1: { tools: [] }
  S2: { tools: [] }
  S3: { tools: [dialogue.lint] }
  S4: { tools: [] }
---
## MUST

- 수량·톤은 GDD §콘텐츠를 따른다. 기준 밖 변경은 먼저 합의한다.
- 대사는 src/data/dialogues.ts에서 named export `dialogues`(`DialogueLine[]`)로 낸다.
- 데이터에 판정·점수 로직을 넣지 않는다.

## 단계

- S1 기준 확인: 작성할 콘텐츠의 수량·톤·성격별 기준을 찾는다.
  - 기준 → docs/GDD.md#콘텐츠, 연결 규약 → docs/rules/architecture/modules/ui.md
- S2 작성: 기준에 맞춰 문구를 쓴다. 리뷰 코멘트(별점 구간별 성격당 3개)와 튜토리얼 문구(안내 9개, 5★ 코멘트 1개)는 dialogue.lint 대상이 아니므로 GDD §콘텐츠 수량과 직접 대조해 보고에 적는다.
- S3 대사 검사: `pnpm tool dialogue.lint`. 대상은 dialogues.ts뿐이다. 문항 수(성격당 10, 총 40), good/bad 길이 차(|good − bad| ≤ 30% × max(good, bad)), 중복, 금지어를 본다. 실패 항목은 고친 뒤 다시.
- S4 verify-and-report로 이어간다.
