# 0003 PM 지휘 체계 반영

## 1. 배경

역할별 대화형 세션(tako-core, tako-render, tako-ui; `claude --agent <역할>`)을 PM 세션이 SendMessage로 지휘한다. integrator는 main 폴더에서 PM이 `claude -p --resume`으로 실행한다. 리뷰 규칙 원본은 docs/rules/collaboration/review.md(커밋 2f78ded)로 옮겨졌다.

## 2. 툴셋 변화

없음(version 유지, toolset.yaml 미변경).

## 3. 스킬 표

| 스킬 | 언제 | requires | consumes | produces | steps 도구 |
| --- | --- | --- | --- | --- | --- |
| independent-review(v1 → v2) | 독립 리뷰를 요청받았을 때 | - | - | - | S1 -, S2 -, S3 test.unit, S4 lint.boundary (변경 없음) |
| verify-and-report(v1 유지) | 구현 후 검증·완료 보고 | - | - | - | 변경 없음(references 링크만 교체) |

- independent-review: checklist에 "보고된 도구 중 allowed_tools에 있는 것은 재실행해 종료코드를 확인한다" 추가, 원본 링크를 review.md로 교체.

## 4. 배치표

| 에이전트 | owns | allowed_tools | skills |
| --- | --- | --- | --- |
| core-dev | src/core/** | test.unit, build, lint.boundary, sim.balance | verify-and-report, tdd-game-rule, contract-proposal |
| render-dev | src/render/** | test.unit, build, lint.boundary, render.snapshot | verify-and-report, ps1-visual-check, contract-proposal |
| ui-dev | src/ui/**, src/data/** | test.unit, build, lint.boundary, dialogue.lint | verify-and-report, dialogue-authoring, contract-proposal |
| integrator | 0002와 같음 | test.unit, test.e2e, build, lint.boundary, render.snapshot, sim.balance, dialogue.lint, harness.check, harness.index, harness.receipts | verify-and-report, merge-checklist, contract-apply |
| reviewer | -(읽기 전용) | test.unit, test.e2e, build, lint.boundary, sim.balance, render.snapshot | independent-review |
| harness-gardener | .claude/**, harness/meta-skills/**, harness/proposals/**, harness/scripts/**, .githooks/** | harness.check, harness.index, harness.receipts | (meta) harness-design, harness-compaction |

## 5. 0002 대비 변경

| # | 대상 | 변경 |
| --- | --- | --- |
| 1 | core-dev, render-dev, ui-dev, integrator 본문 | "## PM 소통" 절 추가(5줄) |
| 2 | 같은 에이전트의 독립 리뷰 링크 | ai-execution.md → review.md#언제 |
| 3 | reviewer allowed_tools | + build, sim.balance, render.snapshot(재실행 확인용). tools·읽기 전용 유지 |
| 4 | independent-review checklist.md, verify-and-report report.md | 원본 링크를 review.md로. checklist에 재실행 확인 1줄. independent-review v2 |
| 5 | harness/scripts/tool.ts | 실행 끝 마지막 줄 `[tool] <id> exit=<code>` 출력 후 그 코드로 종료. 단위 테스트 추가 |
| 6 | core-dev, render-dev, ui-dev, integrator frontmatter `tools:` | + SendMessage. reviewer·harness-gardener는 그대로 |
| 7 | verify-and-report/SKILL.md 19·29행 | ai-execution.md 링크 → review.md#언제. 링크만 바뀌고 단계·MUST 의미는 같아 v1 유지 |

## 6. 독립 리뷰

필요. 근거: 공통 스킬(independent-review)과 모든 구현 에이전트 본문, 도구 실행기(tool.ts)를 함께 바꾼다. PM이 reviewer에 요청한다.

## 7. 승인

- 승인자: 사용자
- 날짜: 2026-11-17
- 방식: 사전 지시("S4 제안표가 지시 표와 같으면 승인된 것으로 본다", 결정 C)
- 6·7행 추가: 2026-11-18 사용자 승인("ㅇㅋ 진행해"), PM 세션 경유
