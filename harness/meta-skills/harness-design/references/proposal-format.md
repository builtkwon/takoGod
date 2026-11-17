# 제안표 형식

- 파일: `harness/proposals/NNNN-주제.md`. NNNN은 4자리 일련번호(0001부터). 가장 큰 번호가 "최신"이다.
- 승인된 것만 저장한다. 저장 후에는 고치지 않고 다음 번호로 새로 낸다.
- full 검사의 "승인안 diff"가 최신 제안표의 배치표를 읽어 생성물과 비교한다(다르면 경고).

## 구성

1. 배경: 무엇이 바뀌었나(toolset 변경, 반복 절차 발견, 상한 초과 등)
2. 툴셋 변화: 추가·제거 ID, 제거 시 선택 항목(대체 도구 / 단계 삭제 / 스킬 폐기)
3. 스킬 표
4. 배치표
5. 승인: 승인자와 날짜

## 스킬 표

| 스킬 | 언제 | requires | consumes | produces | steps 도구 |
| --- | --- | --- | --- | --- | --- |
| verify-and-report | 구현 후 검증·완료 보고 | - | - | - | S1 test.unit, S2 lint.boundary |

## 배치표 (기계 판독)

검사기가 읽는 규칙:

- 헤더에 `에이전트` 열과 `skills` 열이 있는 **첫 번째** 표를 배치표로 쓴다. 다른 표에는 이 두 열을 함께 두지 않는다.
- skills 칸: 쉼표로 구분. 백틱은 무시. 없으면 `-`.
- `(meta)`로 시작하는 칸은 메타 스킬 안내로 보고 빈 배치로 비교한다(harness-gardener).
- 제안표에 없는 에이전트, 생성되지 않은 에이전트도 경고로 보고된다.

```markdown
| 에이전트 | owns | allowed_tools | skills |
| --- | --- | --- | --- |
| core-dev | src/core/** | test.unit, lint.boundary, sim.balance | verify-and-report, tdd-game-rule |
| harness-gardener | .claude/**, harness/meta-skills/**, harness/proposals/**, harness/scripts/** | harness.check, harness.index | (meta) harness-design, harness-compaction |
```

## 승인

- 사용자에게 표를 보이고 명시적 승인("승인", "진행")을 받은 뒤 저장한다.
- 부분 승인이면 승인된 행만 남기고, 나머지는 다음 제안표로 미룬다.
