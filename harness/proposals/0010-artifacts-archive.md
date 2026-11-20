# 0010 .artifacts/pm 산출물 보관 도구(artifacts.archive)

## 1. 배경

`.artifacts/pm` 최상위에 실행마다 prompt-integrator<N>.txt, integrator<N>.log, <역할>-<시각>.json/.err가 쌓인다(2026-11-20 기준 112개). PM이 이어받을 때 읽을 파일(resume.md, state.md)이 묻히므로, 일회성 산출물을 tar 하나로 묶는 스크립트 `harness/scripts/archive-artifacts.ts`를 둔다. 독립 리뷰의 차단 1건(최근 10개 유지 규칙이 진행 중·방금 끝난 실행 파일을 묶을 수 있음)과 권장 사항을 반영했다.

목적: 현재 문서를 찾기 쉽게 하고, 진행 중이거나 막 끝난 실행의 파일은 절대 건드리지 않는다.

## 2. 결정

- ① 호출 방식: 상주 에이전트나 `/loop`를 만들지 않는다. PM이 `run-integrator.sh` 끝에서 1회 호출한다(스크립트 수정은 PM).
- ② 보호 규칙: 보관 대상(이름 패턴 일치)이 30개를 넘을 때만 동작한다. 다음은 절대 묶지 않는다.
  - 수정 24시간 미만, 진행 중 실행(`<역할>.md`에 `## <시각> (exit` 줄이 아직 없음)
  - 0바이트: prompt·log·verdicts만 보호한다. 실행 파일(json·err)은 끝난 실행(헤더 있음)이면 0바이트여도 묶는다(사용자 결정 2026-11-20 "끝난 실행은 묶음"). 성공한 실행의 .err는 보통 0바이트라서다.
  - 같은 실행의 json·err는 한 쌍이다. 하나라도 보호면 둘 다 남긴다.
  - resume.md, state.md, *.sh, archive/ 안의 파일은 패턴 밖이라 대상이 아니다.
  - "최근 10개 유지" 규칙은 없앴다. 순서는 mtime이 아니라 파일 이름의 번호·시각(자연 정렬)이다.
- ③ 첫 실제 실행 전에 `--dry-run` 결과를 PM이 확인한다.

동작: `archive/<시각>.tar.gz`로 묶고 `tar -tzf` 목록을 대조한 뒤에만 `archive/<시각>.txt`(전체 목록)를 쓰고 원본을 지운다. 이어서 `archive/INDEX.md`에 `- <시각> | <N>개 | <tar 이름>` 한 줄을 덧붙인다. tar 실패·검증 실패 시 tar를 지우고 원본을 보존한 채 exit 1.

## 3. 툴셋 변화(integrator 작업)

toolset.yaml은 integrator 소유라 gardener는 고치지 않는다. 등록안:

```yaml
version: 4   # 3 → 4
  - id: artifacts.archive
    run: tsx harness/scripts/archive-artifacts.ts
    purpose: .artifacts/pm의 번호·시각 산출물을 archive/<시각>.tar.gz로 묶는다(보관 대상 30개 초과 시, 24시간 미만·0바이트·진행 중·쌍 보호). --dry-run 지원
    side_effect: 원본 파일 삭제(tar 검증 뒤), .artifacts/pm/archive/에 tar.gz·txt 생성, archive/INDEX.md에 한 줄 추가
    status: active
```

등록 전 실행: `pnpm exec tsx harness/scripts/archive-artifacts.ts --dry-run`.

## 4. 스킬 표

변경 없음.

## 5. 배치표

| 에이전트 | owns | allowed_tools | skills |
| --- | --- | --- | --- |
| core-dev | src/core/** | test.unit, build, lint.boundary, sim.balance | verify-and-report, tdd-game-rule, contract-proposal |
| render-dev | src/render/** | test.unit, build, lint.boundary, render.snapshot | verify-and-report, visual-check, contract-proposal |
| ui-dev | src/ui/**, src/data/** | test.unit, build, lint.boundary, dialogue.lint | verify-and-report, dialogue-authoring, contract-proposal |
| integrator | 0008과 같음 | 0008과 같음 | verify-and-report, merge-checklist, contract-apply |
| reviewer | -(읽기 전용) | test.unit, test.e2e, build, lint.boundary, sim.balance, render.snapshot | independent-review |
| harness-gardener | 0008과 같음 | harness.check, harness.index, harness.receipts | (meta) harness-design, harness-compaction |

- 등록 뒤 PM 외 에이전트의 allowed_tools에는 넣지 않는다(PM이 스크립트에서 호출).

## 6. 변경

| # | 대상 | 변경 |
| --- | --- | --- |
| 1 | harness/scripts/archive-artifacts.ts | 보호 규칙, 이름 정렬, json·err 쌍, 목록 txt·INDEX, archive/ 흩어진 파일 묶기 제거 |
| 2 | harness/scripts/__tests__/archive-artifacts.test.ts | 13건(끝난 실행의 0바이트 json·err 묶기, tar 실행·검증 실패 시 원본 보존, INDEX 덧붙이기, 24시간 미만·0바이트, 쌍·진행 중, 이름 정렬, dry-run 무변경 등) |

## 7. 후속

- integrator: §3 등록(version 3→4).
- PM: `run-integrator.sh` 끝에 1회 호출 추가. 첫 실행 전 dry-run 확인.
- 완료: integrator가 §3을 f66d2ed로 등록(toolset v4).
- 처리됨: 끝난 실행의 0바이트 .err 때문에 쌍이 계속 남던 문제는 ②의 0바이트 규칙 조정으로 해소(사용자 결정 2026-11-20).

## 8. 독립 리뷰

수행(PM 경유). 차단 1건·권장 사항을 이 제안표에 반영했다. 재리뷰 여부는 PM이 판단한다.

## 9. 승인

- 승인자: 사용자
- 날짜: 2026-11-20
- 방식: "모두 권장대로 실시"(독립 리뷰 결론 반영, PM 세션 경유)
