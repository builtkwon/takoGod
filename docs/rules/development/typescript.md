# TypeScript

- 필수: `tsconfig.json`의 strict 계열 옵션(`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` 등)을 끄지 않는다. 바꾸려면 먼저 합의([implementation.md](../collaboration/implementation.md#먼저-합의-vs-자율-진행)).
- 필수: 타입만 가져올 때는 `import type`을 쓴다(`verbatimModuleSyntax`).
- 필수: core·contracts는 `tsconfig.core.json`으로 DOM 없이 컴파일된다. 경계 규칙은 [overview.md](../architecture/overview.md#경계-검사).
- 기본: 외부로 노출하는 데이터 타입의 필드는 `readonly`.
- TypeScript 버전: 6.0. 7.0은 JS API가 없어 dependency-cruiser가 지원하지 않는다(7.1 이상부터 지원). 버전 변경은 먼저 합의.
- 미정: lint·포맷터.
