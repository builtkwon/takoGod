# 테스트

## 층

| 층 | 도구 | 위치 |
| --- | --- | --- |
| 단위 | Vitest(node). `pnpm vitest run` | 모듈의 `__tests__/<대상>.test.ts`(`vite.config.ts`의 `test.include`). src 최상위 파일은 `src/__tests__/`, 하네스는 `harness/scripts/__tests__/`. fixtures는 필요할 때 `__tests__/fixtures/` |
| 화면 | render.snapshot | `src/render/sandbox.*` |
| E2E | Playwright, mobile 프로젝트 1개 | `e2e/*.spec.ts` |

## 모듈별 대상

- core: 규칙·수치 전부(필수). 기대값은 [GDD](../../GDD.md)에서 온다(필수).
- render: 순수 계산만. three 객체와 렌더 결과는 render.snapshot.
- ui: DOM 없는 함수만. DOM 동작은 E2E. jsdom은 추가하지 않는다.
- data: 형식 테스트와 dialogue.lint.
- main: 분리한 모듈(`session-store.ts`)만 단위 테스트. 조립과 루프는 E2E.

## 작성

- 필수: 정상·실패·경계값을 함께 다룬다([review.md](../collaboration/review.md#체크-5항목)).
- 필수: 기능과 테스트는 같은 커밋([commits.md](../collaboration/commits.md)).
- 필수: 외부 입력(sessionStorage 등)은 정상·손상·버전 불일치·쓰기 실패를 테스트한다.
- 필수: 실제 타이머·sleep 금지. core는 주입식 clock으로 시간을 진행한다.
- 기본: describe는 대상(필요하면 GDD 절), it은 기대 동작 한국어 한 문장.
- 기본: 의존은 인자로 주입한다(clock, rng, storage stub). `vi.mock` 금지.
- 기본: 난수는 시드 고정 `createRng`.
- 기본: 기대값은 명시한다. `toMatchSnapshot` 금지.
- 기본: 버그 수정은 재현 테스트를 먼저 쓴다.

## E2E

- 필수: 세로 모바일 뷰포트 1개(예: 390×844). build 후 `vite preview`를 대상으로 한다.
- 필수: 시나리오 최소 3개: 부팅(콘솔 에러 0, 캔버스), 튜토리얼 한 판 → 튜토리얼 완료 카드(결과 화면은 저장값 복원으로 확인), 새로고침 복원.
- 필수: 시간 진행은 `page.clock`을 쓴다. 게임 코드에 테스트용 장치를 넣지 않는다.
- 필수: 통과하면 test.e2e를 active로 바꾼다.

## 미정

- 커버리지 수치, 성능 기준, 다기기·다브라우저, 시각 회귀 비교. 두지 않는다.
