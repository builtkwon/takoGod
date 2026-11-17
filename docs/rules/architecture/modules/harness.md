# 하네스 (`harness/`, `.claude/`)

- 설계 원본: [docs/harness-design.md](../../../harness-design.md)(스냅샷, 수정 금지). 아래는 그 뒤 합의로 확정한 규칙이다.

## 소유

| 경로 | 소유 |
| --- | --- |
| `harness/toolset.yaml` | integrator |
| `.claude/**`, `harness/meta-skills/**`, `harness/proposals/**`, `harness/scripts/**` | harness-gardener |

- 필수: `.claude/skills/INDEX.md`는 생성물이다. `pnpm tool harness.index`로만 갱신한다.
- 소유 변경은 먼저 합의한다([implementation.md](../../collaboration/implementation.md#먼저-합의-vs-자율-진행)).

## 도구 호출

- 필수: 도구는 toolset ID로 `pnpm tool <id>` 또는 `pnpm tool <id> -- <인자>` 형식으로만 부른다.
- 금지: 스킬·에이전트 본문과 references에 그 밖의 명령어 문자열(pnpm, npx, tsx, node). 파일 이름(`App.tsx`, `pnpm-lock.yaml`)은 해당하지 않는다.
- 필수: 본문의 `pnpm tool <id>`는 toolset에 있고, 그 본문을 쓰는 에이전트의 `allowed_tools`에 있어야 한다(full 검사).

## 검사

| 검사 | 언제 | 기준 |
| --- | --- | --- |
| format | Write·Edit 훅(PostToolUse) | 실패 또는 훅 실행 실패 → exit 2로 차단 |
| full | 메타 스킬 마지막 단계, pre-commit | pre-commit은 스테이지된 내용 기준. harness 타입 검사(`harness/tsconfig.json`) 포함 |
| summary | SessionStart | 읽기 전용 |

- 필수: 제안표 파일명은 `harness/proposals/NNNN-<kebab>.md`.
- pre-commit은 `pnpm install`의 `prepare`가 `core.hooksPath=.githooks`로 설치한다.

## 대상 경로

- 필수: 도구 대상 경로(sim, sandbox, dialogues)는 `src/contracts/tooling.ts`의 `TOOL_ENTRY_PATHS`에서만 가져온다.
- 영수증 형식은 [commits.md](../../collaboration/commits.md#스킬-영수증)가 원본이다.
