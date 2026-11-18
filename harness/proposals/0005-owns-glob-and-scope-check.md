# 0005 integrator owns glob화와 착수 전 범위 확인

## 1. 배경

PM 세션 결정(2026-11-18): src 최상위 파일과 `src/__tests__/` 구조를 glob으로 소유하고, 지시를 받으면 착수 전에 owns와 대조한다. 사후에 owns를 검사하는 스크립트는 만들지 않는다(사용자 지시).

## 2. 툴셋 변화

없음.

## 3. 스킬 표

변경 없음. 스킬 본문에 단위 테스트 위치를 "대상 옆"으로 적은 곳은 grep(옆, `__tests__`, 테스트 위치, `.test.ts`)으로 찾았으나 없어 3번 항목의 치환 대상이 없다. version 변경 없음.

## 4. 배치표

| 에이전트 | owns | allowed_tools | skills |
| --- | --- | --- | --- |
| core-dev | src/core/** | test.unit, build, lint.boundary, sim.balance | verify-and-report, tdd-game-rule, contract-proposal |
| render-dev | src/render/** | test.unit, build, lint.boundary, render.snapshot | verify-and-report, ps1-visual-check, contract-proposal |
| ui-dev | src/ui/**, src/data/** | test.unit, build, lint.boundary, dialogue.lint | verify-and-report, dialogue-authoring, contract-proposal |
| integrator | src/*.ts, src/__tests__/**, src/contracts/**, docs/rules/**, docs/GDD.md, docs/adr/**, harness/toolset.yaml, TODO-CONTRACT.md, README.md, AGENTS.md, package.json, pnpm-lock.yaml, vite.config.ts, tsconfig.json, tsconfig.core.json, .dependency-cruiser.cjs, index.html, .gitignore, CLAUDE.md, playwright.config.ts, e2e/**, public/** | test.unit, test.e2e, build, lint.boundary, render.snapshot, sim.balance, dialogue.lint, harness.check, harness.index, harness.receipts | verify-and-report, merge-checklist, contract-apply |
| reviewer | -(읽기 전용) | test.unit, test.e2e, build, lint.boundary, sim.balance, render.snapshot | independent-review |
| harness-gardener | .claude/**, harness/meta-skills/**, harness/proposals/**, harness/scripts/**, .githooks/** | harness.check, harness.index, harness.receipts | (meta) harness-design, harness-compaction |

## 5. 0004 대비 변경

| # | 대상 | 변경 |
| --- | --- | --- |
| 1 | integrator owns | `src/main.ts`, `src/session-store.ts` → `src/*.ts`, `src/__tests__/**` |
| 2 | core-dev, render-dev, ui-dev, integrator, harness-gardener "## 시작 시" | 4단계 추가: 지시의 대상 파일을 owns와 대조, 범위 밖이면 착수하지 말고 PM에 보고(gardener 외는 contracts·설정이면 contract-proposal) |
| 3 | 스킬 본문의 테스트 위치 문구 | 해당 문구 없음. 변경 없음 |

## 6. 독립 리뷰

생략. 근거: 소유 경로 표기와 시작 절 문구만 바꾸고 스킬·도구·점수·contracts는 바꾸지 않는다. 자체 리뷰와 full 검사로 확인한다.

## 7. 승인

- 승인자: 사용자
- 날짜: 2026-11-18
- 방식: "2. 권장대로 하겠다", "3. 프롬프트를 받아 진행하기 전에 역할 범위를 확인하도록 한다", "__tests__ 구조 권장대로 승인", PM 세션 경유
