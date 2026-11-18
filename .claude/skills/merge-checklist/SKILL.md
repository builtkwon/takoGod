---
name: merge-checklist
version: 2
description: 모듈 작업을 병합하거나 main.ts에서 core·render·ui를 조립할 때 쓴다. 모듈 보고 확인과 밸런스·대사·화면·E2E 검사, README 최신화, 병합 후 브랜치 정리 뒤 verify-and-report로 이어간다.
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
  S7: { tools: [] }
  S8: { tools: [] }
---
## MUST

- 병합 대상마다 완료 보고와 Skill-Receipt가 있어야 한다. 없으면 병합하지 않고 보고한다.
- main.ts에는 루프·조립·PWA만 둔다. 게임 규칙 금지.
- 병합 전에 README를 최신화한다(S6). 병합 뒤에는 병합한 브랜치를 정리한다(S7) → docs/rules/collaboration/implementation.md#병합
- 도구 "대상 없음"(exit 1)은 실패가 아니라 생략으로 적고 출력 원문을 옮긴다.

## 단계

- S1 모듈 보고 확인: 병합할 작업의 완료 보고·영수증·미검증 범위를 읽고, 남은 TODO-CONTRACT 항목을 본다.
  - main.ts 규칙 → docs/rules/architecture/modules/contracts.md#bootstrap
- S2 밸런스: `pnpm tool sim.balance`
- S3 대사: `pnpm tool dialogue.lint`
- S4 화면: `pnpm tool render.snapshot`. 캡처를 열어 조립 후 화면이 깨지지 않았는지 본다.
- S5 E2E: `pnpm tool test.e2e`. planned 상태면 거부 메시지를 옮기고 생략으로 적는다.
- S6 README 최신화(병합 전): 바뀐 내용을 README에 반영해 main에 커밋한다(커밋 승인은 commits.md). 바뀐 것이 없으면 병합 커밋 본문에 "README 확인, 변경 없음"을 쓴다.
- S7 브랜치 정리(병합 후): 병합한 브랜치를 로컬에서 `git branch -d`로 지운다. 원격 삭제는 push 권한이 없으므로 PM에게 요청한다고 보고에 쓴다.
- S8 verify-and-report로 이어간다(공통 유틸·빌드·PWA 변경이면 독립 리뷰 조건 해당).
