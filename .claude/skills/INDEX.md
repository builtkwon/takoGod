<!-- 생성물: pnpm tool harness.index 로 재생성한다. 직접 수정 금지. -->
# 스킬 INDEX

## 스킬

| 스킬 | 버전 | 설명 | 배치 에이전트 | requires | 도구 | 경로 |
| --- | --- | --- | --- | --- | --- | --- |
| contract-apply | v1 | TODO-CONTRACT.md의 contracts 변경 제안을 반영할 때 쓴다. 사용자 합의 후 src/contracts를 고치고 반영 항목을 지운 뒤 verify-and-report로 이어간다. | integrator | - | - | .claude/skills/contract-apply/SKILL.md |
| contract-proposal | v2 | 구현 중 필요한 contracts 타입·이벤트가 없거나 owns 밖 파일(설정 포함) 변경이 필요할 때 쓴다. 직접 고치지 않고 TODO-CONTRACT.md 자기 역할 섹션에 제안만 추가한다. | core-dev, render-dev, ui-dev | - | - | .claude/skills/contract-proposal/SKILL.md |
| dialogue-authoring | v1 | 손님 대사·리뷰 코멘트·튜토리얼 문구(src/data)를 쓰거나 고칠 때 쓴다. GDD 콘텐츠 기준으로 작성하고 대사 검사 뒤 verify-and-report로 이어간다. | ui-dev | - | dialogue.lint | .claude/skills/dialogue-authoring/SKILL.md |
| independent-review | v2 | 독립 리뷰를 요청받았을 때 쓴다. 파일을 고치지 않고 영수증·도구 로그 대조, 테스트·경계 재실행, 체크 5항목 검토 후 지적을 분류해 보고한다. | reviewer | - | lint.boundary, test.e2e, test.unit | .claude/skills/independent-review/SKILL.md |
| merge-checklist | v2 | 모듈 작업을 병합하거나 main.ts에서 core·render·ui를 조립할 때 쓴다. 모듈 보고 확인과 밸런스·대사·화면·E2E 검사, README 최신화, 병합 후 브랜치 정리 뒤 verify-and-report로 이어간다. | integrator | - | dialogue.lint, render.snapshot, sim.balance, test.e2e | .claude/skills/merge-checklist/SKILL.md |
| ps1-visual-check | v1 | render의 PS1 시각 요소(모델·텍스처·셰이더·카메라)를 바꿀 때 쓴다. sandbox 상태를 캡처해 GDD·ADR 사양과 대조한 뒤 verify-and-report로 이어간다. | render-dev | - | render.snapshot | .claude/skills/ps1-visual-check/SKILL.md |
| tdd-game-rule | v1 | core 게임 규칙·수치(굽기·판정·손님·점수·진행)를 구현할 때 쓴다. GDD 수치로 실패 테스트를 먼저 쓰고 구현·밸런스 확인 뒤 verify-and-report로 이어간다. | core-dev | - | sim.balance, test.unit | .claude/skills/tdd-game-rule/SKILL.md |
| verify-and-report | v1 | 구현을 마친 뒤 단위 테스트·빌드·경계 검사로 검증하고 완료 보고와 Skill-Receipt 영수증을 쓸 때 쓴다. 다른 스킬의 마지막 단계에서 이어 실행한다. | core-dev, integrator, render-dev, ui-dev | - | build, lint.boundary, test.unit | .claude/skills/verify-and-report/SKILL.md |

## 에이전트

| 에이전트 | 스킬 | allowed_tools |
| --- | --- | --- |
| core-dev | verify-and-report, tdd-game-rule, contract-proposal | test.unit, build, lint.boundary, sim.balance |
| harness-gardener | - | harness.check, harness.index, harness.receipts |
| integrator | verify-and-report, merge-checklist, contract-apply | test.unit, test.e2e, build, lint.boundary, render.snapshot, sim.balance, dialogue.lint, harness.check, harness.index, harness.receipts |
| render-dev | verify-and-report, ps1-visual-check, contract-proposal | test.unit, build, lint.boundary, render.snapshot |
| reviewer | independent-review | test.unit, test.e2e, build, lint.boundary, sim.balance, render.snapshot |
| ui-dev | verify-and-report, dialogue-authoring, contract-proposal | test.unit, build, lint.boundary, dialogue.lint |
