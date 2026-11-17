# 0002 소유자 지정

## 1. 배경

0001 독립 리뷰의 합의 필요 지적: "미배치 경로: 없음"이 사실과 달랐다. 어느 owns에도 없는 추적 파일(빌드·PWA 설정, 경계 규칙, 훅 등)에 소유자를 지정한다. 범위는 소유자 지정뿐이다.

## 2. 툴셋 변화

없음(version 2 유지).

## 3. 스킬 표

| 스킬 | 언제 | requires | consumes | produces | steps 도구 |
| --- | --- | --- | --- | --- | --- |
| contract-proposal(v1 → v2) | 필요한 contracts 타입·이벤트가 없을 때, 또는 owns 밖 파일(설정 포함) 변경이 필요할 때 | - | - | TODO-CONTRACT.md | S1 -, S2 -, S3 - (변경 없음) |

- 사유: 구현 에이전트(core/render/ui-dev) 본문에 "owns 밖 파일 변경이 필요하면 TODO-CONTRACT 자기 섹션에 제안만" 규칙이 없다(본문은 "읽기만, 먼저 합의"뿐). 그래서 contract-proposal의 적용 범위를 넓힌다. S1 확인 대상도 같이 넓히므로 version을 올린다.

## 4. 배치표

| 에이전트 | owns | allowed_tools | skills |
| --- | --- | --- | --- |
| core-dev | src/core/** | test.unit, build, lint.boundary, sim.balance | verify-and-report, tdd-game-rule, contract-proposal |
| render-dev | src/render/** | test.unit, build, lint.boundary, render.snapshot | verify-and-report, ps1-visual-check, contract-proposal |
| ui-dev | src/ui/**, src/data/** | test.unit, build, lint.boundary, dialogue.lint | verify-and-report, dialogue-authoring, contract-proposal |
| integrator | src/main.ts, src/contracts/**, docs/rules/**, docs/GDD.md, docs/adr/**, harness/toolset.yaml, TODO-CONTRACT.md, README.md, AGENTS.md, package.json, pnpm-lock.yaml, vite.config.ts, tsconfig.json, tsconfig.core.json, .dependency-cruiser.cjs, index.html, .gitignore, CLAUDE.md | test.unit, test.e2e, build, lint.boundary, render.snapshot, sim.balance, dialogue.lint, harness.check, harness.index, harness.receipts | verify-and-report, merge-checklist, contract-apply |
| reviewer | -(읽기 전용) | test.unit, test.e2e, lint.boundary | independent-review |
| harness-gardener | .claude/**, harness/meta-skills/**, harness/proposals/**, harness/scripts/**, .githooks/** | harness.check, harness.index, harness.receipts | (meta) harness-design, harness-compaction |

## 5. 0001 대비 변경

| 대상 | 0001 | 0002 | 사유 |
| --- | --- | --- | --- |
| integrator owns | 9개 경로 | + package.json, pnpm-lock.yaml, vite.config.ts, tsconfig.json, tsconfig.core.json, .dependency-cruiser.cjs, index.html, .gitignore, CLAUDE.md | 빌드·PWA·경계 설정과 진입 파일의 소유자 지정 |
| harness-gardener owns | 4개 경로 | + .githooks/** | pre-commit 훅은 하네스 검사 실행 경로 |
| contract-proposal | v1, contracts 부족만 | v2, owns 밖 파일 변경 제안 포함 | 구현 에이전트 본문에 해당 규칙 없음 |

## 6. 독립 리뷰

생략. 근거: 소유권 표기와 스킬 1개의 적용 범위만 바꾸고 점수·contracts·빌드 설정 내용은 바꾸지 않는다. 자체 리뷰와 full 검사로 확인한다.

## 7. 후속(integrator 작업, 이번 범위 밖)

- docs/rules/architecture/modules/harness.md `## 소유` 표에 `.githooks/**`(harness-gardener)와 integrator 추가 경로를 반영한다. docs/rules는 integrator 소유라 gardener가 고치지 않는다.

## 8. 승인

- 승인자: 사용자
- 날짜: 2026-11-17
- 방식: 사전 지시("S4 제안표가 지시 표와 같으면 승인된 것으로 본다")
