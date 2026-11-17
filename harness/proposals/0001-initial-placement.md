# 0001 초기 배치

## 1. 배경

하네스 인프라(toolset, 검사·도구 스크립트, 메타 스킬, harness-gardener, 훅)만 있고 일반 스킬·에이전트는 0개다. docs/harness-design.md §6 초기 배치를 기준안으로 첫 생성을 한다.

## 2. 툴셋 변화

- toolset `version` 2(HEAD와 같음). v1 → v2에서 `harness.receipts` 추가. 제거된 ID 없음.
- planned: `test.e2e`. toolset 변경 필요 없음.

## 3. 스킬 표

requires는 모두 `[]`(전부 리프). verify-and-report는 선행 스킬이 아니라, 다른 스킬의 마지막 단계에서 이어 실행하는 후속 스킬이다.

| 스킬 | 언제 | requires | consumes | produces | steps 도구 |
| --- | --- | --- | --- | --- | --- |
| verify-and-report | 구현 후 검증·완료 보고 | - | - | - | S1 test.unit, S2 build, S3 lint.boundary, S4 -(ai-execution.md 조건에 해당할 때만 독립 리뷰 요청), S5 -(완료 보고·영수증) |
| contract-proposal | 필요한 contracts 타입·이벤트가 없을 때 | - | - | TODO-CONTRACT.md | S1 -(부족 확인), S2 -(자기 역할 섹션 안에 양식 추가), S3 -(보고) |
| independent-review | 독립 리뷰를 요청받았을 때 | - | - | - | S1 -(요청·diff·보고 읽기), S2 -(영수증·도구 로그 대조), S3 test.unit, S4 lint.boundary, S5 test.e2e, S6 -(체크 5항목), S7 -(지적 분류 보고) |
| tdd-game-rule | core 게임 규칙·수치 구현 | - | - | - | S1 -(GDD 수치), S2 test.unit(red), S3 test.unit(green), S4 sim.balance, S5 -(verify-and-report로 이어간다) |
| ps1-visual-check | render 시각 변경 | - | - | - | S1 -(GDD §제품·ADR 0001), S2 -(sandbox 상태 추가), S3 render.snapshot, S4 -(캡처 대조), S5 -(verify-and-report로 이어간다) |
| dialogue-authoring | 대사·리뷰 코멘트·튜토리얼 문구 작성 | - | - | - | S1 -(GDD §콘텐츠), S2 -(작성), S3 dialogue.lint, S4 -(verify-and-report로 이어간다) |
| contract-apply | TODO-CONTRACT 항목 반영 | - | TODO-CONTRACT.md | - | S1 -(항목·영향 모듈), S2 -(사용자 합의), S3 -(contracts 반영), S4 -(반영 항목 삭제, 섹션·끝 표시 줄 유지), S5 -(verify-and-report로 이어간다) |
| merge-checklist | 모듈 작업 병합·main.ts 조립 | - | - | - | S1 -(모듈 완료 보고·영수증 확인), S2 sim.balance, S3 dialogue.lint, S4 render.snapshot, S5 test.e2e, S6 -(verify-and-report로 이어간다) |

references:

| 파일 | 내용 | Skill-Receipt 트레일러 형식 |
| --- | --- | --- |
| verify-and-report/references/report.md | 완료 보고 4항목, skip 사유, "대상 없음" exit 1 처리 | 포함(commits.md#스킬-영수증 링크 + 형식 줄) |
| independent-review/references/checklist.md | 체크 5항목, 지적 분류, 영수증 대조 방법 | 미포함(대조 기준으로 report.md 링크) |

## 4. 배치표

| 에이전트 | owns | allowed_tools | skills |
| --- | --- | --- | --- |
| core-dev | src/core/** | test.unit, build, lint.boundary, sim.balance | verify-and-report, tdd-game-rule, contract-proposal |
| render-dev | src/render/** | test.unit, build, lint.boundary, render.snapshot | verify-and-report, ps1-visual-check, contract-proposal |
| ui-dev | src/ui/**, src/data/** | test.unit, build, lint.boundary, dialogue.lint | verify-and-report, dialogue-authoring, contract-proposal |
| integrator | src/main.ts, src/contracts/**, docs/rules/**, docs/GDD.md, docs/adr/**, harness/toolset.yaml, TODO-CONTRACT.md, README.md, AGENTS.md | test.unit, test.e2e, build, lint.boundary, render.snapshot, sim.balance, dialogue.lint, harness.check, harness.index, harness.receipts | verify-and-report, merge-checklist, contract-apply |
| reviewer | -(읽기 전용, tools: Read, Grep, Glob, Bash) | test.unit, test.e2e, lint.boundary | independent-review |
| harness-gardener | .claude/**, harness/meta-skills/**, harness/proposals/**, harness/scripts/** | harness.check, harness.index, harness.receipts | (meta) harness-design, harness-compaction |

미배치 경로: 없음.

### TODO-CONTRACT.md 규칙

- owns는 integrator 하나다.
- 구현 세션(core-dev, render-dev, ui-dev)은 자기 `## <역할>` 섹션 안, `<!-- end:<역할> -->` 줄 바로 위에만 항목을 추가한다. 다른 곳은 고치지 않는다(병렬 worktree 머지 충돌 방지). contract-proposal MUST에 명시한다.
- 1회 예외: 이번 실행에서 harness-gardener가 섹션 골격(`## core-dev` / `## render-dev` / `## ui-dev`와 각 끝 표시 줄)을 만든다. gardener owns 밖이지만 이 제안표 승인으로 1회만 허용한다. 기존 `## 제안` 섹션을 골격으로 바꾸고 `## 양식`은 유지한다.

## 5. 기준안(§6)과 다른 점

| 대상 | 기준안 | 제안 | 사유 |
| --- | --- | --- | --- |
| core-dev allowed_tools | test.unit, lint.boundary, sim.balance | + build | 공통 스킬 verify-and-report의 도구 합집합 필요(full "도구 허용") |
| render-dev allowed_tools | build, render.snapshot, lint.boundary | + test.unit | 같은 사유 |
| ui-dev allowed_tools | test.unit, dialogue.lint, build | + lint.boundary | 같은 사유 |
| integrator owns | src/main.ts, src/contracts, docs/rules, docs/GDD.md, harness/toolset.yaml | + docs/adr/**, TODO-CONTRACT.md, README.md, AGENTS.md | 미배치 경로 제거, TODO-CONTRACT.md 단일 소유 |
| TODO-CONTRACT.md 쓰기 | 없음 | integrator 소유, 구현 세션은 자기 섹션에만 추가 | 병렬 머지 충돌 방지. owns 밖 쓰기 예외라 contract-proposal MUST에 명시 |
| owns 표기 | src/core 등 | 디렉터리는 `/**` glob, 파일은 그대로 | schema.md 예시 형식으로 통일 |
| harness-gardener | harness/, .claude/ · harness.check | 현행 유지(재생성 안 함) | derivation.md 확정안(toolset.yaml 겹침 해소, receipts 추가) |
| 구현 스킬 마지막 단계 | 없음 | "verify-and-report로 이어간다", requires `[]` | verify-and-report는 후속 스킬 |
| 독립 리뷰 위치 | 없음 | verify-and-report S4, 조건 해당 시만 | ai-execution.md 조건 |
| contract-proposal | 기준안대로 | 도구 0개지만 유지 | 산출물 전달용, 기준안에 명시 |
| test.e2e | reviewer | reviewer + merge-checklist S5 | planned라 실행 거부. 영수증에 skip 사유 |

## 6. 실행 계획

1. 이 제안표 저장
2. TODO-CONTRACT.md 섹션 골격(1회 예외)
3. S5 스킬 8개 + references 2개(파일마다 format 훅 실행 여부 기록)
4. S6 에이전트 5개(gardener 제외)
5. S7 INDEX 재생성, S8 전체 검사
6. 독립 리뷰: 공통 스킬·에이전트 생성은 여러 기능으로 영향이 전파되므로 필요. S8 뒤 새 reviewer 에이전트에 승인 제안표, harness-design.md §6·§9, 생성 diff, full 검사 결과를 전달한다. reviewer가 이 세션에서 subagent로 잡히지 않으면 general-purpose로 대체하고 보고에 명시한다.
7. S9 커밋 제안

## 7. 승인

- 승인자: 사용자(builtkwon)
- 날짜: 2026-11-17
- 승인 조건: owns 디렉터리 표기를 `/**` glob으로 통일
