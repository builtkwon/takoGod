# 0009 툰 셰이딩 전환: ps1-visual-check를 visual-check로

## 1. 배경

사용자 승인(2026-11-20, PM 전달): 렌더를 PS1에서 툰 셰이딩으로 바꾼다(ADR이 0001을 대체, 문서는 integrator). 하네스의 PS1 전제를 툰 기준으로 고친다. 승인을 받았으므로 제안표 작성과 적용을 한 작업에서 한다.

## 2. 툴셋 변화

없음.

## 3. 스킬 표

| 스킬 | 언제 | requires | consumes | produces | steps 도구 |
| --- | --- | --- | --- | --- | --- |
| visual-check(ps1-visual-check v1에서 이름 변경, v1) | render의 툰 셰이딩 시각 요소를 바꿀 때 | - | - | - | S1 -, S2 -, S3 render.snapshot, S4 -, S5 - |

- 이름을 바꿔도 기존 영수증 `ps1-visual-check@v1`은 harness.receipts가 형식만 검사하므로 오류가 아니다(확인함).
- MUST에 툰 기준(셀 3단, 외곽선 2px 일정, 평면 색, 64px 이하 절차 텍스처, 외부 에셋 금지) 추가.

## 4. 배치표

| 에이전트 | owns | allowed_tools | skills |
| --- | --- | --- | --- |
| core-dev | src/core/** | test.unit, build, lint.boundary, sim.balance | verify-and-report, tdd-game-rule, contract-proposal |
| render-dev | src/render/** | test.unit, build, lint.boundary, render.snapshot | verify-and-report, visual-check, contract-proposal |
| ui-dev | src/ui/**, src/data/** | test.unit, build, lint.boundary, dialogue.lint | verify-and-report, dialogue-authoring, contract-proposal |
| integrator | 0008과 같음 | 0008과 같음 | verify-and-report, merge-checklist, contract-apply |
| reviewer | -(읽기 전용) | test.unit, test.e2e, build, lint.boundary, sim.balance, render.snapshot | independent-review |
| harness-gardener | 0008과 같음 | harness.check, harness.index, harness.receipts | (meta) harness-design, harness-compaction |

## 5. 변경

| # | 대상 | 변경 |
| --- | --- | --- |
| 1 | .claude/skills/ps1-visual-check → visual-check | 폴더·name 변경, 본문을 툰 기준으로 |
| 2 | .claude/agents/render-dev.md | description 툰 셰이딩·ADR 0003, skills·조건표의 스킬명 |
| 3 | harness/meta-skills/harness-design/references/derivation.md | 예시 배치의 스킬명 |
| 4 | .claude/skills/INDEX.md | 재생성 |

## 6. 후속

- integrator: README.md:97의 `ps1-visual-check`를 `visual-check`로, README.md:60 "Three.js PS1 렌더링"을 툰 셰이딩 문구로, AGENTS.md:10의 ADR 0001 링크를 새 ADR로.
- ADR 번호: docs/adr/0002는 이미 session-storage다. 새 ADR 번호는 integrator가 정하고, 정해지면 render-dev.md description의 "ADR 0002"와 맞춘다. 스킬 본문은 번호 없이 docs/adr/를 가리킨다.

## 7. 독립 리뷰

생략. 근거: 이름·문구 교체이고 도구·contracts는 바뀌지 않는다. full 검사로 확인한다.

## 8. 승인

- 승인자: 사용자
- 날짜: 2026-11-20
- 방식: 툰 전환 승인(PM 세션 경유)
