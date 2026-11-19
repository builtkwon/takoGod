# core (`src/core`)

- 소유: core-dev
- 역할: 순수 TS 게임 로직(domain+application). 굽기·판정·손님·점수·진행.
- 계층 규칙: [overview.md](../overview.md#계층)

## 규칙

- 필수: 게임 규칙과 수치는 [GDD](../../../GDD.md)를 따른다.
- 필수: 외부와 주고받는 타입·이벤트는 [contracts](contracts.md)에 있는 것만 쓴다. 필요한 타입이 없으면 `TODO-CONTRACT.md`에 제안한다.
- 필수: 도구 연결 — `src/core/sim.ts`에서 `BalanceSimulator`를 export한다. 모양은 `src/contracts/tooling.ts`의 `SimModule`.
- 필수: sessionStorage 키·형식은 [GDD §제품](../../../GDD.md#제품)을 따른다. 변경 시 [review.md](../../collaboration/review.md#언제) 독립 리뷰 대상이다.
- 필수: 세션 평균 별점은 core가 계산하고(`GameStateV2.sessionAverage`), main이 ui로 전달한다.
- 필수: 세션 저장은 contracts `SessionStore` 포트로만 한다. core에는 테스트용 메모리 구현만 두고, 브라우저 sessionStorage 구현은 main 조립 쪽에 둔다.
