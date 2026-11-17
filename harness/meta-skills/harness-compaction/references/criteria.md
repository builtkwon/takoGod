# 정리 기준

원본: docs/harness-design.md §7 summary, §12. 상한 값 → harness/meta-skills/harness-design/references/schema.md

## 분할

대상: SKILL.md 96줄(80%) 이상, references 160줄 이상, description 160자 이상.

| 상황 | 처리 |
| --- | --- |
| 단계가 서로 다른 두 목적을 섞는다 | 목적별 두 스킬로 나누고 하나가 다른 하나를 requires |
| 단계 수는 적은데 줄이 많다 | 분할하지 말고 references 이동부터 |
| references 한 파일이 크다 | 주제별 파일로 나누고 단계의 안내 링크를 고친다 |
| description이 길다 | "언제 쓰는지" 한 문장만 남기고 나머지는 본문으로 |

- 분할 후 requires는 같은 에이전트 안, 최대 2개 규칙을 지킨다. 못 지키면 분할하지 않는다.

## references 이동

- 단계 줄에는 "조건 → 열 파일"만 남긴다.
- 옮길 것: 예외 목록, 예시, 표, 판단 기준 설명, 2줄을 넘는 단계 설명.
- 옮기지 않을 것: MUST, 단계 번호와 그 단계의 도구 호출.

## 미사용 삭제 후보

- 근거: git log의 커밋 트레일러 `Skill-Receipt:`(형식 → docs/rules/collaboration/commits.md#스킬-영수증).
- 집계: `pnpm tool harness.receipts`(기본 최근 6주). "미사용 후보"에 나온 스킬(영수증 없음)·단계(완료 0회)가 후보다.
- 기준: 최근 6주 트레일러에 한 번도 완료로 나오지 않은 단계·스킬.
- 생략(`skip=`)으로만 나온 단계도 후보다. 생략 사유가 늘 같으면 단계를 조건부로 바꾸는 안도 함께 올린다.
- 형식 오류 트레일러가 있으면(exit 1) 그 커밋은 근거에서 빼고 보고에 적는다.
- 삭제 제안에는 근거 기간과 건수(영수증 있는 커밋 수)를 적는다.

## 공통 스킬 추출

- 조건: 같은 도구를 같은 순서로 쓰는 단계 묶음이 2개 이상 스킬에 있다.
- 추출한 공통 스킬을 각 스킬이 requires한다. 그래서 공통 스킬은 해당 스킬들이 배치된 모든 에이전트에 같이 배치해야 한다.
- 배치 에이전트가 다르면(다른 에이전트 스킬 requires 금지) 추출하지 않고 중복을 둔다.

## 제안표에 올리는 표

| 종류 | 대상 | 근거 | 제안 | 영향 에이전트 |
| --- | --- | --- | --- | --- |
| 분할 | example-skill | 104/120줄 | a, b로 분할 | core-dev |
| 이동 | example-skill S3 | 예외 목록 12줄 | references/exceptions.md | - |
| 삭제 후보 | example-skill S4 | 6주 영수증 0회 | 단계 삭제 | ui-dev |
| 추출 | a.S2, b.S1 | 같은 도구 순서 | common-verify | core-dev |
