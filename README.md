# takoyaki-truck

모바일 세로화면 PWA 타코야끼 굽기 게임(Vite + TypeScript + Three.js). 설계: [docs/GDD.md](docs/GDD.md). 작업 안내: [AGENTS.md](AGENTS.md).

## 구현 상태

5단계(core·render·ui 구현 병합과 main 조립)를 마쳤다. main에서 PWA 게임이 동작한다: 튜토리얼과 P1~P5 진행, 결과 화면, 오프라인 셸, iOS 홈 화면 추가 안내. 6단계 굽기 조작 개편을 통합했고 후속 정리를 마쳤다. `main.ts`는 V2 진입점(GameV2·renderV2·ScenePicker·mountUiV2)을 쓰고, 옛 Game·옛 render 경로·옛 mountUi·도구바와 사용 중단된 contracts 타입·이벤트는 삭제했다. `sim.balance`는 V2 게임을 측정한다. contracts의 V2 접미사 타입(`GameStateV2`, `HoleStateV2`, `TutorialStepV2`)은 이름 변경이 따로 남아 있다.

굽기 개편의 새 게임 규칙은 [GDD](docs/GDD.md)가 원본이다. 요약만 적는다.
- 구멍마다 독립 상태로 진행한다. 마가린·반죽은 통에서 끌어 손가락이 지나간 구멍마다 칠하고, 속재료는 구멍 하나에 놓으며, 굴리기는 구멍을 누르는 순간 타이밍 바 위치로 판정한다(§굽기).
- 화면: 타이밍 바는 W1/W2 영역과 숫자를 보여 주고, 끌기 고스트는 재료 모양 아이콘이며 트레이 칸 아래에 재료 이름표가 붙는다. 배경은 밤 도로(남색 하늘, 가로등 빛, 보케)다.
- 완성품은 후네에 담아 서빙한다. 후네 밖에 놓으면 떨어져 사라지고 탄 것은 항상 버린다(§굽기).
- 손님마다 인내(얼굴 색 변화)가 있고, 별점이 낮으면 다시해줘 요청이나 0~1점 떠남이 있다(§손님 대화, §점수).
- 점수는 비공개다. 서빙 직후 맛보기 반응 대사와 합산 결과를 보여 준다(§손님 대화).

병합 규칙은 [implementation.md](docs/rules/collaboration/implementation.md#병합), 병합 단계는 [merge-checklist 스킬](.claude/skills/merge-checklist/SKILL.md)을 따른다.

## 브랜치

| 브랜치 | 내용 | 상태 |
| --- | --- | --- |
| main | GDD, 규칙 문서, contracts, 하네스, 병합된 구현과 조립(main.ts), PWA | 기준선. push 시 자동 배포 |
| feat/core-cleanup | src/core: 옛 Game·판정·시뮬레이터 삭제, V2 공개 API를 index로 내보냄, sim.balance가 V2 측정 | main에 병합. 병합 뒤 로컬 삭제, 원격 삭제는 PM |
| feat/render-cleanup | src/render: 옛 render 경로·옛 sandbox 상태 삭제 | main에 병합. 병합 뒤 로컬 삭제, 원격 삭제는 PM |
| feat/ui-cleanup | src/ui, src/data: 옛 mountUi·도구바·게이지·옛 튜토리얼 문구 삭제 | main에 병합. 병합 뒤 로컬 삭제, 원격 삭제는 PM |
| feat/core-bar-zone | src/core: cooking·cooked도 본게임 W1 영역 표시 | main에 병합. 병합 뒤 로컬 삭제, 원격 삭제는 PM |
| feat/render-night-bg | src/render: 밤 도로 배경(backdrop.ts) | main에 병합. 병합 뒤 로컬 삭제, 원격 삭제는 PM |
| feat/ui-touch-bar, feat/ui-ingredient-look | src/ui: 누르는 순간 판정, 끌어 칠하기, 타이밍 바 개선, 재료 아이콘·트레이 이름표 | main에 병합. 병합 뒤 로컬 삭제, 원격 삭제는 PM |

- 병합 전에 README를 최신화하고(그 변경이 병합 직전 main 커밋), 병합 뒤 브랜치는 로컬·원격 모두 삭제한다. 새 작업은 main에서 `feat/<모듈>-<주제>` 브랜치를 만든다(예: `feat/ui-drag`) → [implementation.md](docs/rules/collaboration/implementation.md#병합).

## 폴더 구조

```text
AGENTS.md            작업 진입점(작업 → 읽을 문서)
CLAUDE.md            AGENTS.md를 가져오는 Claude Code 진입점
TODO-CONTRACT.md     contracts 변경 제안함(역할별 섹션)
docs/
  GDD.md             게임 규칙·수치 원본
  adr/               기술 결정 기록(ADR)
  harness-design.md  하네스 설계 스냅샷(수정 금지)
  rules/
    architecture/    계층·경계, 모듈별 규칙
    development/     TypeScript, 테스트
    collaboration/   합의, 리뷰, 커밋, AI 실행
harness/
  toolset.yaml       도구 ID 원본
  scripts/           도구 구현(tool, harness-check, gen-index 등)
  meta-skills/       하네스를 설계·정리하는 메타 스킬
  proposals/         하네스 변경 제안표
.claude/
  settings.json      훅(편집 후 format 검사, 세션 시작 summary)
  agents/            에이전트 정의
  skills/            스킬과 INDEX.md(생성물)
.githooks/
  pre-commit         커밋 시 하네스 full 검사
src/
  contracts/         core와 render·ui 사이 타입·이벤트
  core/              순수 게임 로직(GameV2, 시뮬레이터, three·DOM 금지)
  render/            Three.js 툰 셰이딩 렌더링(renderV2, ScenePicker, backdrop.ts 밤 도로 배경)
  ui/                DOM 오버레이(v2/ 끌어 칠하기·놓기 조작, icons.ts 재료 아이콘, tray-labels.ts 트레이 이름표, iOS 설치 안내 포함)
  data/              대사·리뷰 코멘트·맛보기 반응·튜토리얼 문구
  main.ts            조립·루프·서비스 워커 등록
  session-store.ts   브라우저 SessionStore(sessionStorage, ADR 0002)
  __tests__/         src 최상위 파일의 단위 테스트(모듈마다 자기 __tests__/)
e2e/                 Playwright 시나리오(game.spec.ts)
playwright.config.ts E2E 설정(mobile 프로젝트, build 후 preview)
public/              manifest, 아이콘(PNG), sw.js
.artifacts/          작업 기록(gitignore 대상)
```

## 하네스 구조

규칙 원문과 상세는 [modules/harness.md](docs/rules/architecture/modules/harness.md)에 있다. 여기는 관계만 요약한다.

- `harness/toolset.yaml`이 도구 ID의 원본이다. 스킬은 단계마다 이 ID를 쓰고, 에이전트는 `skills`, `allowed_tools`, `owns`로 쓸 수 있는 것을 정한다.
- `gen-index`가 스킬·에이전트 정의에서 `.claude/skills/INDEX.md`를 생성한다. 직접 고치지 않는다(`pnpm tool harness.index`).
- `pnpm tool <id>`가 도구의 단일 실행 진입점이다. 마지막 줄에 `[tool] <id> exit=<code>`를 출력한다.
- 하네스 검사는 세 가지다.

| 검사 | 실행 시점 |
| --- | --- |
| format | Write·Edit 뒤 수정 훅 |
| full | pre-commit(스테이지된 내용 기준) |
| summary | 세션 시작 |

- 작업을 마친 스킬은 `Skill-Receipt:` 영수증을 보고와 커밋 트레일러에 남긴다 → [commits.md](docs/rules/collaboration/commits.md#스킬-영수증).
- 변경 절차: 제안표 작성 → 사용자 승인 → harness-gardener가 반영 → gen-index → `pnpm tool harness.check -- --full` 통과.

## 에이전트 구성

`.claude/agents/*.md`와 [INDEX.md](.claude/skills/INDEX.md) 기준이다.

| 에이전트 | owns | 스킬 | 허용 도구 |
| --- | --- | --- | --- |
| core-dev | src/core/** | verify-and-report, tdd-game-rule, contract-proposal | test.unit, build, lint.boundary, sim.balance |
| render-dev | src/render/** | verify-and-report, ps1-visual-check, contract-proposal | test.unit, build, lint.boundary, render.snapshot |
| ui-dev | src/ui/**, src/data/** | verify-and-report, dialogue-authoring, contract-proposal | test.unit, build, lint.boundary, dialogue.lint |
| integrator | src/*.ts, src/__tests__/**, src/contracts/**, docs/rules/**, docs/GDD.md, docs/adr/**, harness/toolset.yaml, TODO-CONTRACT.md, README.md, AGENTS.md, e2e/**, public/**, playwright.config.ts, 루트 설정 파일 | verify-and-report, merge-checklist, contract-apply | test.unit, test.e2e, build, lint.boundary, render.snapshot, sim.balance, dialogue.lint, harness.check, harness.index, harness.receipts |
| harness-gardener | .claude/**, harness/meta-skills/**, harness/proposals/**, harness/scripts/**, .githooks/** | - | harness.check, harness.index, harness.receipts |
| reviewer | 없음(읽기 전용) | independent-review | test.unit, test.e2e, build, lint.boundary, sim.balance, render.snapshot |

## 운영 방식

- PM 세션(main 폴더)이 지시·검토·판정을 맡고, 사용자는 결정 표를 승인한다.
- 대화형 작업자 tako-core, tako-render, tako-ui는 `claude --agent <역할>`로 저장소 밖 worktree(feat/core, feat/render, feat/ui)에서 실행되며 SendMessage로 소통한다.
- integrator와 harness-gardener는 main 폴더에서 실행한다.
- reviewer와 반박 검토는 PM의 하위 에이전트다.
- 작업자 흐름: 에이전트 정의 → 착수 전 owns 대조(범위 밖 파일이 필요하면 착수하지 않고 보고) → AGENTS.md와 INDEX 자기 행 확인 → 독립 리뷰 여부 1줄 → 스킬 단계 → `pnpm tool` 실행 → 완료 보고와 영수증.
- PM 흐름: 도구 재실행 대조 → 판정 → 리뷰 조건이면 reviewer → 커밋 승인 또는 사용자 결정 표.
- 병합 흐름: README 최신화 커밋 → merge-checklist로 main에 `--no-ff` 병합 → 병합한 브랜치를 로컬·원격에서 삭제(원격은 PM) → [implementation.md](docs/rules/collaboration/implementation.md#병합).
- 커밋 승인: 사용자가 위임한 범위(검증 통과, 사용자 결정 항목 없음, 영수증 유효)는 PM 승인으로 대신하고, GDD 수치·contracts·라이브러리·규칙 문서·ADR·main 병합·배포는 사용자 승인을 받는다 → [commits.md](docs/rules/collaboration/commits.md).
- 작업당 왕복 2회, 자동 수정 3회 같은 한도는 [review.md](docs/rules/collaboration/review.md#대화-한도)와 [ai-execution.md](docs/rules/collaboration/ai-execution.md#자동-수정-한도)에 있다.

## 실행

Node 24, pnpm 10(`packageManager`에 고정. corepack 사용 시 `corepack enable pnpm`).

```sh
pnpm install
pnpm dev                          # 개발 서버
pnpm build                        # 타입 검사(tsconfig.json, tsconfig.core.json) + 빌드 → dist/
pnpm vitest run                   # 단위 테스트
pnpm depcruise                    # 모듈 경계 검사
pnpm tool test.e2e                # E2E(build 후 vite preview 대상)
```

## 테스트

세 층이다: 단위(Vitest, 모듈의 `__tests__/<대상>.test.ts`), 화면(`pnpm tool render.snapshot`), E2E(Playwright mobile 프로젝트, `e2e/*.spec.ts`, 시나리오 9개: 부팅, PWA, 튜토리얼, 복원, 손상된 저장값 등). 작성 기준은 [testing.md](docs/rules/development/testing.md)에 있다.

## PWA

- 오프라인 셸: `public/sw.js`가 셸과 빌드 자산을 캐시한다. 내비게이션은 네트워크 우선·오프라인이면 캐시, 새 셸을 받으면 참조하지 않는 옛 해시 자산을 지운다. 서비스 워커는 빌드 결과(PROD)에서만 등록한다.
- 아이콘: PNG 192·512(any), maskable 512, apple-touch 180, 파비콘은 PNG(icon-192). manifest에는 192·512·maskable을 등록했다(`public/manifest.webmanifest`).
- iOS Safari에서는 첫 화면 전에 홈 화면 추가 안내를 보여주고 "웹에서 계속하기"로 넘어갈 수 있다.

## 배포

Cloudflare Pages 정적 배포: https://takogod.pages.dev. main에 push하면 자동 배포된다. 빌드 명령 `pnpm build`, 출력 `dist`, 환경 변수 `NODE_VERSION=24`. 설정은 Cloudflare 쪽에 있고 저장소에는 배포 설정 파일이 없다.
