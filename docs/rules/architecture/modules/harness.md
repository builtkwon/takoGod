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
- 금지: 스킬·에이전트 본문과 references에 그 밖의 명령어 문자열(pnpm, npx, tsx, node).
  - 검출: 단독 명령(`pnpm build`), 경로 실행 — `/`·`./`·`../`·`~/`로 시작하는 경로의 끝(`/usr/bin/node a.js`)이나 `bin/`·`.bin/` 바로 뒤(`node_modules/.bin/tsx`).
  - 검출 안 함: 파일 이름(`App.tsx`, `pnpm-lock.yaml`), 이름 일부(`node_modules`), 모듈 지정자(`node:fs`), 경로 중간 마디(`@types/node`, `src/node/x.ts`), URL.
- 필수: 본문의 `pnpm tool <id>`는 toolset에 있고, 그 본문을 쓰는 에이전트의 `allowed_tools`에 있어야 한다(full 검사).

## 검사

| 검사 | 언제 | 기준 |
| --- | --- | --- |
| format | Write·Edit 훅(PostToolUse) | 실패 또는 훅 실행 실패 → exit 2로 차단 |
| full | 메타 스킬 마지막 단계, pre-commit | pre-commit은 스테이지된 내용 기준. harness 타입 검사(`harness/tsconfig.json`) 포함. 스크립트가 있는데 tsconfig가 없으면 실패 |
| summary | SessionStart | 읽기 전용 |

- 필수: 제안표 파일명은 `harness/proposals/NNNN-<kebab>.md`.
- 필수: `harness/toolset.yaml`에 도구를 추가·제거하면 `version`을 올린다. 줄이지 않는다. full 검사가 HEAD의 toolset(`HEAD:./harness/toolset.yaml`)과 비교한다(`--staged`는 스테이지 대 HEAD). 프로젝트가 다른 저장소의 하위 디렉터리이거나 첫 커밋이면 비교하지 않는다(skip).
  - toolset version 규칙은 pre-commit 시점에만 강제한다. `--amend`·cherry-pick·revert는 대상이 아니다.
  - 필수: `--amend`로 도구를 변경하면 version을 다시 올린다(amend 중에는 고치는 커밋 자신이 HEAD 기준이다).
- 필수: 메타 스킬(`harness/meta-skills/**`)은 harness-gardener 소속이다. 메타 스킬의 도구는 gardener `allowed_tools`와 대조한다.
- pre-commit 설치: `pnpm install`의 `prepare`가 `core.hooksPath=.githooks`를 설정한다.
  - 조건: 패키지 디렉터리가 git 저장소의 최상위일 때만(`git rev-parse --show-prefix`가 빈 값). 다른 저장소의 하위 디렉터리, `.git` 없는 복사본, git 미설치 환경에서는 아무것도 하지 않고 install은 성공한다.

## 대상 경로

- 필수: 도구 대상 경로(sim, sandbox, dialogues)는 `src/contracts/tooling.ts`의 `TOOL_ENTRY_PATHS`에서만 가져온다.
- 영수증 형식은 [commits.md](../../collaboration/commits.md#스킬-영수증)가 원본이다.
