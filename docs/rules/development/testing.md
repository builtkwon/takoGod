# 테스트

- 도구: Vitest. 실행 `pnpm vitest run`.
- 기본: 테스트는 대상 옆에 `*.test.ts`로 둔다(`vite.config.ts`의 `test.include`). 예외: 하네스 스크립트 테스트는 `harness/scripts/__tests__/`.
- 필수: 정상·실패·경계값을 함께 다룬다. 리뷰 체크 항목이다([review.md](../collaboration/review.md#체크-5항목)).
- 필수: 게임 규칙 테스트의 기대값은 [GDD](../../GDD.md) 수치에서 온다.
- 필수: 기능과 테스트는 같은 커밋([commits.md](../collaboration/commits.md)).
- 기본: core 테스트는 주입식 clock으로 시간을 진행한다. 실제 타이머·sleep 금지.
- 미정: E2E(Playwright, 모바일 프로젝트). 하네스에서 planned 상태다.
