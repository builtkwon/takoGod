# 스킬·에이전트 도출

원본: docs/harness-design.md §1, §6, §10.

## 스킬 도출

- 스킬이 된다: 2개 이상 도구를 정해진 순서로 쓰는 절차가 2회 이상 반복된다.
- 스킬이 아니다: 단일 도구 실행. 에이전트 본문에 "검증은 `pnpm tool <id>`"로 적는 것으로 충분하다.
- 스킬이 아니다: 한 번만 쓰는 절차, 미래 기능을 위한 절차(미리 만들지 않는다).
- 같은 단계가 여러 스킬에 중복된다 → 공통 스킬로 뽑고 requires로 연결한다(같은 에이전트 안에서만).

## 그래프 규칙

| 관계 | 규칙 |
| --- | --- |
| agent → skill | agent frontmatter `skills`. 메타 스킬은 넣지 않는다 |
| skill → tool | `steps.Sn.tools`에 toolset ID |
| skill → skill | `requires`. 같은 에이전트에 함께 배치된 스킬만, 최대 2개, 순환 금지 |
| 산출물 | `consumes` 경로는 반드시 어떤 스킬의 `produces`에 있어야 한다 |

위상 정렬: requires가 없는 스킬이 리프다. 리프부터 만든다.

## 산출물 전달

- contract-proposal `produces: [TODO-CONTRACT.md]` → contract-apply `consumes: [TODO-CONTRACT.md]`.
- 경로 문자열이 정확히 같아야 full 검사의 consumes 항목이 통과한다.

## 에이전트 도출

- owns·쓰기 도구가 같은 묶음 = 1 에이전트.
- 읽기 전용 검토는 분리한다(reviewer).
- 기존 에이전트에 도구 추가로 해결되면 새 에이전트를 만들지 않고 추가한다.
- allowed_tools = 배치한 스킬들의 steps 도구 합집합 ∪ 에이전트가 직접 쓰는 단일 도구.
- 소유 경계 변경은 먼저 합의한다 → docs/rules/collaboration/implementation.md

## 초기 배치 기준안

제안표의 출발점이다. 그대로 쓸 의무는 없고, 다르면 제안표에 사유를 적는다.

| 에이전트 | owns | allowed_tools | skills |
| --- | --- | --- | --- |
| core-dev | src/core | test.unit, lint.boundary, sim.balance | verify-and-report, tdd-game-rule, contract-proposal |
| render-dev | src/render | build, render.snapshot, lint.boundary | verify-and-report, visual-check, contract-proposal |
| ui-dev | src/ui, src/data | test.unit, dialogue.lint, build | verify-and-report, dialogue-authoring, contract-proposal |
| integrator | src/main.ts, src/contracts, docs/rules, docs/GDD.md, harness/toolset.yaml | 전체 | verify-and-report, merge-checklist, contract-apply |
| reviewer | 읽기 전용 | test.unit, test.e2e, lint.boundary | independent-review |
| harness-gardener | .claude/**, harness/meta-skills/**, harness/proposals/**, harness/scripts/** | harness.check, harness.index, harness.receipts | (meta) harness-design, harness-compaction |

- integrator의 "전체"는 생성 시점 toolset의 ID를 모두 나열한다(와일드카드 없음).
- reviewer의 test.e2e는 planned다. 배치는 해도 되지만 실행은 거부된다.
- harness-gardener는 부트스트랩 예외로 이미 있다. 다시 만들지 않는다.
- harness-gardener owns는 harness/toolset.yaml을 뺀다(integrator 소유). 원본 배치표의 harness/와 겹침을 푼 것이다.
