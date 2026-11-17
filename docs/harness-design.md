# 타코야끼트럭 하네스 설계 스냅샷

이 문서는 하네스 구축의 원본 설계다. 하네스 구축이 끝나면 내용은 `docs/rules`, `harness/`, `.claude/`로 옮겨지고, 이 문서는 이력으로 남는다(수정하지 않는다).

## 1. 원칙

- 규칙은 원본 한 곳에만 두고 다른 문서는 링크한다. (czems-server 문서 중심 하네스의 약식판)
- 도구 원본은 `harness/toolset.yaml` 하나다. 스킬·에이전트는 도구를 ID로만 참조한다.
- 참조는 단방향: agent → skill → tool. skill → skill(requires)은 같은 에이전트 안에서만.
- 생성 순서는 리프 → 루트: 스킬(위상 정렬) → 에이전트 → INDEX → 전체 검사.
- 자동 배치는 없다. 제안표 → 사용자 승인 → 생성.

## 2. 저장소 구조

```
takoyaki-truck/
├── CLAUDE.md                     # @AGENTS.md 한 줄
├── AGENTS.md                     # 진입점: 작업→읽을 문서 표, 핵심 기준
├── README.md                     # 구현 상태, 실행·배포
├── TODO-CONTRACT.md              # 구현 세션의 계약 변경 제안
├── .githooks/pre-commit          # full 검사(쓰기 없음)
├── harness/
│   ├── toolset.yaml
│   ├── meta-skills/              # gardener 전용. INDEX·고아 검사 제외, format 검사 대상
│   │   ├── harness-design/SKILL.md
│   │   └── harness-compaction/SKILL.md
│   ├── proposals/NNNN-*.md       # 승인된 제안표
│   └── scripts/
│       ├── tool.ts               # pnpm tool <id>
│       ├── harness-check.ts      # --format / --full / --summary
│       ├── gen-index.ts
│       ├── snapshot.ts           # render.snapshot
│       ├── simulate.ts           # sim.balance
│       └── lint-dialogues.ts     # dialogue.lint
├── .claude/
│   ├── settings.json             # hooks
│   ├── agents/*.md               # 루트
│   └── skills/
│       ├── INDEX.md              # 생성물. 커밋 대상. gardener·integrator만 갱신
│       └── <skill>/SKILL.md, references/*.md
├── docs/
│   ├── GDD.md
│   ├── harness-design.md         # 이 문서
│   ├── adr/template.md, 0001-ps1-render-pipeline.md
│   └── rules/
│       ├── README.md             # 목차 + 규칙 표현 5단계
│       ├── architecture/overview.md, modules/{core,render,ui,contracts}.md
│       ├── development/typescript.md, testing.md
│       └── collaboration/implementation.md, ai-execution.md, commits.md
└── src/
    ├── contracts/                # 포트·타입·이벤트 (integrator 소유)
    ├── core/                     # 순수 TS 로직 (core-dev)
    ├── render/                   # Three.js PS1 (render-dev)
    ├── ui/, data/                # DOM 오버레이·대사 (ui-dev)
    └── main.ts                   # 조립 (integrator)
```

## 3. 아키텍처 경계

| 계층 | 위치 | 규칙 |
| --- | --- | --- |
| domain+application | src/core | DOM·Three.js·브라우저 API 금지. 시간은 주입식 clock(tick(dt)). 저장소는 인터페이스 |
| 포트 | src/contracts | 모든 모듈 간 타입·EventBus 이벤트. 구현 세션은 읽기 전용 |
| 어댑터 | src/render, src/ui | contracts로만 core와 통신. 게임 규칙 금지 |
| bootstrap | src/main.ts | 루프·조립·PWA |

contracts 필수 타입: GameState, CookStep, Ingredient, DonenessJudge, Customer, DialogueLine{prompt, good, bad}, PhaseConfig(isTutorial), TutorialStep{target, message}, ReviewResult(source: 'tutorial'|'customer'), EventBus 이벤트 목록, BalanceSimulator(시나리오 → 평균 별점).

도구 연결 규약: core는 `src/core/sim.ts`에서 BalanceSimulator를 export한다. render는 `src/render/sandbox.html`(쿼리 `?state=<name>`)과 `src/render/sandbox.states.json`을 둔다. ui는 대사를 `src/data/dialogues.ts`에서 `DialogueLine[]`로 export한다.

## 4. docs/rules에 옮길 협업 규칙 (czems 차용)

### 규칙 표현

| 표현 | 의미 |
| --- | --- |
| 필수·금지 | 반드시 준수 |
| 기본·우선 | 특별한 이유가 없으면 따름. 다르면 이유 기록 |
| 허용 | 명시한 조건 안에서 자율 |
| 예시 | 설명용 |
| 미정 | 필요 시 합의. 임의 확정 금지 |

### 먼저 합의 vs 자율 진행

| 먼저 합의 | 자율 진행 |
| --- | --- |
| contracts 변경 | 모듈 내부 함수 추출·이름 |
| GDD 수치·페이즈·점수 변경 | GDD에 명시된 규칙 구현 |
| 라이브러리 추가·버전 변경 | 이미 쓰는 라이브러리 활용 |
| 폴더 소유권·모듈 경계 변경 | 담당 폴더 내부 정리 |

미래 기능용 추상화를 미리 만들지 않는다.

### 작업 루프와 완료 보고

- 구현 → 실행 검증(도구) → 리뷰 → 수정·재검증. 테스트 통과만으로 리뷰를 대신하지 않는다.
- 리뷰 체크: 요청 누락 / 무관한 변경 / 경계·contracts 준수 / 정상·실패·경계값 테스트 / 코드·문서 일치.
- 지적 분류: 필수 수정 / 합의 필요 / 선택 개선(완료를 막지 않음).
- 완료 보고: 변경 / 실제 실행한 도구·결과 / 미검증 범위 / 적용 스킬 영수증. 검증 못 했으면 "구현 완료, 검증 미완료".

### AI 실행 정책

- 독립 리뷰(reviewer 서브에이전트) 추가 조건: 점수·별점·평균 정확성 / contracts 변경 / sessionStorage 키·형식 / 공통 유틸·빌드·PWA 설정. 불분명하면 추가.
- 작업 시작 시 독립 리뷰 필요 여부와 근거를 한 줄로 밝힌다.
- 자동 수정은 작업 범위당 3회(자체+독립 합산). 초과 시 중단·보고. 접근 변경·에이전트 교체로 초기화 금지. 재개는 사용자 요청으로만.

### 커밋

- 타입: feat / fix / refactor / perf / test / docs / chore. 기능과 테스트는 같은 커밋.
- 커밋 전 변경 내용·검증 결과·제안 메시지를 보여주고 승인받는다.

### ADR

- 대상: 모듈 경계, 기술·라이브러리 선택, 저장 형식. 파일명 `NNNN-주제.md`.
- 양식: 배경 / 결정 기준 / 검토한 대안 / 결정 / 영향 / 재검토 조건.

## 5. 툴셋

`harness/toolset.yaml` 스키마:

```yaml
version: 1
tools:
  - id: test.unit          # 고정 ID. 변경 금지(제거 후 신규 등록)
    run: pnpm vitest run
    purpose: 한 줄
    side_effect: none | 설명
    status: active | planned   # planned는 tool.ts가 실행 거부(안내 메시지)
```

초기 등록:

| id | run | status |
| --- | --- | --- |
| test.unit | pnpm vitest run | active |
| test.e2e | pnpm playwright test --project=mobile | planned |
| build | pnpm build | active |
| lint.boundary | pnpm depcruise src --config .dependency-cruiser.cjs | active |
| render.snapshot | tsx harness/scripts/snapshot.ts | active |
| sim.balance | tsx harness/scripts/simulate.ts | active |
| dialogue.lint | tsx harness/scripts/lint-dialogues.ts | active |
| harness.check | tsx harness/scripts/harness-check.ts | active |

- snapshot·simulate·lint-dialogues는 하네스 구축 단계에서 contracts 기준으로 완성한다. 대상 구현이 아직 없으면 "대상 없음: <경로>"를 출력하고 종료코드 1로 끝난다. 그래서 harness/ 소유권을 구현 세션에 넘기지 않아도 된다.
  - snapshot: `src/render/sandbox.states.json`(상태 이름 배열)을 읽어 dev 서버의 `sandbox.html?state=<name>`을 모바일 뷰포트로 캡처 → `.artifacts/snapshots/`.
  - simulate: `src/core/sim.ts`의 `BalanceSimulator` 구현을 import해 전정답·무작위 시나리오 평균 별점 출력, GDD 밸런스 목표와 비교.
  - lint-dialogues: `src/data/dialogues.ts`를 `DialogueLine[]`로 읽어 good/bad 길이 차(±30%), 중복, 금지어 목록 검사.
- planned → active 전환(test.e2e)은 integrator가 E2E 작성 후 수행한다.

## 6. 스킬·에이전트 스키마

### 스킬 frontmatter

```yaml
---
name: <kebab-case>
version: <정수>
description: <언제 쓰는지로 시작, 200자 이하>
requires: []            # 같은 에이전트의 선행 스킬, 최대 2
consumes: []            # 다른 스킬이 produces하는 산출물 경로
produces: []
steps:
  S1: { tools: [] }
  S2: { tools: [test.unit] }
---
## MUST        # 첫 20줄 안, 5개 이하
## 단계        # S1..Sn, frontmatter steps와 일치
```

- 본문에 명령어 문자열(pnpm, npx, tsx, node) 금지. 도구는 `pnpm tool <id>`로만 호출한다는 문장은 허용(정확히 이 형식).
- 상세·예외·예시는 references/에 두고 단계에서 "조건 → 열 파일"로만 안내.

### 에이전트 frontmatter

```yaml
---
name: <kebab-case>
description: <한 줄>
tools: Read, Edit, Write, Bash, Grep, Glob
skills: [ ... ]          # harness-check가 읽는 필드
allowed_tools: [ ... ]   # toolset ID
owns: [ src/core/** ]
---
```

본문: 수정 범위 / 시작 시 AGENTS.md → INDEX에서 자기 스킬만 확인 / 필수·조건부 스킬 / 완료 보고 형식.

### 초기 배치 (harness-design 제안의 기준안)

| 에이전트 | owns | allowed_tools | skills |
| --- | --- | --- | --- |
| core-dev | src/core | test.unit, lint.boundary, sim.balance | verify-and-report, tdd-game-rule, contract-proposal |
| render-dev | src/render | build, render.snapshot, lint.boundary | verify-and-report, ps1-visual-check, contract-proposal |
| ui-dev | src/ui, src/data | test.unit, dialogue.lint, build | verify-and-report, dialogue-authoring, contract-proposal |
| integrator | src/main.ts, src/contracts, docs/rules, docs/GDD.md, harness/toolset.yaml | 전체 | verify-and-report, merge-checklist, contract-apply |
| reviewer | 읽기 전용 | test.unit, test.e2e, lint.boundary | independent-review |
| harness-gardener | harness/, .claude/ | harness.check | (meta) harness-design, harness-compaction |

산출물 전달: contract-proposal produces TODO-CONTRACT.md → contract-apply consumes.

## 7. 검사

### format (PostToolUse 훅, 파일 1개)

- 대상 경로: `.claude/**`, `harness/meta-skills/**`. 그 외 즉시 통과.
- SKILL.md 120줄 이하, references 각 200줄 이하, description 200자 이하.
- MUST 섹션 첫 20줄 안·5개 이하. 명령어 문자열 금지. frontmatter 스키마. steps와 본문 S 번호 일치.

### full (harness-design·compaction 마지막 단계, pre-commit — 쓰기 없음)

| 검사 | 실패 조건 |
| --- | --- |
| agent → skill | 없는 스킬 |
| skill → tool | toolset에 없는 ID |
| 도구 허용 | 에이전트 스킬들의 도구 합집합 ⊄ allowed_tools |
| requires | 없음 / 순환 / 다른 에이전트 스킬 / 3개 이상 |
| consumes | 생산자 없음 |
| INDEX 최신성 | 메모리 재생성 결과 ≠ 커밋된 INDEX → 실패, gen-index 안내 |
| 고아 | 배치 안 된 스킬(meta 제외) → 경고 |
| 승인안 diff | 최신 proposals ≠ 생성물 배치 → 경고 |

### summary (SessionStart, 읽기 전용)

스킬 수, 상한 80% 이상 근접 파일, planned 도구 목록 출력. 파일을 쓰지 않는다.

## 8. hooks

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "pnpm -s tsx harness/scripts/harness-check.ts --format --from-hook-stdin" }] }
    ],
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "pnpm -s tsx harness/scripts/harness-check.ts --summary --read-only" }] }
    ]
  }
}
```

- format 훅은 stdin JSON의 tool_input.file_path로 대상 여부 판단. 실패 시 exit 2 + stderr로 사유(Claude에게 피드백).
- pre-commit: `.githooks/pre-commit` → `pnpm tool harness.check -- --full --no-write`. `git config core.hooksPath .githooks`.

## 9. 영수증

- 완료 보고 필수 줄: `적용 스킬: <name>@v<version> — S1·S2 완료 / S3 생략(사유)`.
- reviewer는 영수증의 도구 단계와 실제 도구 로그를 대조하고, 로그 없는 "완료"는 필수 수정으로 지적한다.

## 10. harness-design 메타 스킬 단계

```
S1 toolset.yaml 확인(version 증가, 추가·제거 ID)
S2 스킬 후보 → requires·consumes/produces 그래프, 순환 검사
S3 에이전트 경계(owns·쓰기 도구) → 확정 스킬만 배치, allowed_tools 산출
S4 제안표 → 사용자 승인 → harness/proposals/NNNN.md
S5 스킬 생성(위상 정렬 순, format 훅만 동작)
S6 에이전트 생성(S5 스킬만 참조)
S7 gen-index
S8 full 검사 → 실패 시 수정(3회 한도), 승인안 diff 보고
S9 커밋 제안(사용자 승인)
```

스킬 도출: 2개 이상 도구를 정해진 순서로 쓰는 절차가 2회 이상 반복되면 스킬. 단일 도구 실행은 스킬 아님.
에이전트 도출: owns·쓰기 도구가 같은 묶음 = 1 에이전트. 읽기 전용 검토는 분리. 기존 에이전트에 도구 추가로 해결되면 추가.

## 11. 변경 전파

```
toolset.yaml → 영향 스킬 → 영향 에이전트 → gen-index → full 검사
```

도구 제거 시 참조 스킬을 자동 수정하지 않는다. full 검사 실패로 드러내고 제안표에 "대체 도구 / 단계 삭제 / 스킬 폐기" 선택 항목으로 올린다.

## 12. harness-compaction

상한 근접·초과 스킬 분할, references 이동, 6주 이상 영수증에 없는 단계·스킬 삭제 후보, 중복 단계 공통 스킬 추출. 결과는 제안표 → 승인 → 반영 → gen-index → full 검사.
