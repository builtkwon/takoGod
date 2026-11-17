# 변경 전파

원본: docs/harness-design.md §11.

```
toolset.yaml → 영향 스킬 → 영향 에이전트 → INDEX 재생성 → 전체 검사
```

## 도구 추가

- 새 ID를 쓸 스킬 후보가 있는지 S2에서 본다. 단일 도구 실행이면 스킬로 만들지 않고 allowed_tools에만 추가한다.

## 도구 제거

- 참조 스킬을 자동 수정하지 않는다.
- 전체 검사(skill → tool, 도구 허용)가 실패로 드러내게 둔다.
- 제안표에 스킬마다 선택 항목을 올린다:

| 스킬 | 단계 | 제거된 ID | 선택 |
| --- | --- | --- | --- |
| example-skill | S2 | old.tool | 대체 도구 / 단계 삭제 / 스킬 폐기 |

- 승인된 선택대로 반영하고, 스킬 version을 올린다.

## planned → active

- test.e2e 같은 planned 도구의 active 전환은 integrator가 한다(toolset.yaml 소유).
- 전환 후 이미 배치된 스킬은 그대로 동작한다. 새 배치가 필요하면 제안표로.

## ID 변경

- ID는 고정이다. 바꾸려면 제거 + 신규 등록으로 처리하고 위 "도구 제거" 절차를 따른다.
