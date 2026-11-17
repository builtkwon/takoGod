---
name: harness-design
version: 1
description: 툴셋·스킬·에이전트를 추가·변경·제거할 때 쓴다. 제안표 승인 후 리프→루트 순으로 생성하고 INDEX 재생성·전체 검사까지 마친다.
requires: []
consumes: []
produces: [harness/proposals/]
steps:
  S1: { tools: [] }
  S2: { tools: [] }
  S3: { tools: [] }
  S4: { tools: [] }
  S5: { tools: [] }
  S6: { tools: [] }
  S7: { tools: [harness.index] }
  S8: { tools: [harness.check] }
  S9: { tools: [] }
---
## MUST

- 사용자가 제안표를 승인하기 전에는 스킬·에이전트 파일을 만들거나 고치지 않는다.
- 생성은 리프 → 루트 순서: 스킬(위상 정렬) → 에이전트 → INDEX → 전체 검사.
- 참조는 agent → skill → tool 단방향. requires는 같은 에이전트 안에서만, 최대 2개.
- 도구는 toolset ID로만 참조하고 `pnpm tool <id>`로만 호출한다.
- 전체 검사 실패 수정은 3회까지(자체+독립 합산). 넘으면 중단하고 보고한다.

## 단계

- S1 toolset 확인: `harness/toolset.yaml`의 version 증가 여부와 추가·제거된 ID를 적는다.
  - 제거된 ID가 있다 → references/change-propagation.md
  - toolset.yaml 변경 자체가 필요하다 → 직접 고치지 않고 제안표에 integrator 작업으로 올린다.
- S2 스킬 후보 도출: requires·consumes/produces 그래프를 그리고 순환을 없앤다.
  - 스킬이 되는 조건·안 되는 조건 → references/derivation.md
  - 산출물 전달(contract-proposal → contract-apply 등) → references/derivation.md#산출물-전달
- S3 에이전트 경계: owns·쓰기 도구가 같은 묶음을 1 에이전트로 하고 확정 스킬만 배치한다. allowed_tools는 배치 스킬 도구의 합집합.
  - 기준안(초기 배치표) → references/derivation.md#초기-배치-기준안
- S4 제안표 작성 → references/proposal-format.md. 사용자 승인 후 `harness/proposals/NNNN-주제.md`로 저장한다.
  - 승인 전 수정 요청 → 같은 번호로 고쳐 다시 승인받는다.
- S5 스킬 생성: 위상 정렬 순(requires가 없는 리프부터). 이 단계에서는 format 훅만 동작한다.
  - frontmatter·본문 규칙과 상한 → references/schema.md#스킬
  - 훅이 exit 2로 막았다 → 사유대로 고친 뒤 같은 파일을 다시 쓴다.
- S6 에이전트 생성: S5에서 만든 스킬만 참조한다.
  - frontmatter·본문 구성 → references/schema.md#에이전트
- S7 INDEX 재생성: `pnpm tool harness.index`. INDEX.md는 직접 고치지 않는다.
- S8 전체 검사: `pnpm tool harness.check -- --full --no-write`.
  - FAIL → 수정 후 S7부터 다시(MUST의 3회 한도).
  - WARN(고아·승인안 diff) → 완료 보고에 그대로 적는다. 의도한 차이면 사유를 붙인다.
- S9 커밋 제안: 변경·검증 결과·제안 메시지를 보이고 승인받는다 → docs/rules/collaboration/commits.md
  - 완료 보고에 영수증 줄을 쓴다 → references/schema.md#영수증
