---
name: merge-checklist
version: 1
description: 모듈 작업을 병합하거나 main.ts에서 core·render·ui를 조립할 때 쓴다. 모듈 보고 확인과 밸런스·대사·화면·E2E 검사 뒤 verify-and-report로 이어간다.
requires: []
consumes: []
produces: []
steps:
  S1: { tools: [] }
  S2: { tools: [sim.balance] }
  S3: { tools: [dialogue.lint] }
  S4: { tools: [render.snapshot] }
  S5: { tools: [test.e2e] }
  S6: { tools: [] }
---
## MUST

- 병합 대상마다 완료 보고와 Skill-Receipt가 있어야 한다. 없으면 병합하지 않고 보고한다.
- main.ts에는 루프·조립·PWA만 둔다. 게임 규칙 금지.
- 도구 "대상 없음"(exit 1)은 실패가 아니라 생략으로 적고 출력 원문을 옮긴다.

## 단계

- S1 모듈 보고 확인: 병합할 작업의 완료 보고·영수증·미검증 범위를 읽고, 남은 TODO-CONTRACT 항목을 본다.
  - main.ts 규칙 → docs/rules/architecture/modules/contracts.md#bootstrap
- S2 밸런스: `pnpm tool sim.balance`
- S3 대사: `pnpm tool dialogue.lint`
- S4 화면: `pnpm tool render.snapshot`. 캡처를 열어 조립 후 화면이 깨지지 않았는지 본다.
- S5 E2E: `pnpm tool test.e2e`. planned 상태면 거부 메시지를 옮기고 생략으로 적는다.
- S6 verify-and-report로 이어간다(공통 유틸·빌드·PWA 변경이면 독립 리뷰 조건 해당).
