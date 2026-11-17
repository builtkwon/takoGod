# TODO-CONTRACT

구현 세션이 `src/contracts` 변경을 제안하는 곳이다. 구현 세션은 contracts를 직접 고치지 않고 아래 양식으로 항목을 추가한다. integrator가 사용자 합의 후 반영하고 항목을 지운다. 절차: [docs/rules/architecture/modules/contracts.md](docs/rules/architecture/modules/contracts.md)

## 양식

```md
### <짧은 제목>

- 제안: <바꿀 타입·이벤트와 변경 내용>
- 이유: <왜 필요한지, 현재 contracts로 안 되는 점>
- 영향 모듈: <core / render / ui / data / main 중 해당>
```

## core-dev

### GameState에 세션 종료 표시 추가

- 제안: `GameState.finished: boolean`(P5 종료 또는 저장값 finished 복원) 추가. 이벤트로 알릴 거면 대안으로 `'session/finished': { readonly sessionAverage: number | null }`.
- 이유: `SessionSnapshot.finished`는 있지만 GameState·GameEvents에는 없어 main·ui가 결과 화면 전환 시점을 알 수 없다. 임시로 `Game.finished` getter를 core 클래스에 뒀다(contracts 밖이라 render·ui는 못 읽는다).
- 영향 모듈: core / ui / main
<!-- end:core-dev -->

## render-dev

<!-- end:render-dev -->

## ui-dev

<!-- end:ui-dev -->
