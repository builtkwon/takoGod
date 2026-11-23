# AGENTS.md

타코야끼트럭: 모바일 세로화면 PWA 게임(Vite + TypeScript + Three.js). 이 파일은 진입점이다. 규칙 원문은 링크한 문서에 있고, 아래 요약과 원문이 다르면 원문을 따른다.

## 작업 → 읽을 문서

| 작업 | 먼저 읽을 문서 |
| --- | --- |
| 게임 규칙·수치 구현 | [docs/GDD.md](docs/GDD.md), [modules/core.md](docs/rules/architecture/modules/core.md) |
| 렌더링(src/render) | [modules/render.md](docs/rules/architecture/modules/render.md), [ADR 0003](docs/adr/0003-toon-render-pipeline.md) |
| UI·대사 데이터(src/ui, src/data) | [modules/ui.md](docs/rules/architecture/modules/ui.md), [GDD §콘텐츠](docs/GDD.md#콘텐츠) |
| contracts·main.ts 변경 | [modules/contracts.md](docs/rules/architecture/modules/contracts.md), [TODO-CONTRACT.md](TODO-CONTRACT.md) |
| 모듈 경계·의존 | [architecture/overview.md](docs/rules/architecture/overview.md) |
| TS 설정·타입 작성 | [development/typescript.md](docs/rules/development/typescript.md) |
| 테스트 작성 | [development/testing.md](docs/rules/development/testing.md) |
| 작업 진행·리뷰·완료 보고 | [collaboration/implementation.md](docs/rules/collaboration/implementation.md), [review.md](docs/rules/collaboration/review.md), [ai-execution.md](docs/rules/collaboration/ai-execution.md) |
| 커밋 | [collaboration/commits.md](docs/rules/collaboration/commits.md) |
| 릴리스·버전 | [collaboration/versioning.md](docs/rules/collaboration/versioning.md) |
| 기술 결정 기록 | [docs/adr/template.md](docs/adr/template.md) |
| 규칙 표현(필수·기본·허용·예시·미정) | [docs/rules/README.md](docs/rules/README.md) |

하네스: 도구 원본은 [harness/toolset.yaml](harness/toolset.yaml)이고 `pnpm tool <id>`로 실행한다. 스킬 목록은 `.claude/skills/INDEX.md`(생성물). 설계 원본은 [docs/harness-design.md](docs/harness-design.md)이며 수정하지 않는다. 확정 규칙은 [modules/harness.md](docs/rules/architecture/modules/harness.md).

pre-commit 훅: `pnpm install`이 `prepare`로 `git config core.hooksPath .githooks`를 설정한다(새 클론도 동일). 단, 이 폴더가 git 저장소 최상위일 때만이고, `.git` 없는 복사본·다른 저장소의 하위 디렉터리에서는 건너뛴다(install은 성공). 커밋 시 스테이지된 내용으로 하네스 full 검사를 돌린다. 스킬·에이전트 본문의 명령어 금지 규칙(경로 실행 검출 포함)은 [modules/harness.md](docs/rules/architecture/modules/harness.md#도구-호출).

## 핵심 기준

- 게임 규칙·수치의 원본은 GDD다 → [GDD](docs/GDD.md)
- core는 three·DOM 금지, render·ui는 contracts로만 core와 통신 → [overview](docs/rules/architecture/overview.md)
- contracts·GDD 수치·라이브러리·경계 변경은 먼저 합의 → [implementation](docs/rules/collaboration/implementation.md#먼저-합의-vs-자율-진행)
- 완료 보고에 실제 실행한 도구와 결과, 미검증 범위를 쓴다 → [implementation](docs/rules/collaboration/implementation.md#완료-보고)
- 커밋은 승인 후 → [commits](docs/rules/collaboration/commits.md)

## 검증 명령

| 목적 | 명령 |
| --- | --- |
| 빌드(타입 검사 포함) | `pnpm build` |
| 단위 테스트 | `pnpm vitest run` |
| 경계 검사 | `pnpm depcruise` |
