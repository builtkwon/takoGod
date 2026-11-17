---
name: harness-compaction
version: 2
description: 스킬·references가 상한에 근접·초과했거나, 오래 쓰지 않은 단계·중복 단계를 정리할 때 쓴다. 제안표 승인 후 반영하고 INDEX 재생성·전체 검사까지 마친다.
requires: []
consumes: []
produces: [harness/proposals/]
steps:
  S1: { tools: [harness.check] }
  S2: { tools: [harness.receipts] }
  S3: { tools: [] }
  S4: { tools: [] }
  S5: { tools: [harness.index] }
  S6: { tools: [harness.check] }
  S7: { tools: [] }
---
## MUST

- 사용자가 제안표를 승인하기 전에는 스킬·에이전트를 고치거나 지우지 않는다.
- 정리는 동작을 바꾸지 않는다. 단계·MUST가 바뀌면 그 스킬 version을 올린다.
- 삭제는 후보로만 올린다. 근거(영수증·검사 결과) 없는 삭제 제안 금지.
- 도구는 toolset ID로만 참조하고 `pnpm tool <id>`로만 호출한다.
- 전체 검사 실패 수정은 3회까지. 넘으면 중단하고 보고한다.

## 단계

- S1 현황: `pnpm tool harness.check -- --summary --read-only`로 상한 80% 근접 파일과 스킬 수를 본다.
- S2 후보 수집: `pnpm tool harness.receipts`로 6주 영수증(커밋 트레일러)을 집계하고 네 종류로 분류한다.
  - 상한 근접·초과 → references/criteria.md#분할
  - 단계 안의 상세·예외·예시 → references/criteria.md#references-이동
  - 6주 이상 영수증에 없는 단계·스킬 → references/criteria.md#미사용-삭제-후보
  - 여러 스킬의 같은 단계 → references/criteria.md#공통-스킬-추출
- S3 제안표 작성 → harness/meta-skills/harness-design/references/proposal-format.md. 승인 후 `harness/proposals/NNNN-compaction.md`로 저장한다.
- S4 반영: 승인된 항목만. 분할·추출로 생긴 스킬은 리프부터 만들고, 에이전트 skills와 requires를 함께 고친다.
  - 스키마·상한 → harness/meta-skills/harness-design/references/schema.md
- S5 INDEX 재생성: `pnpm tool harness.index`.
- S6 전체 검사: `pnpm tool harness.check -- --full --no-write`. FAIL → 수정 후 S5부터 다시. WARN은 보고에 적는다.
- S7 커밋 제안: 변경·검증 결과·제안 메시지를 보이고 승인받는다 → docs/rules/collaboration/commits.md
