# render (`src/render`)

- 소유: render-dev
- 역할: Three.js PS1 렌더링 어댑터.
- 계층 규칙: [overview.md](../overview.md#계층)
- 렌더 파이프라인 결정: [ADR 0001](../../../adr/0001-ps1-render-pipeline.md)

## 규칙

- 필수: 그래픽 사양은 [GDD §제품](../../../GDD.md#제품)을 따른다.
- 필수: core 상태는 contracts의 `GameStateV2`와 `EventBus` 이벤트로만 받는다.
- 필수: 도구 연결 — `src/render/sandbox.html`(쿼리 `?state=<name>`)과 `src/render/sandbox.states.json`을 둔다. json 모양은 `src/contracts/tooling.ts`의 `SandboxStates`.
