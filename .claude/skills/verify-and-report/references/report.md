# 검증·완료 보고 상세

원본: docs/rules/collaboration/implementation.md#완료-보고, docs/rules/collaboration/commits.md#스킬-영수증

## 생략

- 단계를 건너뛰면 영수증의 `skip=`에 사유를 쓴다. 사유에 괄호를 쓰지 않는다.
- 도구가 "대상 없음: <경로>"를 출력하고 exit 1로 끝나면 대상 구현이 아직 없다는 뜻이다. 실패가 아니라 생략으로 적고, 출력 원문을 보고에 옮긴다.
- planned 도구(예: test.e2e)는 실행이 거부된다. 거부 메시지를 옮기고 생략으로 적는다.
- 문서만 바꾼 작업도 S1~S3을 생략하려면 사유를 쓴다.

## 독립 리뷰 요청

조건은 docs/rules/collaboration/ai-execution.md#독립-리뷰가 원본이다. 해당할 때만 reviewer에 요청하고 다음을 넘긴다.

- 요청 원문과 승인된 범위(제안표·TODO-CONTRACT 항목 등)
- 변경 diff
- S1~S3 도구 출력(종료코드 포함)
- 작성 중인 완료 보고와 영수증 줄

reviewer 지적의 처리: 필수 수정은 완료 전에 고치고, 합의 필요는 사용자에게 올리고, 선택 개선은 완료를 막지 않는다. 고친 뒤에는 S1부터 다시 돌린다(3회 한도).

## 완료 보고

필수 항목:

- 변경: 만든·고친·지운 파일
- 실제 실행한 도구·결과: `pnpm tool <id>`(인자가 있으면 `pnpm tool <id> -- <인자>`), 종료코드, FAIL·WARN 원문
- 미검증 범위
- 영수증: 적용한 스킬마다 한 줄

## Skill-Receipt 트레일러

```
Skill-Receipt: <name>@v<version> S1,S2,S4 skip=S3(사유)
```

- 완료 단계는 쉼표로 잇고 공백 없이 쓴다. 생략이 여럿이면 `skip=S3(사유),S5(사유)`.
- 이 스킬을 다른 스킬에서 이어 실행했으면 두 스킬 모두 한 줄씩 쓴다.
- 커밋 메시지 끝 트레일러 블록(빈 줄 뒤, `Co-Authored-By`와 같은 블록)에 그대로 옮긴다.
- 예시: `Skill-Receipt: verify-and-report@v1 S1,S2,S3,S5 skip=S4(독립 리뷰 조건 비해당)`
