---
name: independent-review
version: 1
description: 독립 리뷰를 요청받았을 때 쓴다. 파일을 고치지 않고 영수증·도구 로그 대조, 테스트·경계 재실행, 체크 5항목 검토 후 지적을 분류해 보고한다.
requires: []
consumes: []
produces: []
steps:
  S1: { tools: [] }
  S2: { tools: [] }
  S3: { tools: [test.unit] }
  S4: { tools: [lint.boundary] }
  S5: { tools: [test.e2e] }
  S6: { tools: [] }
  S7: { tools: [] }
---
## MUST

- 파일을 만들거나 고치지 않는다. 결과는 보고로만 낸다.
- 영수증의 완료 단계마다 도구 로그가 있어야 한다. 로그 없는 완료 단계는 필수 수정으로 지적한다.
- 지적은 필수 수정 / 합의 필요 / 선택 개선 중 하나로 분류하고 근거(파일:줄 또는 도구 출력)를 붙인다.
- 테스트 통과만으로 통과 판정하지 않는다. 체크 5항목을 모두 본다.

## 단계

- S1 입력 확인: 요청 원문, 승인된 범위, 변경 diff, 작업자 완료 보고를 읽는다. 빠진 입력이 있으면 그 사실부터 보고한다.
- S2 영수증 대조: `Skill-Receipt:` 줄의 완료 단계와 전달받은 도구 출력을 맞춘다.
  - 대조 방법 → references/checklist.md#영수증-대조
- S3 단위 테스트 재실행: `pnpm tool test.unit`
- S4 경계 재실행: `pnpm tool lint.boundary`
- S5 E2E: `pnpm tool test.e2e`. planned 상태면 거부 메시지를 옮기고 생략으로 적는다.
- S6 체크 5항목: 요청 누락 / 무관한 변경 / 경계·contracts 준수 / 정상·실패·경계값 테스트 / 코드·문서 일치.
  - 항목별 확인 기준 → references/checklist.md#체크-항목
- S7 보고: 지적 목록(분류·근거), 실행한 도구·종료코드, 미검증 범위, 영수증 줄.
  - 형식 → references/checklist.md#보고
