# takoyaki-truck

모바일 세로화면 PWA 타코야끼 굽기 게임(Vite + TypeScript + Three.js). 설계: [docs/GDD.md](docs/GDD.md). 작업 안내: [AGENTS.md](AGENTS.md). 버전·릴리스: [versioning.md](docs/rules/collaboration/versioning.md). 변경 이력: [CHANGELOG.md](CHANGELOG.md).

## 구현 상태

5단계(core·render·ui 구현 병합과 main 조립)를 마쳤다. main에서 PWA 게임이 동작한다: 튜토리얼과 P1~P5 진행, 결과 화면, 오프라인 셸, iOS 홈 화면 추가 안내. 6단계 굽기 조작 개편을 통합했고 후속 정리를 마쳤다. `main.ts`는 V2 진입점(GameV2·renderV2·ScenePicker·mountUiV2)을 쓰고, 옛 Game·옛 render 경로·옛 mountUi·도구바와 사용 중단된 contracts 타입·이벤트는 삭제했다. `sim.balance`는 V2 게임을 측정한다. contracts의 V2 접미사 타입(`GameStateV2`, `HoleStateV2`, `TutorialStepV2`)은 이름 변경이 따로 남아 있다.

굽기 개편의 새 게임 규칙은 [GDD](docs/GDD.md)가 원본이다. 요약만 적는다.
- 구멍마다 독립 상태로 진행한다. 버터(내부 이름 margarine)·반죽은 통에서 끌어 손가락이 지나간 구멍마다 칠하고, 속재료는 구멍 하나에 놓으며, 굴리기는 구멍을 누르는 순간 타이밍 바 위치로 판정한다(§굽기).
- 화면: 타이밍 바는 점수판(상단 HUD) 바로 아래에 있고 판 공용 W1(1)·W2(2) 영역을 함께 보여 주며 판정 글자(적중·빗나감!)는 크게 나온다. 평균 별점은 우상단 별 칸과 리뷰 카드로 보여 준다. 끌기 고스트는 재료 모양 아이콘이며 트레이 칸 아래에 재료 이름표가 붙는다. 배경은 밤 도로(남색 하늘, 가로등 빛, 보케)다.
- 완성품은 후네에 담아 서빙한다. 후네 밖에 놓으면 떨어져 사라지고 탄 것은 항상 버린다(§굽기).
- 손님마다 인내(얼굴 색 변화)가 있고, 별점이 낮으면 다시해줘 요청이나 0~1점 떠남이 있다(§손님 대화, §점수).
- 점수는 비공개다. 서빙 직후 맛보기 반응 대사와 합산 결과를 보여 준다(§손님 대화).

2차 개편(수치 원본은 GDD)도 반영했다.
- 철판은 4×4 16구다. 튜토리얼은 1, 2, 5, 6, 9, 10번 6구만 열고 나머지는 덮개로 잠가 조작을 받지 않는다.
- 타이밍 바 주기는 1.6초이고, W1·W2 영역은 판 전체가 하나씩 공유하며 페이즈 시작과 굴리기마다 무작위로 다시 뽑는다. 폭은 페이즈별로 다르다.
- 3차 수정: 튜토리얼 영역은 가운데 50% 고정이고 빗나가도 진행한다. 완성볼이 흰색으로 바뀌고 손님 자리 id는 고정이다.
- 탐 타이머는 4초에 어두워지고 6초에 탄다.
- 후네가 6알로 차면 가쓰오부시를 얹는 완성 연출 뒤 1초 기다렸다 서빙한다. 그동안 놓기는 거부된다.
- 대화 결과 연출: 정답은 폭죽, 오답은 물음표 또는 빠직. 인내가 100%가 되면 화면이 흔들리고 분노 대사(`src/data/fumed-lines.ts`)가 말풍선 자리에 나온다.

4차 개편(가게 점수, 수치 원본은 GDD §가게 점수)도 반영했다.
- HUD: 왼쪽 위 최고 가게 점수("최고 N", 기록이 없으면 "최고 -", 진행 중 넘으면 NEW), 가운데 단계와 그 아래 현재 가게 점수, 오른쪽 위 별 칸과 그 아래 작게 리뷰 수. 접시를 더하면 +N과 콤보 팝업이 뜬다.
- 가게 점수 규칙: 별점과 별개의 상한 없는 점수다. 접시 점수 = round((만족도 + 굴리기 적중 × 5) × 콤보 배수). 연속 완벽 접시 n번째는 배수 1.0 + 0.2 × (n−1)(최대 2.0)이고 완벽이 아니면 ×1.0과 콤보 0이다. 튜토리얼 접시는 0점, 다시해줘를 부른 첫 접시는 더하지 않는다.
- 최고 기록은 세션이 끝날 때(결과 화면) max로 갱신해 localStorage `takoyaki:best`에 영구 저장한다(`{version:1,best}`, 손상 값은 버림). 결과 화면은 가게 점수와, 갱신했으면 "최고 기록!"을 보인다 → [ADR 0004](docs/adr/0004-best-shop-score-storage.md).

병합 규칙은 [implementation.md](docs/rules/collaboration/implementation.md#병합), 병합 단계는 [merge-checklist 스킬](.claude/skills/merge-checklist/SKILL.md)을 따른다.

## 브랜치

| 브랜치 | 내용 | 상태 |
| --- | --- | --- |
| main | GDD, 규칙 문서, contracts, 하네스, 병합된 구현과 조립(main.ts), PWA | 기준선. push 시 자동 배포 |
| feat/core-cleanup, feat/render-cleanup, feat/ui-cleanup | 옛 Game·옛 render 경로·옛 mountUi 삭제, V2 공개 API 정리 | 병합·삭제 완료 |
| feat/core-bar-zone, feat/render-night-bg | cooking·cooked도 W1 영역 표시, 밤 도로 배경(backdrop.ts) | 병합·삭제 완료 |
| feat/ui-touch-bar, feat/ui-ingredient-look | 누르는 순간 판정, 끌어 칠하기, 재료 아이콘·트레이 이름표 | 병합·삭제 완료 |
| feat/render-toon | src/render: 툰 셰이딩 전환(toon.ts, ADR 0003) | 병합·삭제 완료 |
| feat/contracts-batch2, feat/core-batch2, feat/render-batch2, feat/ui-batch2 | 2차 개편(16구, 튜토리얼 잠금, 타이밍·탐 수치, 서빙 대기, 대화 연출) | 병합·삭제 완료 |
| feat/contracts-batch3, feat/core-batch3, feat/render-batch3, feat/ui-batch3 | 3차 수정(판 공용 타이밍 영역, 버터 표기, 별 칸, 튜토리얼 50%) | 병합·삭제 완료 |
| feat/contracts-batch4, feat/core-batch4, feat/render-batch4, feat/ui-batch4 | 4차: 가게 점수·콤보, HUD 3열, 최고 기록 localStorage | 병합·삭제 완료 |

지금 열려 있는 기능 브랜치는 없다.

- 병합 전에 README를 최신화하고(그 변경이 병합 직전 main 커밋), 병합 뒤 브랜치는 로컬·원격 모두 삭제한다. 새 작업은 main에서 `feat/<모듈>-<주제>` 브랜치를 만든다(예: `feat/ui-drag`) → [implementation.md](docs/rules/collaboration/implementation.md#병합).

## 폴더 구조

```text
AGENTS.md            작업 진입점(작업 → 읽을 문서)
CLAUDE.md            AGENTS.md를 가져오는 Claude Code 진입점
TODO-CONTRACT.md     contracts 변경 제안함(역할별 섹션)
docs/
  GDD.md             게임 규칙·수치 원본
  adr/               기술 결정 기록(0001 PS1 렌더는 0003 툰 렌더로 대체됨, 0002 세션 저장, 0004 최고 가게 점수 저장, 0005 튜토리얼 완료 기기 저장)
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
  core/              순수 게임 로직(GameV2, 시뮬레이터, scoring-v2.ts 접시 가게 점수·콤보, session.ts 메모리 저장소, three·DOM 금지)
  render/            Three.js 툰 셰이딩 렌더링(toon.ts 툰 재질·외곽선, effects.ts 폭죽·물음표·빠직, backdrop.ts 밤 도로 배경, slots.ts 손님 자리 id 고정, ADR 0003)
  ui/                DOM 오버레이(v2/ 끌어 칠하기·놓기 조작, v2/stars.ts 우상단 별 칸, v2/hud.ts HUD 3열, icons.ts 재료 아이콘, tray-labels.ts 트레이 이름표, iOS 설치 안내 포함)
  data/              대사·리뷰 코멘트·맛보기 반응·튜토리얼 문구(fumed-lines.ts 분노 대사, hud-text.ts HUD·점수 문구)
  main.ts            조립·루프·서비스 워커 등록
  session-store.ts   브라우저 SessionStore(sessionStorage, ADR 0002)
  best-store.ts      브라우저 BestScoreStore(localStorage takoyaki:best, ADR 0004)
  profile-store.ts   튜토리얼 완료 기기 저장(localStorage takoyaki:profile)과 세션 저장 포트 감싸기(ADR 0005)
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
| render-dev | src/render/** | verify-and-report, visual-check, contract-proposal | test.unit, build, lint.boundary, render.snapshot |
| ui-dev | src/ui/**, src/data/** | verify-and-report, dialogue-authoring, contract-proposal | test.unit, build, lint.boundary, dialogue.lint |
| integrator | src/*.ts, src/__tests__/**, src/contracts/**, docs/rules/**, docs/GDD.md, docs/adr/**, harness/toolset.yaml, TODO-CONTRACT.md, README.md, AGENTS.md, e2e/**, public/**, playwright.config.ts, 루트 설정 파일 | verify-and-report, merge-checklist, contract-apply | test.unit, test.e2e, build, lint.boundary, render.snapshot, sim.balance, dialogue.lint, harness.check, harness.index, harness.receipts |
| harness-gardener | .claude/**, harness/meta-skills/**, harness/proposals/**, harness/scripts/**, .githooks/** | - | harness.check, harness.index, harness.receipts |
| reviewer | 없음(읽기 전용) | independent-review | test.unit, test.e2e, build, lint.boundary, sim.balance, render.snapshot |

## 운영 방식

- PM 세션(main 폴더)이 지시·검토·판정을 맡고, 사용자는 결정 표를 승인한다.
- 대화형 작업자 tako-core, tako-render, tako-ui는 `claude --agent <역할>`로 저장소 밖 worktree에서 작업마다 main에서 만든 `feat/<모듈>-<주제>` 브랜치로 실행되며 SendMessage로 소통한다.
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

세 층이다: 단위(Vitest, 모듈의 `__tests__/<대상>.test.ts`), 화면(`pnpm tool render.snapshot`), E2E(Playwright mobile 프로젝트, `e2e/*.spec.ts`, 시나리오 16개: 부팅, PWA, 튜토리얼, 복원, 손상된 저장값, 최고 기록 표시·손상, 튜토리얼 완료 기억, 타이틀 튜토리얼 버튼 등). 작성 기준은 [testing.md](docs/rules/development/testing.md)에 있다.

## PWA

- 오프라인 셸: `public/sw.js`가 셸과 빌드 자산을 캐시한다. 내비게이션은 네트워크 우선·오프라인이면 캐시, 새 셸을 받으면 참조하지 않는 옛 해시 자산을 지운다. 서비스 워커는 빌드 결과(PROD)에서만 등록한다.
- 아이콘: PNG 192·512(any), maskable 512, apple-touch 180, 파비콘은 PNG(icon-192). manifest에는 192·512·maskable을 등록했다(`public/manifest.webmanifest`).
- iOS Safari에서는 첫 화면 전에 홈 화면 추가 안내를 보여주고 "웹에서 계속하기"로 넘어갈 수 있다.

## 배포

Cloudflare Pages 정적 배포: https://takogod.pages.dev. main에 push하면 자동 배포된다. 빌드 명령 `pnpm build`, 출력 `dist`, 환경 변수 `NODE_VERSION=24`. 설정은 Cloudflare 쪽에 있고 저장소에는 배포 설정 파일이 없다.
