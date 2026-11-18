# 구현 협업

## 먼저 합의 vs 자율 진행

| 먼저 합의 | 자율 진행 |
| --- | --- |
| contracts 변경 | 모듈 내부 함수 추출·이름 |
| GDD 수치·페이즈·점수 변경 | GDD에 명시된 규칙 구현 |
| 라이브러리 추가·버전 변경 | 이미 쓰는 라이브러리 활용 |
| 폴더 소유권·모듈 경계 변경 | 담당 폴더 내부 정리 |

- 금지: 미래 기능용 추상화를 미리 만든다.
- contracts 변경 제안은 [TODO-CONTRACT.md](../../../TODO-CONTRACT.md) 양식으로 남긴다.

## 작업 루프

구현 → 실행 검증(도구) → 리뷰 → 수정·재검증.

- 금지: 테스트 통과만으로 리뷰를 대신한다.
- 자동 수정 한도는 [ai-execution.md](ai-execution.md), 리뷰 조건·절차는 [review.md](review.md).

## 리뷰

체크 항목과 지적 분류는 [review.md](review.md#체크-5항목)가 원본이다.

## 병합

- 필수: 병합 전에 README.md를 최신화하고, 그 변경을 병합 직전 main 커밋으로 둔다. 바뀐 것이 없으면 병합 커밋 본문에 "README 확인, 변경 없음"을 쓴다.
- 필수: 병합 뒤 병합한 브랜치를 로컬과 원격 모두에서 삭제한다. 원격 삭제는 push 권한이 있는 PM이 한다.
- 기본: 작업마다 main에서 새 브랜치를 만든다. 이름은 `feat/<모듈>-<주제>`(예: `feat/ui-drag`)이고, 작업자는 자기 worktree에서 `git switch -c`로 만든다.
- 예외(1회): 지금 쓰는 feat/core·feat/render·feat/ui는 6단계 병합 뒤 삭제하고, 그 뒤부터 위 규칙을 따른다.
- 병합 단계와 검증은 [merge-checklist 스킬](../../../.claude/skills/merge-checklist/SKILL.md)을 따른다. main 병합은 사용자 승인 대상이다([commits.md](commits.md)).

## 완료 보고

필수 항목:

- 변경
- 실제 실행한 도구·결과
- 미검증 범위
- 적용 스킬 영수증(스킬이 있을 때): 커밋 트레일러와 같은 `Skill-Receipt:` 줄 → [commits.md](commits.md#스킬-영수증)

검증하지 못했으면 "구현 완료, 검증 미완료"로 보고한다.
