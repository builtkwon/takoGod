# 0006 tool.ts 거부 경로 종료코드 줄, harness tsconfig 소유, 링크 정리

## 1. 배경

PM 세션 백로그 우선순위 표 P2 4·5·13(2026-11-18). 0003 리뷰의 선택 개선 백로그를 처리하고, 담당이 없던 `harness/tsconfig.json`에 소유자를 지정한다.

## 2. 툴셋 변화

없음.

## 3. 스킬 표

변경 없음.

## 4. 배치표

| 에이전트 | owns | allowed_tools | skills |
| --- | --- | --- | --- |
| core-dev | src/core/** | test.unit, build, lint.boundary, sim.balance | verify-and-report, tdd-game-rule, contract-proposal |
| render-dev | src/render/** | test.unit, build, lint.boundary, render.snapshot | verify-and-report, ps1-visual-check, contract-proposal |
| ui-dev | src/ui/**, src/data/** | test.unit, build, lint.boundary, dialogue.lint | verify-and-report, dialogue-authoring, contract-proposal |
| integrator | 0005와 같음 | test.unit, test.e2e, build, lint.boundary, render.snapshot, sim.balance, dialogue.lint, harness.check, harness.index, harness.receipts | verify-and-report, merge-checklist, contract-apply |
| reviewer | -(읽기 전용) | test.unit, test.e2e, build, lint.boundary, sim.balance, render.snapshot | independent-review |
| harness-gardener | .claude/**, harness/meta-skills/**, harness/proposals/**, harness/scripts/**, harness/tsconfig.json, .githooks/** | harness.check, harness.index, harness.receipts | (meta) harness-design, harness-compaction |

## 5. 0005 대비 변경

| # | 대상 | 변경 |
| --- | --- | --- |
| 1 | harness-gardener owns | + `harness/tsconfig.json` |
| 2 | harness/scripts/tool.ts | 실행 전 거부 경로(toolset 오류, 사용법, 미등록, planned)도 마지막 줄에 `[tool] <id> exit=<code>` 출력. id가 없으면 `<none>` |
| 3 | tool.test.ts | 거부 경로 마지막 줄, 시그널(status null, `kill -9 $$`), spawn error(환경변수 4MB로 E2BIG) 테스트 추가 |
| 4 | harness-gardener.md 링크 | ai-execution.md → review.md#언제 |
| 5 | 0003 §3 정정 기록 | 아래 정정 참조. 0003 파일은 저장 후 고치지 않는 규칙이라 수정하지 않는다 |

- 0003 §3 정정: independent-review steps를 "S1 -, S2 -, S3 test.unit, S4 lint.boundary"로 적었으나 실제 SKILL.md는 S1~S7이다(S5 test.e2e, S6 -, S7 -). 현행 기준은 SKILL.md다.

## 6. 독립 리뷰

생략. 근거: tool.ts 변경은 출력 한 줄 추가이고 테스트 3건이 경로를 덮는다. 나머지는 소유 경로·링크 표기다. 자체 리뷰와 full 검사로 확인한다.

## 7. 승인

- 승인자: 사용자
- 날짜: 2026-11-18
- 방식: "응 진행해"(백로그 우선순위 표 P2 4·5·13), PM 세션 경유
