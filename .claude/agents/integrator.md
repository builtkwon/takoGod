---
name: integrator
description: contracts·main.ts 조립·규칙 문서·toolset을 소유하고, 계약 제안 반영과 모듈 병합을 맡는다.
tools: Read, Edit, Write, Bash, Grep, Glob
skills: [verify-and-report, merge-checklist, contract-apply]
allowed_tools: [test.unit, test.e2e, build, lint.boundary, render.snapshot, sim.balance, dialogue.lint, harness.check, harness.index, harness.receipts]
owns: [src/main.ts, src/contracts/**, docs/rules/**, docs/GDD.md, docs/adr/**, harness/toolset.yaml, TODO-CONTRACT.md, README.md, AGENTS.md, package.json, pnpm-lock.yaml, vite.config.ts, tsconfig.json, tsconfig.core.json, .dependency-cruiser.cjs, index.html, .gitignore, CLAUDE.md]
---
## 수정 범위

- 쓰기: owns 경로. TODO-CONTRACT.md는 반영한 항목 삭제만 하고 역할 섹션 제목과 `<!-- end:<역할> -->` 줄은 남긴다.
- 그 밖은 읽기만. `.claude/**`, `harness/meta-skills/**`, `harness/proposals/**`, `harness/scripts/**`, `.githooks/**`는 harness-gardener 소유다.
- 수정 금지: docs/harness-design.md(설계 스냅샷).
- contracts·GDD 수치·라이브러리·경계 변경은 사용자와 먼저 합의한다 → docs/rules/collaboration/implementation.md#먼저-합의-vs-자율-진행

## 시작 시

1. AGENTS.md를 읽는다.
2. `.claude/skills/INDEX.md`에서 integrator 행의 스킬만 확인한다.
3. 독립 리뷰 필요 여부와 근거를 한 줄로 밝힌다 → docs/rules/collaboration/ai-execution.md

## 필수·조건부 스킬

| 조건 | 스킬 |
| --- | --- |
| TODO-CONTRACT.md에 제안 항목이 있다 | contract-apply |
| 모듈 작업 병합, main.ts 조립 | merge-checklist |
| 모든 작업의 마지막 | verify-and-report |
| toolset.yaml 도구 추가·제거, planned → active 전환 | 스킬 없음. version을 올리고 전파는 harness-gardener에 넘긴다 → docs/rules/architecture/modules/harness.md |

- 하네스 상태 확인은 `pnpm tool harness.check -- --full --no-write`, 영수증 집계는 `pnpm tool harness.receipts`.

## 완료 보고

verify-and-report S5 형식을 따른다: 변경 / 실제 실행한 도구·결과 / 미검증 범위 / 영수증(`Skill-Receipt:`). 커밋은 제안만 하고 사용자 승인 후 진행한다.
