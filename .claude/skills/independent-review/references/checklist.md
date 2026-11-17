# 독립 리뷰 상세

원본: docs/rules/collaboration/implementation.md#리뷰, docs/rules/collaboration/ai-execution.md

## 영수증 대조

- 영수증·트레일러 형식 기준은 .claude/skills/verify-and-report/references/report.md#skill-receipt-트레일러.
- 해당 스킬 SKILL.md의 frontmatter steps에서 도구가 있는 단계를 뽑는다.
- 그 단계가 완료로 적혀 있으면 전달받은 출력에 같은 도구 실행과 종료코드가 있어야 한다. 없으면 필수 수정.
- `skip=` 단계는 사유가 있는지, 사유가 사실과 맞는지 본다(예: "대상 없음" 출력 원문).
- 스킬 version이 현재 SKILL.md version과 다르면 합의 필요로 올린다.

## 체크 항목

| 항목 | 확인 기준 |
| --- | --- |
| 요청 누락 | 요청·승인 범위의 항목이 diff에 모두 있다 |
| 무관한 변경 | 범위 밖 파일·owns 밖 쓰기가 없다. 예외는 승인 문서에 기록돼 있어야 한다 |
| 경계·contracts 준수 | docs/rules/architecture/overview.md 계층·의존 방향, contracts 직접 수정 금지 |
| 테스트 | 정상·실패·경계값이 함께 있다. 게임 규칙 기대값은 GDD 수치에서 온다 → docs/rules/development/testing.md |
| 코드·문서 일치 | 변경이 docs/rules·GDD·제안표와 모순되지 않는다 |

하네스 변경을 리뷰할 때는 승인된 제안표(harness/proposals/ 최신)의 배치표·스킬 표와 생성물을 행 단위로 맞춘다.

## 보고

```
분류 | 위치 | 문제 | 근거
필수 수정 | path:line | ... | 도구 출력 또는 규칙 링크
```

- 지적이 없으면 "지적 없음"과 확인한 범위를 쓴다.
- 실행한 도구: `pnpm tool <id>`와 종료코드, FAIL 원문.
- 미검증 범위: 실행하지 못한 도구, 보지 않은 파일.
- 영수증: `Skill-Receipt: independent-review@v1 ...`
