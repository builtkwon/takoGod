---
name: tdd-game-rule
version: 1
description: core 게임 규칙·수치(굽기·판정·손님·점수·진행)를 구현할 때 쓴다. GDD 수치로 실패 테스트를 먼저 쓰고 구현·밸런스 확인 뒤 verify-and-report로 이어간다.
requires: []
consumes: []
produces: []
steps:
  S1: { tools: [] }
  S2: { tools: [test.unit] }
  S3: { tools: [test.unit] }
  S4: { tools: [sim.balance] }
  S5: { tools: [] }
---
## MUST

- 기대값은 GDD 수치에서 온다. GDD에 없는 수치를 정하지 않는다(먼저 합의).
- 테스트를 구현보다 먼저 쓰고, 실패를 확인한 뒤 구현한다.
- 시간은 주입식 clock(`tick(dt)`)으로 진행한다. 실제 타이머·sleep 금지.
- core에서 DOM·Three.js·브라우저 API를 쓰지 않는다.

## 단계

- S1 GDD 수치 확인: 구현할 규칙의 수치·조건을 GDD에서 찾아 테스트 케이스(정상·실패·경계값)로 옮긴다.
  - GDD 원본 → docs/GDD.md, core 규칙 → docs/rules/architecture/modules/core.md
  - 수치가 없거나 모호하다 → 구현을 멈추고 사용자에게 올린다.
- S2 실패 확인: 테스트를 쓰고 `pnpm tool test.unit`으로 새 테스트가 실패하는지 본다.
- S3 구현: 통과할 만큼만 구현하고 `pnpm tool test.unit`으로 통과를 본다.
  - 필요한 contracts 타입이 없다 → contract-proposal
- S4 밸런스: 점수·별점·평균에 영향이 있으면 `pnpm tool sim.balance`로 GDD 밸런스 목표와 비교한다. 영향이 없으면 생략 사유를 쓴다.
- S5 verify-and-report로 이어간다(점수·별점 변경이면 독립 리뷰 조건 해당).
