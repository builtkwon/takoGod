---
name: verify-and-report
version: 1
description: 구현을 마친 뒤 단위 테스트·빌드·경계 검사로 검증하고 완료 보고와 Skill-Receipt 영수증을 쓸 때 쓴다. 다른 스킬의 마지막 단계에서 이어 실행한다.
requires: []
consumes: []
produces: []
steps:
  S1: { tools: [test.unit] }
  S2: { tools: [build] }
  S3: { tools: [lint.boundary] }
  S4: { tools: [] }
  S5: { tools: [] }
---
## MUST

- S1~S3은 실제로 실행하고 종료코드와 FAIL 원문을 보고에 옮긴다. 실행하지 않은 단계는 완료로 쓰지 않는다.
- 실패 수정은 작업 범위당 3회까지(자체+독립 리뷰 합산). 넘으면 중단하고 보고한다.
- 독립 리뷰는 docs/rules/collaboration/review.md#언제 조건에 해당할 때만 요청한다. 필요 여부와 근거를 한 줄로 쓴다.
- 검증하지 못했으면 "구현 완료, 검증 미완료"로 보고한다.
- 완료 보고의 영수증 줄과 커밋 트레일러는 같은 내용이다.

## 단계

- S1 단위 테스트: `pnpm tool test.unit`
- S2 빌드·타입 검사(core DOM 금지 포함): `pnpm tool build`
- S3 모듈 경계: `pnpm tool lint.boundary`
  - S1~S3 실패 → 고친 뒤 S1부터 다시. 대상 없음·생략 사유 → references/report.md#생략
- S4 독립 리뷰 판정: review.md#언제 조건(점수·별점·평균, contracts, sessionStorage, 공통 유틸·빌드·PWA)에 해당할 때만 reviewer에 요청한다.
  - 요청 시 전달물 → references/report.md#독립-리뷰-요청
- S5 완료 보고: 변경 / 실제 실행한 도구·결과 / 미검증 범위 / 영수증.
  - 형식과 Skill-Receipt 트레일러 → references/report.md#완료-보고
  - 커밋은 제안만 하고 승인 후 진행 → docs/rules/collaboration/commits.md
