# 0008 병합 전 README 최신화와 병합 후 브랜치 정리

## 1. 배경

사용자 결정(2026-11-19, PM 전달): "앞으로 머지하기 전에는 무조건 리드미를 최신화 한 다음 머지한다. 머지한 후 브랜치는 정리하여 삭제한다. 이는 규칙으로 정했다." 이 결정을 승인으로 보고 제안표 작성과 적용을 한 작업에서 한다.

## 2. 툴셋 변화

없음.

## 3. 스킬 표

| 스킬 | 언제 | requires | consumes | produces | steps 도구 |
| --- | --- | --- | --- | --- | --- |
| merge-checklist(v1 → v2) | 모듈 작업을 병합하거나 main.ts에서 조립할 때 | - | - | - | S1 -, S2 sim.balance, S3 dialogue.lint, S4 render.snapshot, S5 test.e2e, S6 -, S7 -, S8 - |

- 단계 추가: S6 README 최신화(병합 전), S7 브랜치 정리(병합 후). 기존 S6(verify-and-report로 이어가기)은 S8로 밀린다. 단계 번호가 바뀌므로 version을 올린다.
- S6·S7은 도구가 없는 단계라 tools는 [].
- 영수증 예: `Skill-Receipt: merge-checklist@v2 S1,S2,S3,S4,S5,S6,S7,S8`.

## 4. 배치표

변경 없음(0006과 같음).

| 에이전트 | owns | allowed_tools | skills |
| --- | --- | --- | --- |
| core-dev | src/core/** | test.unit, build, lint.boundary, sim.balance | verify-and-report, tdd-game-rule, contract-proposal |
| render-dev | src/render/** | test.unit, build, lint.boundary, render.snapshot | verify-and-report, ps1-visual-check, contract-proposal |
| ui-dev | src/ui/**, src/data/** | test.unit, build, lint.boundary, dialogue.lint | verify-and-report, dialogue-authoring, contract-proposal |
| integrator | src/*.ts, src/__tests__/**, src/contracts/**, docs/rules/**, docs/GDD.md, docs/adr/**, harness/toolset.yaml, TODO-CONTRACT.md, README.md, AGENTS.md, package.json, pnpm-lock.yaml, vite.config.ts, tsconfig.json, tsconfig.core.json, .dependency-cruiser.cjs, index.html, .gitignore, CLAUDE.md, playwright.config.ts, e2e/**, public/** | test.unit, test.e2e, build, lint.boundary, render.snapshot, sim.balance, dialogue.lint, harness.check, harness.index, harness.receipts | verify-and-report, merge-checklist, contract-apply |
| reviewer | -(읽기 전용) | test.unit, test.e2e, build, lint.boundary, sim.balance, render.snapshot | independent-review |
| harness-gardener | .claude/**, harness/meta-skills/**, harness/proposals/**, harness/scripts/**, harness/tsconfig.json, .githooks/** | harness.check, harness.index, harness.receipts | (meta) harness-design, harness-compaction |

## 5. 변경

| # | 대상 | 변경 |
| --- | --- | --- |
| 1 | .claude/skills/merge-checklist/SKILL.md | v2. S6 README 최신화(바뀐 것을 반영해 main에 커밋, 없으면 병합 커밋 본문에 "README 확인, 변경 없음"), S7 브랜치 정리(`git branch -d`로 로컬 삭제, 원격 삭제는 PM에게 요청), S8 verify-and-report. MUST에 규칙 한 줄과 implementation.md#병합 링크 |
| 2 | .claude/skills/INDEX.md | `pnpm tool harness.index`로 재생성 |

## 6. 후속

- docs/rules/collaboration/implementation.md `## 병합` 절: integrator가 동시에 작성한다(스킬이 `#병합` 링크를 건다).
- PM 조치 필요: integrator 실행기(run-integrator.sh, `.artifacts/pm`, PM 소유)의 허용 도구에 `Bash(git branch:*)`가 필요하다. 없으면 S7의 `git branch -d`가 거부된다. 원격 삭제는 integrator에 push 권한이 없어 PM이 한다.

## 7. 독립 리뷰

생략. 근거: 도구가 없는 병합 절차 단계 2개 추가이고 점수·contracts·빌드 설정은 바꾸지 않는다. 자체 리뷰와 full 검사로 확인한다.

## 8. 승인

- 승인자: 사용자
- 날짜: 2026-11-19
- 방식: 사용자 결정 "앞으로 머지하기 전에는…규칙으로 정했다"를 승인으로 봄(PM 세션 경유)
