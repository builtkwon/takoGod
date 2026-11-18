# 0004 소유 경로 추가와 커밋 승인 문구 정렬

## 1. 배경

PM 세션 결정 표(2026-11-18) 1·2번. E2E·PWA 자산·세션 저장소 파일에 소유자가 없고, 에이전트 본문의 커밋 승인 문구가 "사용자 승인"과 "PM 승인"으로 갈린다.

## 2. 툴셋 변화

없음(toolset.yaml 미변경).

## 3. 스킬 표

변경 없음.

## 4. 배치표

| 에이전트 | owns | allowed_tools | skills |
| --- | --- | --- | --- |
| core-dev | src/core/** | test.unit, build, lint.boundary, sim.balance | verify-and-report, tdd-game-rule, contract-proposal |
| render-dev | src/render/** | test.unit, build, lint.boundary, render.snapshot | verify-and-report, ps1-visual-check, contract-proposal |
| ui-dev | src/ui/**, src/data/** | test.unit, build, lint.boundary, dialogue.lint | verify-and-report, dialogue-authoring, contract-proposal |
| integrator | 0003과 같음 + playwright.config.ts, e2e/**, public/**, src/session-store.ts | test.unit, test.e2e, build, lint.boundary, render.snapshot, sim.balance, dialogue.lint, harness.check, harness.index, harness.receipts | verify-and-report, merge-checklist, contract-apply |
| reviewer | -(읽기 전용) | test.unit, test.e2e, build, lint.boundary, sim.balance, render.snapshot | independent-review |
| harness-gardener | .claude/**, harness/meta-skills/**, harness/proposals/**, harness/scripts/**, .githooks/** | harness.check, harness.index, harness.receipts | (meta) harness-design, harness-compaction |

## 5. 0003 대비 변경

| # | 대상 | 변경 |
| --- | --- | --- |
| 1 | integrator owns | + `playwright.config.ts`, `e2e/**`, `public/**`, `src/session-store.ts` |
| 2 | core-dev, render-dev, ui-dev, integrator 본문 | "PM 소통" 절의 커밋 줄을 "커밋은 PM 승인(사용자 위임 범위) 후 진행한다 → docs/rules/collaboration/commits.md"로, 완료 보고의 "사용자 승인 후"를 "PM 승인(사용자 위임 범위) 후"로 바꾼다 |

- 2의 근거 문서: commits.md에 같은 뜻의 위임 줄이 필요하다. docs/rules는 integrator 소유라 integrator 작업이다(§7).

## 6. 독립 리뷰

생략. 근거: 소유 경로 표기와 문구 정렬만 바꾸고 스킬·도구·점수·contracts는 바꾸지 않는다. 자체 리뷰와 full 검사로 확인한다.

## 7. 후속

- integrator가 commits.md에 PM 승인(사용자 위임 범위) 위임 줄을 넣는다.
- integrator가 E2E 작성 후 toolset.yaml에서 test.e2e를 active로 바꾸면, gardener가 version과 INDEX에 전파한다.
- 0003 리뷰의 선택 개선 4건은 백로그: tool.ts 거부 경로의 `[tool]` 줄, error·signal 테스트, harness-gardener.md의 ai-execution 링크, 0003 §3 steps 표기.

## 8. 승인

- 승인자: 사용자
- 날짜: 2026-11-18
- 방식: PM 세션 결정 표 "1, 2 권장안대로 승인", PM 세션 경유
