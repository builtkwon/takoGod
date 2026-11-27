# takoyaki-truck

모바일 세로화면 PWA 타코야끼 굽기 게임(Vite + TypeScript + Three.js). 설계: [docs/GDD.md](docs/GDD.md). 작업 안내: [AGENTS.md](AGENTS.md). 버전·릴리스: [versioning.md](docs/rules/collaboration/versioning.md). 변경 이력: [CHANGELOG.md](CHANGELOG.md).

## 현재 상태

배포 중인 버전과 변경 이력은 [CHANGELOG.md](CHANGELOG.md)가 원본이다(README에는 버전 번호를 옮겨 적지 않는다). 규칙·수치 원본은 [GDD](docs/GDD.md)이고, 아래는 요약이다.

- 진행: 튜토리얼 뒤 1단계부터 끝없이 이어진다. 난이도는 20단계까지 오르고 이후 고정이다(현재 수치는 GDD, 곡선은 `src/core/levels.ts`). 화난 손님이 세션 합계 4명이 되면 영업 종료(결과 화면)다.
- 점수: 별점과 별개로 상한 없는 가게 점수와 콤보가 있고, 최고 기록은 기기에 저장한다. 평균 별점은 우상단 별 칸과 리뷰 카드로 보여 준다.
- 굽기 조작: 철판은 4×4 16구다. 버터(코드 이름 `margarine`)·반죽은 통에서 끌어 칠하고, 속재료는 끌어 놓거나 트레이 칸을 탭한 뒤 구멍을 탭해 넣는다. 굴리기는 타이밍 바 판정이고, 완성품은 접시(코드 이름 `fune`)에 담아 서빙한다.
- 콘텐츠: 10단계부터 주문, 식품 신고(지우개가 든 접시), 12단계 러시 아워, 13단계 빼 주세요, 15단계 단체 주문, 17단계 깐깐한 VIP가 나온다. 주문 라벨은 손님 머리 위에 계속 보인다. 말풍선은 작게 구이판·재료칸을 피해 놓이고, 답 버튼은 화면 아래에 손님별 한 줄로 고정되며, 손님 머리 위에 분노 게이지(남은 인내 막대)가 보이고, 빼 주세요를 어긴 접시는 다시 해 달라고 하지 않는다.
- 기억·재시작: 튜토리얼 완료를 기기에 기억하고 타이틀의 "튜토리얼" 버튼으로 다시 할 수 있다. 결과 화면과 게임 중 HUD("↻ 다시 하기", 확인 후, 확인 창이 떠 있는 동안 게임은 일시정지)에서 1단계부터 새 판을 연다. 튜토리얼은 첫 방문 타이틀의 "튜토리얼 건너뛰기"나 튜토리얼 중 HUD "건너뛰기"(확인 후)로 건너뛸 수 있다.
- 타이밍: 모든 단계에서 영역 하나를 굴리기 1·2가 함께 쓴다(영역 표시에 번호 없음).
- 화면: 세로 전용이다. 가로로 돌리면 "화면을 세로로 돌려 주세요" 안내와 일시정지, 넓은 화면은 가운데 칸에 모이고, 장면은 화면 높이에 맞춰 채워지며, 더블탭·핀치 확대는 막는다.
- 앱: 오프라인 셸 PWA이고 iOS 홈 화면 추가 안내가 있다.

## 개발 운영

- 브랜치: main에는 직접 커밋하지 않는다. 작업은 `feature/<작업명>` 브랜치에서 하고, main 반영·태그·push는 PM이 한다. 배포(main push)는 사용자 승인 대상이다 → [implementation.md](docs/rules/collaboration/implementation.md#병합), [commits.md](docs/rules/collaboration/commits.md).
- 릴리스: 배포할 묶음마다 릴리스 커밋과 주석 태그를 만든다 → [versioning.md](docs/rules/collaboration/versioning.md#릴리스).
- 병합 전에 README를 최신화한다. 병합 기록은 `git log`와 CHANGELOG를 본다. 병합 단계는 [merge-checklist 스킬](.claude/skills/merge-checklist/SKILL.md)을 따른다.

## 폴더 구조

```text
AGENTS.md            작업 진입점(작업 → 읽을 문서)
CLAUDE.md            AGENTS.md를 가져오는 Claude Code 진입점
CHANGELOG.md         버전별 변경 이력
TODO-CONTRACT.md     contracts 변경 제안함(역할별 섹션)
docs/
  GDD.md             게임 규칙·수치 원본
  adr/               기술 결정 기록(0001 PS1 렌더는 0003 툰 렌더로 대체됨, 0002 세션 저장, 0004 최고 가게 점수 저장, 0005 프로필(튜토리얼 완료) 저장)
  harness-design.md  하네스 설계 스냅샷(수정 금지)
  rules/
    architecture/    계층·경계, 모듈별 규칙
    development/     TypeScript, 테스트
    collaboration/   합의, 리뷰, 커밋, 버전, AI 실행
harness/
  toolset.yaml       도구 ID 원본
  scripts/           도구 구현(tool, harness-check, gen-index, simulate, snapshot, lint-dialogues, receipts, archive-artifacts)
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
  core/              순수 게임 로직(GameV2, 시뮬레이터, scoring-v2.ts 가게 점수·콤보, levels.ts 단계별 난이도 곡선, 주문·식품 신고·특별 손님 규칙, session.ts 메모리 저장소, three·DOM 금지)
  render/            Three.js 툰 셰이딩 렌더링(toon.ts 툰 재질·외곽선, effects.ts 폭죽·물음표·빠직, backdrop.ts 밤 도로 배경, slots.ts 손님 자리 id 고정, ADR 0003)
  ui/                DOM 오버레이(v2/ 끌어 칠하기·놓기·탭 조작, v2/stars.ts 별 칸, v2/hud.ts HUD, v2/customer-badges.ts 손님 머리 위 주문 라벨·특별 손님 아이콘, v2/rush-badge.ts 러시 아워 배지, v2/restart.ts 다시 하기 확인, v2/tutorial-view.ts 튜토리얼 안내, icons.ts 재료 아이콘, tray-labels.ts 트레이 이름표, z.ts 레이어 z-index, install.ts iOS 설치 안내)
  data/              대사·리뷰 코멘트·튜토리얼 문구(tutorial.ts 튜토리얼, fumed-lines.ts 분노 대사, special-lines.ts 주문·특별 손님·식품 신고 대사, taste-lines.ts 맛보기 반응, hud-text.ts HUD·점수 문구)
  main.ts            조립·루프·서비스 워커 등록
  session-store.ts   브라우저 SessionStore(sessionStorage, ADR 0002)
  best-store.ts      브라우저 BestScoreStore(localStorage takoyaki:best, ADR 0004)
  profile-store.ts   튜토리얼 완료 기기 저장(localStorage takoyaki:profile)과 세션 저장 포트 감싸기(ADR 0005)
  version-label.ts   화면 버전 표시 문자열
  __tests__/         src 최상위 파일의 단위 테스트(모듈마다 자기 __tests__/)
e2e/                 Playwright 시나리오(game.spec.ts)
playwright.config.ts E2E 설정(mobile 프로젝트, build 후 preview)
public/              manifest, 아이콘(PNG), sw.js
.artifacts/          작업 기록(gitignore 대상)
```

## 하네스 구조

규칙 원문과 상세는 [modules/harness.md](docs/rules/architecture/modules/harness.md)에 있다. 여기는 관계만 요약한다.

- `harness/toolset.yaml`이 도구 ID의 원본이다. 스킬은 단계마다 이 ID를 쓰고, 에이전트는 `skills`, `allowed_tools`, `owns`로 쓸 수 있는 것을 정한다.
- 도구(11개): test.unit, test.e2e, build, lint.boundary, render.snapshot, sim.balance, dialogue.lint, harness.check, harness.index, harness.receipts, artifacts.archive.
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
- 대화형 작업자 tako-core, tako-render, tako-ui는 `claude --agent <역할>`로 저장소 밖 worktree에서 작업마다 만든 브랜치로 실행되며 SendMessage로 소통한다.
- integrator와 harness-gardener는 PM이 지정한 브랜치에서 실행한다. main 반영·태그·push는 하지 않는다.
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

세 층이다: 단위(Vitest, 모듈의 `__tests__/<대상>.test.ts`), 화면(`pnpm tool render.snapshot`), E2E(Playwright mobile 프로젝트, `e2e/*.spec.ts`, 시나리오 28개: 부팅, PWA, 튜토리얼, 속재료 탭 선택·탭 안내, 게임 중 다시 하기, 복원, 손상된 저장값, 최고 기록 표시·손상, 튜토리얼 완료 기억, 타이틀 튜토리얼 버튼, 결과 화면 다시 하기 등). 작성 기준은 [testing.md](docs/rules/development/testing.md)에 있다.

## PWA

- 오프라인 셸: `public/sw.js`가 셸과 빌드 자산을 캐시한다. 내비게이션은 네트워크 우선·오프라인이면 캐시, 새 셸을 받으면 참조하지 않는 옛 해시 자산을 지운다. 서비스 워커는 빌드 결과(PROD)에서만 등록한다.
- 아이콘: PNG 192·512(any), maskable 512, apple-touch 180, 파비콘은 PNG(icon-192). manifest에는 192·512·maskable을 등록했다(`public/manifest.webmanifest`).
- iOS Safari에서는 첫 화면 전에 홈 화면 추가 안내를 보여주고 "웹에서 계속하기"로 넘어갈 수 있다.

## 배포

Cloudflare Pages 정적 배포: https://takogod.pages.dev. main에 push하면 자동 배포되며 push는 사용자 승인 대상이다. 빌드 명령 `pnpm build`, 출력 `dist`, 환경 변수 `NODE_VERSION=24`. 설정은 Cloudflare 쪽에 있고 저장소에는 배포 설정 파일이 없다.
