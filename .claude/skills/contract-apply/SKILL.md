---
name: contract-apply
version: 1
description: TODO-CONTRACT.md의 contracts 변경 제안을 반영할 때 쓴다. 사용자 합의 후 src/contracts를 고치고 반영 항목을 지운 뒤 verify-and-report로 이어간다.
requires: []
consumes: [TODO-CONTRACT.md]
produces: []
steps:
  S1: { tools: [] }
  S2: { tools: [] }
  S3: { tools: [] }
  S4: { tools: [] }
  S5: { tools: [] }
---
## MUST

- 사용자 합의 없이 src/contracts를 고치지 않는다.
- contracts에는 타입·이벤트·경로 상수만 둔다. 구현 코드 금지.
- 항목을 지울 때 `## <역할>` 섹션 제목과 `<!-- end:<역할> -->` 줄은 남긴다.
- contracts 변경은 독립 리뷰 대상이다(verify-and-report S4에서 요청).

## 단계

- S1 항목 확인: TODO-CONTRACT.md 역할 섹션의 항목과 영향 모듈을 읽는다.
  - contracts 파일별 내용 → docs/rules/architecture/modules/contracts.md
- S2 합의: 항목별 반영 / 수정 반영 / 보류를 사용자에게 묻고 답을 받는다.
- S3 반영: 합의한 항목만 src/contracts에 반영한다. 영향 모듈의 깨지는 지점은 완료 보고의 미검증 범위에 적는다.
- S4 항목 삭제: 반영한 항목만 지운다. 보류 항목은 그대로 둔다.
- S5 verify-and-report로 이어간다(독립 리뷰 조건 해당).
