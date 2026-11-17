# core (`src/core`)

- 소유: core-dev
- 역할: 순수 TS 게임 로직(domain+application). 굽기·판정·손님·점수·진행.
- 계층 규칙: [overview.md](../overview.md#계층)

## 규칙

- 필수: 게임 규칙과 수치는 [GDD](../../../GDD.md)를 따른다.
- 필수: 외부와 주고받는 타입·이벤트는 [contracts](contracts.md)에 있는 것만 쓴다. 필요한 타입이 없으면 `TODO-CONTRACT.md`에 제안한다.
- 필수: 도구 연결 — `src/core/sim.ts`에서 `BalanceSimulator`를 export한다. 모양은 `src/contracts/tooling.ts`의 `SimModule`.
- 미정: sessionStorage 키·형식. 정할 때 [ai-execution.md](../../collaboration/ai-execution.md#독립-리뷰) 독립 리뷰 대상이다.
