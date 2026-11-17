---
name: ps1-visual-check
version: 1
description: render의 PS1 시각 요소(모델·텍스처·셰이더·카메라)를 바꿀 때 쓴다. sandbox 상태를 캡처해 GDD·ADR 사양과 대조한 뒤 verify-and-report로 이어간다.
requires: []
consumes: []
produces: []
steps:
  S1: { tools: [] }
  S2: { tools: [] }
  S3: { tools: [render.snapshot] }
  S4: { tools: [] }
  S5: { tools: [] }
---
## MUST

- 그래픽 사양은 GDD §제품과 ADR 0001을 따른다. 사양 밖 변경은 먼저 합의한다.
- core 상태는 contracts의 GameState·EventBus 이벤트로만 받는다. 게임 규칙을 render에 두지 않는다.
- 시각 변경마다 sandbox 상태로 재현 가능해야 한다.
- 캡처를 보지 않고 대조 완료로 쓰지 않는다.

## 단계

- S1 사양 확인: 바꿀 요소의 사양을 찾는다.
  - 사양 → docs/GDD.md#제품, 파이프라인 결정 → docs/adr/0001-ps1-render-pipeline.md
- S2 sandbox 상태: 변경을 보여 줄 상태를 src/render/sandbox.states.json에 추가하거나 기존 상태를 고른다.
  - 연결 규약 → docs/rules/architecture/modules/render.md
- S3 캡처: `pnpm tool render.snapshot`. 결과는 .artifacts/snapshots/에 생긴다.
- S4 대조: 캡처 이미지를 열어 S1 사양과 항목별로 맞춘다. 어긋난 항목은 고친 뒤 S3부터 다시.
- S5 verify-and-report로 이어간다.
